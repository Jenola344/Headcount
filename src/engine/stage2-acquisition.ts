/**
 * Headcount Engine — Stage 2: Acquisition Path
 * 
 * Classify each holder's token acquisition:
 * - bought: via swap against a known pool
 * - airdropped: batch transfer with ≥20 recipients sharing a tx hash
 * - dusted: unsolicited, below dust floor, no outbound since receipt
 * - transferred: plain transfer from non-pool
 * 
 * Dusted holders are removed from downstream denominators.
 */

import type {
  RunContext,
  HolderBalance,
  AcquisitionResult,
  TraceEmitter,
} from './types';
import type { AcquisitionClass } from './types';
import type { TransferLog } from '@sources/rpc';
import { getDustThreshold, makeTraceEvent, normalizeAddress } from './utils';

/**
 * Classify acquisition paths for all holders.
 * 
 * Uses the Transfer logs already collected in Stage 1 to determine
 * how each holder acquired their tokens, avoiding extra RPC calls.
 */
export function stage2ClassifyAcquisition(
  holders: HolderBalance[],
  transferLogs: TransferLog[],
  context: RunContext,
  tracer: TraceEmitter
): AcquisitionResult {
  const totalSupply = BigInt(context.token.totalSupply);
  const dustThreshold = getDustThreshold(totalSupply);

  const classifications = new Map<string, AcquisitionClass>();
  const dustAddresses = new Set<string>();

  // ─── Build lookup structures from transfer logs ──────────────────────────

  // Group transfers by tx hash to detect batch airdrops
  const txRecipients = new Map<string, Set<string>>();
  // Track last outbound transfer per address
  const hasOutbound = new Set<string>();
  // Track the transfer that gave each holder their tokens (simplified: last inbound)
  const holderInbound = new Map<string, TransferLog>();

  // Known pool address heuristic: addresses that appear as 'from' in high-value
  // transfers to many different recipients. We'll also check for common pool patterns.
  const fromAddressTxCount = new Map<string, number>();

  for (const log of transferLogs) {
    const from = normalizeAddress(log.from);
    const to = normalizeAddress(log.to);
    const txHash = log.transactionHash.toLowerCase();

    // Track tx recipients for airdrop detection
    if (!txRecipients.has(txHash)) {
      txRecipients.set(txHash, new Set());
    }
    txRecipients.get(txHash)!.add(to);

    // Track outbound activity
    hasOutbound.add(from);

    // Track inbound transfers for holders
    if (holders.some(h => normalizeAddress(h.address) === to)) {
      holderInbound.set(to, log);
    }

    // Count transfers from each address (pool detection heuristic)
    fromAddressTxCount.set(from, (fromAddressTxCount.get(from) ?? 0) + 1);
  }

  // Identify likely pool addresses: addresses with very high outbound transfer counts
  // relative to total transfers (rough heuristic — Stage 3 does proper pool verification)
  const likelyPools = new Set<string>();
  const avgTxCount = transferLogs.length / Math.max(fromAddressTxCount.size, 1);
  for (const [addr, count] of fromAddressTxCount) {
    if (count > avgTxCount * 5 && count > 50) {
      likelyPools.add(addr);
    }
  }

  // ─── Classify each holder ────────────────────────────────────────────────

  let boughtCount = 0;
  let airdropCount = 0;
  let dustCount = 0;
  let transferCount = 0;

  for (const holder of holders) {
    const addr = normalizeAddress(holder.address);
    const inbound = holderInbound.get(addr);

    if (!inbound) {
      // No transfer record found — might be deployer/minter
      classifications.set(addr, 'transferred');
      transferCount++;
      continue;
    }

    const from = normalizeAddress(inbound.from);
    const txHash = inbound.transactionHash.toLowerCase();
    const recipientsInTx = txRecipients.get(txHash)?.size ?? 0;

    // Check dust first
    if (
      holder.balance < dustThreshold &&
      !hasOutbound.has(addr)
    ) {
      classifications.set(addr, 'dusted');
      dustAddresses.add(addr);
      dustCount++;
      continue;
    }

    // Check airdrop: ≥20 recipients in same tx
    if (recipientsInTx >= 20) {
      classifications.set(addr, 'airdropped');
      airdropCount++;
      continue;
    }

    // Check if from a pool
    if (likelyPools.has(from)) {
      classifications.set(addr, 'bought');
      boughtCount++;
      continue;
    }

    // Default: transferred
    classifications.set(addr, 'transferred');
    transferCount++;
  }

  // ─── Emit trace event ────────────────────────────────────────────────────
  tracer.emit(makeTraceEvent('ACQUISITION', {
    bought: boughtCount,
    airdropped: airdropCount,
    dusted: dustCount,
    transferred: transferCount,
    total_analysed: holders.length,
    dust_threshold: dustThreshold.toString(),
  }));

  return {
    bought: boughtCount,
    airdropped: airdropCount,
    dusted: dustCount,
    transferred: transferCount,
    classifications,
    dustAddresses,
  };
}
