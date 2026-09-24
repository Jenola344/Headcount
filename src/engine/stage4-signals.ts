/**
 * Headcount Engine — Stage 4: Structural Signals
 * 
 * Computes deterministic structural signals over the resolved holder set.
 */

import type { PublicClient, Transport, Chain } from 'viem';
import type {
  RunContext,
  HolderBalance,
  FundingResult,
  Signals,
  TraceEmitter,
} from './types';
import type { TransferLog } from '@sources/rpc';
import { getTransactionCount, type SourceCall } from '@sources/rpc';
import { checkExogenousActivity } from '@sources/alchemy';
import {
  computeHHI,
  computeClusterAdjustedHHI,
  computeBirthDispersion,
  median,
  makeTraceEvent,
  normalizeAddress,
} from './utils';

export interface Stage4Output {
  ok: true;
  result: Signals;
  sourceCalls: SourceCall[];
}

export type Stage4Result = Stage4Output; // No refusal paths in this stage

export async function stage4ComputeSignals(
  client: PublicClient<Transport, Chain>,
  holders: HolderBalance[],
  dustAddresses: Set<string>,
  funding: FundingResult,
  transferLogs: TransferLog[],
  context: RunContext,
  tracer: TraceEmitter
): Promise<Stage4Result> {
  const sourceCalls: SourceCall[] = [];

  const nonDustHolders = holders.filter(
    h => !dustAddresses.has(normalizeAddress(h.address))
  );

  // ─── Prep maps for quick lookup ──────────────────────────────────────────
  const holderShares = new Map<string, number>();
  const holderFirstTxBlocks = new Map<string, number>();
  const holderLastTxBlocks = new Map<string, number>();

  for (const h of nonDustHolders) {
    const addr = normalizeAddress(h.address);
    holderShares.set(addr, h.supplyShare);
  }

  // Find first and last activity blocks from our Transfer logs
  for (const log of transferLogs) {
    const from = normalizeAddress(log.from);
    const to = normalizeAddress(log.to);
    const blockNum = Number(log.blockNumber);

    for (const addr of [from, to]) {
      if (holderShares.has(addr)) {
        if (!holderFirstTxBlocks.has(addr) || blockNum < holderFirstTxBlocks.get(addr)!) {
          holderFirstTxBlocks.set(addr, blockNum);
        }
        if (!holderLastTxBlocks.has(addr) || blockNum > holderLastTxBlocks.get(addr)!) {
          holderLastTxBlocks.set(addr, blockNum);
        }
      }
    }
  }

  // ─── Signal: Birth Dispersion ────────────────────────────────────────────
  const firstBlocks = Array.from(holderFirstTxBlocks.values());
  const birthDispersion = computeBirthDispersion(firstBlocks);

  // ─── Signal: Naive vs Cluster-Adjusted HHI ───────────────────────────────
  const naiveShares = Array.from(holderShares.values());
  const naiveHhi = computeHHI(naiveShares);

  // Map cluster members for HHI adjustment
  const clusterMap = new Map<string, string[]>();

  for (const cluster of funding.clusters) {
    clusterMap.set(cluster.id, cluster.members);
  }

  const clusterAdjustedHhi = computeClusterAdjustedHHI(holderShares, clusterMap);

  // ─── Signal: Dormancy Rate & Hold Age ────────────────────────────────────
  let dormantCount = 0;
  const holdAges: number[] = [];
  const currentBlock = Number(context.pinnedBlock);

  for (const h of nonDustHolders) {
    const addr = normalizeAddress(h.address);
    const firstBlock = holderFirstTxBlocks.get(addr) ?? currentBlock;
    const lastBlock = holderLastTxBlocks.get(addr) ?? currentBlock;
    
    // Definition of dormant: last activity was the acquisition block
    if (lastBlock === firstBlock) {
      dormantCount++;
    }
    
    holdAges.push(currentBlock - firstBlock);
  }

  const dormancyRate = nonDustHolders.length > 0
    ? dormantCount / nonDustHolders.length
    : 0;
    
  const medianHoldAge = median(holdAges);

  // ─── Signal: Exogenous Rate ──────────────────────────────────────────────
  // Sample up to 50 holders to avoid blasting the API, prioritize larger holders
  const MAX_EXOGENOUS_SAMPLES = 50;
  const exogenousSamples = nonDustHolders.slice(0, MAX_EXOGENOUS_SAMPLES);
  let exogenousCount = 0;

  if (context.config.alchemyApiKey) {
    const promises = exogenousSamples.map(async (h) => {
      try {
        const { exogenousTxCount, sourceCall } = await checkExogenousActivity(
          context.config.alchemyApiKey!,
          normalizeAddress(h.address)
        );
        sourceCalls.push(sourceCall);
        if (exogenousTxCount > 0) return 1;
        return 0;
      } catch {
        return 0; // Assume not exogenous on failure to be conservative
      }
    });

    const results = await Promise.all(promises);
    exogenousCount = results.reduce<number>((a, b) => a + b, 0);
  } else {
    // Fallback: use eth_getTransactionCount
    // If nonce > transfer logs count, they likely have exogenous txs
    const promises = exogenousSamples.map(async (h) => {
      const addr = normalizeAddress(h.address);
      try {
        const { count: nonce, sourceCall } = await getTransactionCount(
          client,
          addr as `0x${string}`,
          context.pinnedBlock
        );
        sourceCalls.push(sourceCall);
        
        // Rough heuristic: how many transfers involving this token does the holder have?
        let tokenTxCount = 0;
        for (const log of transferLogs) {
           if (normalizeAddress(log.from) === addr || normalizeAddress(log.to) === addr) {
               tokenTxCount++;
           }
        }
        
        // If they have more transactions total than they have transfers of this token,
        // they likely have exogenous activity (this is a rough lower bound)
        if (nonce > tokenTxCount) return 1;
        return 0;
      } catch {
        return 0;
      }
    });
    const results = await Promise.all(promises);
    exogenousCount = results.reduce<number>((a, b) => a + b, 0);
  }

  const exogenousRate = exogenousSamples.length > 0
    ? exogenousCount / exogenousSamples.length
    : 0;

  // ─── Assemble Result ─────────────────────────────────────────────────────
  const result: Signals = {
    birth_dispersion: Number(birthDispersion.toFixed(4)),
    exogenous_rate: Number(exogenousRate.toFixed(4)),
    naive_hhi: Number(naiveHhi.toFixed(4)),
    cluster_adjusted_hhi: Number(clusterAdjustedHhi.toFixed(4)),
    dormancy_rate: Number(dormancyRate.toFixed(4)),
    median_hold_age: Math.round(medianHoldAge),
  };

  tracer.emit(makeTraceEvent('SIGNALS', {
    ...result,
    hhi_delta: Number((clusterAdjustedHhi - naiveHhi).toFixed(4)),
    exogenous_sampled: exogenousSamples.length,
  }));

  return { ok: true, result, sourceCalls };
}
