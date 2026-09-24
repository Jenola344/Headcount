/**
 * Headcount Engine — Stage 0: Admit
 * 
 * Resolve input address, validate it's an ERC-20, pin block number,
 * emit RUN_OPENED event. Failure → UNVERIFIABLE / CONTRACT_UNREADABLE.
 */

import type { PublicClient, Transport, Chain } from 'viem';
import type { RunConfig, RunContext, TokenMetadata, TraceEmitter } from './types';
import { readTokenMetadata, getCurrentBlock, type SourceCall } from '@sources/rpc';
import { getEngineCommit, makeTraceEvent } from './utils';

export interface Stage0Result {
  context: RunContext;
  sourceCalls: SourceCall[];
}

export interface Stage0Refusal {
  verdict: 'UNVERIFIABLE';
  reason: 'CONTRACT_UNREADABLE' | 'NOT_A_TOKEN';
  detail: string;
  sourceCalls: SourceCall[];
}

export type Stage0Output = 
  | { ok: true; result: Stage0Result }
  | { ok: false; refusal: Stage0Refusal };

/**
 * Stage 0: Admit
 * 
 * 1. Pin the block number FIRST (before any other read)
 * 2. Read token metadata (name, symbol, decimals, totalSupply)
 * 3. Emit RUN_OPENED trace event
 * 4. Return RunContext or refusal
 */
export async function stage0Admit(
  client: PublicClient<Transport, Chain>,
  config: RunConfig,
  tracer: TraceEmitter
): Promise<Stage0Output> {
  const sourceCalls: SourceCall[] = [];
  const address = config.tokenAddress.toLowerCase() as `0x${string}`;

  // ─── Step 1: Pin the block number ────────────────────────────────────────
  let pinnedBlock: bigint;
  try {
    pinnedBlock = config.pinnedBlock ?? await getCurrentBlock(client);
    sourceCalls.push(`eth_blockNumber:${pinnedBlock}`);
  } catch (err) {
    const refusal: Stage0Refusal = {
      verdict: 'UNVERIFIABLE',
      reason: 'CONTRACT_UNREADABLE',
      detail: `Failed to read current block number: ${String(err)}`,
      sourceCalls,
    };
    tracer.emit(makeTraceEvent('REFUSAL', {
      verdict: refusal.verdict,
      reason: refusal.reason,
      detail: refusal.detail,
    }));
    return { ok: false, refusal };
  }

  // ─── Step 2: Read token metadata ─────────────────────────────────────────
  let tokenData: Awaited<ReturnType<typeof readTokenMetadata>>;
  try {
    tokenData = await readTokenMetadata(client, address);
    sourceCalls.push(...tokenData.sourceCalls);
  } catch (err) {
    const refusal: Stage0Refusal = {
      verdict: 'UNVERIFIABLE',
      reason: 'CONTRACT_UNREADABLE',
      detail: `Failed to read ERC-20 metadata from ${address}: ${String(err)}`,
      sourceCalls,
    };
    tracer.emit(makeTraceEvent('REFUSAL', {
      verdict: refusal.verdict,
      reason: refusal.reason,
      detail: refusal.detail,
    }));
    return { ok: false, refusal };
  }

  // ─── Step 3: Validate it's actually a token ──────────────────────────────
  if (!tokenData.name || !tokenData.symbol || tokenData.totalSupply === 0n) {
    const refusal: Stage0Refusal = {
      verdict: 'UNVERIFIABLE',
      reason: 'NOT_A_TOKEN',
      detail: `Address ${address} does not appear to be a valid ERC-20 token (name="${tokenData.name}", symbol="${tokenData.symbol}", totalSupply=${tokenData.totalSupply})`,
      sourceCalls,
    };
    tracer.emit(makeTraceEvent('REFUSAL', {
      verdict: refusal.verdict,
      reason: refusal.reason,
      detail: refusal.detail,
    }));
    return { ok: false, refusal };
  }

  // ─── Step 4: Build context ───────────────────────────────────────────────
  const token: TokenMetadata = {
    address,
    name: tokenData.name,
    symbol: tokenData.symbol,
    decimals: tokenData.decimals,
    totalSupply: tokenData.totalSupply.toString(),
  };

  const context: RunContext = {
    config,
    token,
    pinnedBlock,
    engineCommit: getEngineCommit(),
    startedAt: new Date().toISOString(),
  };

  // ─── Step 5: Emit RUN_OPENED ─────────────────────────────────────────────
  tracer.emit(makeTraceEvent('RUN_OPENED', {
    token: {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      totalSupply: token.totalSupply,
    },
    block: Number(pinnedBlock),
    engine_commit: context.engineCommit,
  }));

  return {
    ok: true,
    result: { context, sourceCalls },
  };
}
