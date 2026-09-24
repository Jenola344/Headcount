/**
 * Headcount Engine — Stage 1: Build the Holder Set
 * 
 * Page Transfer event logs from deployment block to pinned block,
 * fold into balance map, sort descending, take top N.
 * Emit HOLDER_SET trace event with coverage and truncation bounds.
 */

import type { PublicClient, Transport, Chain } from 'viem';
import type { RunContext, HolderBalance, HolderSetResult, TraceEmitter } from './types';
import { getTransferLogs, type SourceCall } from '@sources/rpc';
import { getContractCreationBlock } from '@sources/basescan';
import { computeSupplyShare, makeTraceEvent, normalizeAddress } from './utils';

export interface Stage1Output {
  ok: true;
  result: HolderSetResult;
  sourceCalls: SourceCall[];
  transferLogs: import('@sources/rpc').TransferLog[];
}

export interface Stage1Refusal {
  verdict: 'UNVERIFIABLE';
  reason: 'COVERAGE_TOO_THIN';
  detail: string;
  supplyCoverage: number;
  sourceCalls: SourceCall[];
}

export type Stage1Result =
  | Stage1Output
  | { ok: false; refusal: Stage1Refusal };

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Stage 1: Build the Holder Set
 * 
 * 1. Find deployment block (via Basescan or start from block 0)
 * 2. Page all Transfer events from deployment to pinned block
 * 3. Fold logs into a balance map (mint = from 0x0, burn = to 0x0)
 * 4. Discard zero balances
 * 5. Sort by balance descending, take top N
 * 6. Compute supply_coverage
 * 7. If coverage < 0.40, refuse
 */
export async function stage1BuildHolderSet(
  client: PublicClient<Transport, Chain>,
  context: RunContext,
  tracer: TraceEmitter
): Promise<Stage1Result> {
  const sourceCalls: SourceCall[] = [];
  const tokenAddress = context.token.address as `0x${string}`;
  const totalSupply = BigInt(context.token.totalSupply);
  const holderCap = context.config.holderCap;

  // ─── Step 1: Find deployment block ───────────────────────────────────────
  let fromBlock = 0n;
  try {
    const { info, sourceCall } = await getContractCreationBlock(
      tokenAddress,
      context.config.basescanApiKey
    );
    sourceCalls.push(sourceCall);

    if (info && info.deploymentBlock > 0n) {
      fromBlock = info.deploymentBlock;
    }
  } catch {
    // If we can't find deployment block, start from a reasonable point
    // Base mainnet started at block ~0, but we'll try from 0
    fromBlock = 0n;
  }

  // ─── Step 2: Page Transfer logs ──────────────────────────────────────────
  const logResult = await getTransferLogs(
    client,
    tokenAddress,
    fromBlock,
    context.pinnedBlock,
    500,  // Max pages
    5000n // Initial chunk size
  );
  sourceCalls.push(...logResult.sourceCalls);

  // ─── Step 3: Fold into balance map ───────────────────────────────────────
  const balances = new Map<string, bigint>();

  for (const log of logResult.logs) {
    const from = normalizeAddress(log.from);
    const to = normalizeAddress(log.to);
    const value = log.value;

    // Mint (from zero address)
    if (from !== ZERO_ADDRESS) {
      const current = balances.get(from) ?? 0n;
      const newBalance = current - value;
      if (newBalance <= 0n) {
        balances.delete(from);
      } else {
        balances.set(from, newBalance);
      }
    }

    // Credit recipient (skip burns to zero address)
    if (to !== ZERO_ADDRESS) {
      const current = balances.get(to) ?? 0n;
      balances.set(to, current + value);
    }
  }

  // ─── Step 4: Discard zero balances ───────────────────────────────────────
  for (const [addr, bal] of balances) {
    if (bal <= 0n) {
      balances.delete(addr);
    }
  }

  const totalAddresses = balances.size;

  // ─── Step 5: Sort descending, take top N ─────────────────────────────────
  const sorted = [...balances.entries()]
    .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0))
    .slice(0, holderCap);

  const holders: HolderBalance[] = sorted.map(([address, balance]) => ({
    address: address as `0x${string}`,
    balance,
    supplyShare: computeSupplyShare(balance, totalSupply),
  }));

  // ─── Step 6: Compute supply coverage ─────────────────────────────────────
  const analysedSupply = holders.reduce((sum, h) => sum + h.balance, 0n);
  const supplyCoverage = totalSupply > 0n
    ? Number((analysedSupply * 10000n) / totalSupply) / 10000
    : 0;

  // ─── Step 7: Check coverage threshold ────────────────────────────────────
  const result: HolderSetResult = {
    totalAddresses,
    analysed: holders.length,
    supplyCoverage,
    logPages: logResult.pages,
    windowTruncated: logResult.windowTruncated,
    earliestBlockReached: logResult.earliestBlockReached,
    holders,
  };

  // Emit trace event
  tracer.emit(makeTraceEvent('HOLDER_SET', {
    total_addresses: totalAddresses,
    analysed: holders.length,
    supply_coverage: supplyCoverage,
    log_pages: logResult.pages,
    window_truncated: logResult.windowTruncated,
    earliest_block_reached: Number(logResult.earliestBlockReached),
  }));

  if (supplyCoverage < 0.40) {
    const refusal: Stage1Refusal = {
      verdict: 'UNVERIFIABLE',
      reason: 'COVERAGE_TOO_THIN',
      detail: `Supply coverage is ${(supplyCoverage * 100).toFixed(1)}% — below the 40% minimum required for a meaningful analysis. Only ${holders.length} of ${totalAddresses} holders were analysed.`,
      supplyCoverage,
      sourceCalls,
    };
    tracer.emit(makeTraceEvent('REFUSAL', {
      verdict: refusal.verdict,
      reason: refusal.reason,
      supply_coverage: supplyCoverage,
    }));
    return { ok: false, refusal };
  }

  return { ok: true, result, sourceCalls, transferLogs: logResult.logs };
}
