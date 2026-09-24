/**
 * Headcount Engine — Shared Utilities
 * 
 * Pure functions for math, formatting, and common operations.
 * No side effects, no API calls, no state.
 */

import type { TraceEvent, TraceEmitter, TraceEventType } from './types';

// ─── HHI (Herfindahl-Hirschman Index) ──────────────────────────────────────────

/**
 * Compute the Herfindahl-Hirschman Index for a set of shares.
 * Each share should be a fraction of the total (0 to 1).
 * HHI ranges from 0 (perfect competition) to 1 (monopoly).
 */
export function computeHHI(shares: number[]): number {
  if (shares.length === 0) return 0;
  return shares.reduce((sum, s) => sum + s * s, 0);
}

/**
 * Compute cluster-adjusted HHI: merge holdings of wallets in the same cluster,
 * then compute HHI on the merged shares.
 */
export function computeClusterAdjustedHHI(
  holderShares: Map<string, number>, // address -> supply share
  clusters: Map<string, string[]>,   // clusterId -> [address, ...]
  holderCluster: Map<string, string> // address -> clusterId
): number {
  // Merge shares by cluster
  const mergedShares: number[] = [];
  const processed = new Set<string>();

  for (const [clusterId, members] of clusters) {
    let mergedShare = 0;
    for (const member of members) {
      mergedShare += holderShares.get(member) ?? 0;
      processed.add(member);
    }
    if (mergedShare > 0) {
      mergedShares.push(mergedShare);
    }
  }

  // Add unclustered holders
  for (const [address, share] of holderShares) {
    if (!processed.has(address)) {
      mergedShares.push(share);
    }
  }

  return computeHHI(mergedShares);
}

// ─── Supply Share Calculation ──────────────────────────────────────────────────

/**
 * Compute supply share as a fraction (0 to 1).
 * Uses bigint-safe division: (balance * 1_000_000 / totalSupply) / 1_000_000
 */
export function computeSupplyShare(balance: bigint, totalSupply: bigint): number {
  if (totalSupply === 0n) return 0;
  const precision = 1_000_000n;
  const scaled = (balance * precision) / totalSupply;
  return Number(scaled) / Number(precision);
}

// ─── Dust Threshold ────────────────────────────────────────────────────────────

/**
 * Returns the dust threshold in raw token units.
 * Default: 0.001% of total supply.
 */
export function getDustThreshold(totalSupply: bigint): bigint {
  return totalSupply / 100_000n; // 0.001%
}

// ─── Birth Dispersion ──────────────────────────────────────────────────────────

/**
 * Compute birth dispersion: the share of holders whose first-tx block falls
 * within the densest 48h window. On Base (~2s blocks), 48h ≈ 86,400 blocks.
 */
export function computeBirthDispersion(firstTxBlocks: number[]): number {
  if (firstTxBlocks.length === 0) return 0;

  const WINDOW_BLOCKS = 86_400; // ~48h on Base at ~2s/block
  const sorted = [...firstTxBlocks].sort((a, b) => a - b);

  let maxInWindow = 0;
  let windowStart = 0;

  for (let windowEnd = 0; windowEnd < sorted.length; windowEnd++) {
    while (sorted[windowEnd] - sorted[windowStart] > WINDOW_BLOCKS) {
      windowStart++;
    }
    maxInWindow = Math.max(maxInWindow, windowEnd - windowStart + 1);
  }

  return maxInWindow / firstTxBlocks.length;
}

// ─── Median ────────────────────────────────────────────────────────────────────

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── JSON Canonicalization ─────────────────────────────────────────────────────

/**
 * Produce a canonical JSON string with sorted keys at all levels.
 * This is critical for receipt hashing — any key-order difference breaks the hash.
 */
export function canonicalJSON(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = (value as Record<string, unknown>)[key];
          return sorted;
        }, {});
    }
    return value;
  });
}

// ─── Trace Emitter Implementation ──────────────────────────────────────────────

export function createTraceEmitter(onEmit?: (event: TraceEvent) => void): TraceEmitter {
  const events: TraceEvent[] = [];

  return {
    emit(event: TraceEvent) {
      events.push(event);
      onEmit?.(event);
    },
    getEvents() {
      return [...events];
    },
  };
}

export function makeTraceEvent(
  type: TraceEventType,
  data: Record<string, unknown>
): TraceEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
  };
}

// ─── Engine Commit Hash ────────────────────────────────────────────────────────

/**
 * Get the engine commit hash. In production, this comes from git.
 * Falls back to 'dev' in development.
 */
export function getEngineCommit(): string {
  try {
    // Will be populated by build step or git
    return process.env.ENGINE_COMMIT ?? 'dev';
  } catch {
    return 'dev';
  }
}

// ─── Rate Limiter ──────────────────────────────────────────────────────────────

export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 10;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return this.acquire();
    }

    this.timestamps.push(now);
  }
}

// ─── Retry with Backoff ────────────────────────────────────────────────────────

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ─── Address Normalization ─────────────────────────────────────────────────────

export function normalizeAddress(address: string): string {
  return address.toLowerCase() as `0x${string}`;
}

export function getExclusionListVersion(): string {
  return 'v1.0.0';
}

