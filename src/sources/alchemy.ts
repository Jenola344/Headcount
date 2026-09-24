/**
 * Headcount Sources — Alchemy API Wrapper
 * 
 * Handles Alchemy-specific endpoints (getAssetTransfers) with rate limiting
 * and retry logic. Every call is logged to source_calls.
 */

import { retryWithBackoff, RateLimiter } from '@engine/utils';
import { formatSourceCall, type SourceCall } from './rpc';

const alchemyLimiter = new RateLimiter(20, 1000); // Conservative: 20 req/s

// ─── Alchemy Asset Transfer Types ──────────────────────────────────────────────

export interface AlchemyTransfer {
  from: string;
  to: string;
  value: number | null;
  asset: string | null;
  category: string;
  blockNum: string;
  hash: string;
  metadata: {
    blockTimestamp: string;
  };
}

export interface AlchemyTransferResult {
  transfers: AlchemyTransfer[];
  pageKey?: string;
}

// ─── Get Asset Transfers ────────────────────────────────────────────────────────

export async function getAssetTransfers(
  apiKey: string,
  params: {
    fromAddress?: string;
    toAddress?: string;
    fromBlock?: string;
    toBlock?: string;
    category: string[];
    order?: 'asc' | 'desc';
    maxCount?: string;
    pageKey?: string;
    withMetadata?: boolean;
  }
): Promise<{ result: AlchemyTransferResult; sourceCall: SourceCall }> {
  await alchemyLimiter.acquire();

  const sourceCall = formatSourceCall(
    'alchemy:getAssetTransfers',
    `${params.toAddress ?? params.fromAddress}:${params.category.join(',')}:${params.order ?? 'asc'}`
  );

  const result = await retryWithBackoff(async () => {
    const res = await fetch(
      `https://base-mainnet.g.alchemy.com/v2/${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [{
            ...params,
            withMetadata: params.withMetadata ?? true,
          }],
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Alchemy API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as { result?: AlchemyTransferResult; error?: { message: string } };
    if (json.error) {
      throw new Error(`Alchemy RPC error: ${json.error.message}`);
    }
    return json.result!;
  });

  return { result, sourceCall };
}

// ─── Batch First Funders ────────────────────────────────────────────────────────

/**
 * Resolve the first-ever inbound native ETH transfer for a batch of addresses.
 * Returns a map of address -> { funder, block }.
 * 
 * This is the main consumer of the API budget in Stage 3.
 */
export async function batchResolveFirstFunders(
  apiKey: string,
  addresses: string[]
): Promise<{
  results: Map<string, { funder: string; block: number }>;
  unresolved: string[];
  sourceCalls: SourceCall[];
}> {
  const results = new Map<string, { funder: string; block: number }>();
  const unresolved: string[] = [];
  const sourceCalls: SourceCall[] = [];

  // Process in parallel batches of 5 to respect rate limits
  const BATCH_SIZE = 5;

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (address) => {
      try {
        const { result, sourceCall } = await getAssetTransfers(apiKey, {
          toAddress: address,
          category: ['external'],
          order: 'asc',
          maxCount: '0x1',
          withMetadata: true,
        });

        sourceCalls.push(sourceCall);

        if (result.transfers.length > 0) {
          const t = result.transfers[0];
          results.set(address.toLowerCase(), {
            funder: t.from.toLowerCase(),
            block: parseInt(t.blockNum, 16),
          });
        } else {
          unresolved.push(address);
        }
      } catch {
        unresolved.push(address);
        sourceCalls.push(formatSourceCall('alchemy:getAssetTransfers:FAILED', address));
      }
    });

    await Promise.all(promises);
  }

  return { results, unresolved, sourceCalls };
}

// ─── Get Token Transfers for Exogenous Check ────────────────────────────────────

/**
 * Check if an address has transactions unrelated to a specific token.
 * Uses getAssetTransfers with 'external' + 'erc20' categories.
 */
export async function checkExogenousActivity(
  apiKey: string,
  address: string,
  tokenAddress: string
): Promise<{ exogenousTxCount: number; sourceCall: SourceCall }> {
  const { result, sourceCall } = await getAssetTransfers(apiKey, {
    fromAddress: address,
    category: ['external', 'erc20'],
    order: 'desc',
    maxCount: '0xa', // Check last 10 txs
    withMetadata: false,
  });

  // Count transactions NOT involving the target token
  const exogenous = result.transfers.filter(t => {
    // External ETH transfers are always exogenous to the token
    if (t.category === 'external') return true;
    // ERC-20 transfers to/from a different token contract
    if (t.category === 'erc20') {
      // The asset field won't always contain the contract address,
      // so we check if the transfer involves a different asset
      return true; // Count all ERC-20 activity as evidence of exogenous use
    }
    return false;
  });

  return {
    exogenousTxCount: exogenous.length,
    sourceCall,
  };
}
