/**
 * Headcount Sources — Base RPC Client
 * 
 * viem-based client for Base mainnet. All RPC calls are logged to source_calls
 * arrays for evidence traceability. This is the ONLY module that talks to Base RPC.
 */

import {
  createPublicClient,
  http,
  fallback,
  parseAbiItem,
  type PublicClient,
  type Transport,
  type Chain,
} from 'viem';
import { base } from 'viem/chains';
import { retryWithBackoff, RateLimiter } from '@engine/utils';

// ─── ERC-20 ABI fragments ──────────────────────────────────────────────────────

export const ERC20_NAME = parseAbiItem('function name() view returns (string)');
export const ERC20_SYMBOL = parseAbiItem('function symbol() view returns (string)');
export const ERC20_DECIMALS = parseAbiItem('function decimals() view returns (uint8)');
export const ERC20_TOTAL_SUPPLY = parseAbiItem('function totalSupply() view returns (uint256)');
export const ERC20_TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

// ─── Source Call Tracker ────────────────────────────────────────────────────────

export type SourceCall = string;

export function formatSourceCall(method: string, params?: string): SourceCall {
  return params ? `${method}:${params}` : method;
}

// ─── Free Base RPC endpoints (ordered by reliability for eth_getLogs) ────────────

const FREE_BASE_RPCS = [
  'https://base-rpc.publicnode.com',
  'https://base.gateway.tenderly.co',
  'https://base.drpc.org',
  'https://mainnet.base.org',
];

// ─── Client Factory ─────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter(10, 1000); // 10 req/s — safe for free tiers

export function createBaseClient(rpcUrl?: string): PublicClient<Transport, Chain> {
  const httpOpts = {
    retryCount: 3,
    retryDelay: 1500,
    timeout: 30_000,
  };

  // If a dedicated RPC URL is provided (e.g. Alchemy), use it as primary
  // with the free RPCs as fallbacks
  const userRpc = rpcUrl || process.env.BASE_RPC_URL;

  const transports = userRpc
    ? [http(userRpc, httpOpts), ...FREE_BASE_RPCS.map(u => http(u, httpOpts))]
    : FREE_BASE_RPCS.map(u => http(u, httpOpts));

  return createPublicClient({
    chain: base,
    transport: fallback(transports, { rank: true, retryCount: 2 }),
  }) as PublicClient<Transport, Chain>;
}

// ─── Token Metadata Read ────────────────────────────────────────────────────────

/**
 * Metadata field status: either the resolved value, or an unavailability record.
 * METADATA FAILURE ≠ CONTRACT FAILURE.
 */
export interface MetadataFieldUnavailable {
  status: 'UNAVAILABLE';
  error: string;
}

export type MetadataField<T> = T | MetadataFieldUnavailable;

export function isMetadataAvailable<T>(field: MetadataField<T>): field is T {
  return !(field !== null && typeof field === 'object' && 'status' in field && field.status === 'UNAVAILABLE');
}

export interface TokenMetadataResult {
  name: MetadataField<string>;
  symbol: MetadataField<string>;
  decimals: MetadataField<number>;
  totalSupply: bigint;
  sourceCalls: SourceCall[];
}

/**
 * Read ERC-20 token metadata with independent fault tolerance.
 *
 * - name(), symbol(), decimals() are OPTIONAL — failures are captured, not thrown.
 * - totalSupply() is REQUIRED — if it reverts, the token cannot be analysed.
 * - Individual metadata failures never block holder/transfer analysis.
 */
export async function readTokenMetadata(
  client: PublicClient<Transport, Chain>,
  address: `0x${string}`
): Promise<TokenMetadataResult> {
  const sourceCalls: SourceCall[] = [];

  // ─── Read name (OPTIONAL) ─────────────────────────────────────────────────
  let name: MetadataField<string>;
  try {
    await rateLimiter.acquire();
    sourceCalls.push(formatSourceCall('eth_call', `name:${address}`));
    name = await retryWithBackoff(async () => {
      return client.readContract({
        address,
        abi: [ERC20_NAME],
        functionName: 'name',
      }) as Promise<string>;
    });
  } catch (err) {
    name = { status: 'UNAVAILABLE', error: `name() reverted: ${err instanceof Error ? err.message : String(err)}` };
    sourceCalls.push(formatSourceCall('eth_call', `name:${address}:FAILED`));
  }

  // ─── Read symbol (OPTIONAL) ───────────────────────────────────────────────
  let symbol: MetadataField<string>;
  try {
    await rateLimiter.acquire();
    sourceCalls.push(formatSourceCall('eth_call', `symbol:${address}`));
    symbol = await retryWithBackoff(async () => {
      return client.readContract({
        address,
        abi: [ERC20_SYMBOL],
        functionName: 'symbol',
      }) as Promise<string>;
    });
  } catch (err) {
    symbol = { status: 'UNAVAILABLE', error: `symbol() reverted: ${err instanceof Error ? err.message : String(err)}` };
    sourceCalls.push(formatSourceCall('eth_call', `symbol:${address}:FAILED`));
  }

  // ─── Read decimals (OPTIONAL) ─────────────────────────────────────────────
  let decimals: MetadataField<number>;
  try {
    await rateLimiter.acquire();
    sourceCalls.push(formatSourceCall('eth_call', `decimals:${address}`));
    decimals = await retryWithBackoff(async () => {
      return client.readContract({
        address,
        abi: [ERC20_DECIMALS],
        functionName: 'decimals',
      }) as Promise<number>;
    });
  } catch (err) {
    decimals = { status: 'UNAVAILABLE', error: `decimals() reverted: ${err instanceof Error ? err.message : String(err)}` };
    sourceCalls.push(formatSourceCall('eth_call', `decimals:${address}:FAILED`));
  }

  // ─── Read totalSupply (REQUIRED — this IS the contract readability test) ──
  await rateLimiter.acquire();
  sourceCalls.push(formatSourceCall('eth_call', `totalSupply:${address}`));
  const totalSupply = await retryWithBackoff(async () => {
    return client.readContract({
      address,
      abi: [ERC20_TOTAL_SUPPLY],
      functionName: 'totalSupply',
    }) as Promise<bigint>;
  });

  return { name, symbol, decimals, totalSupply, sourceCalls };
}

// ─── Block Number ───────────────────────────────────────────────────────────────

export async function getCurrentBlock(
  client: PublicClient<Transport, Chain>
): Promise<bigint> {
  await rateLimiter.acquire();
  return client.getBlockNumber();
}

// ─── Transfer Log Pagination ────────────────────────────────────────────────────

export interface TransferLog {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface TransferLogResult {
  logs: TransferLog[];
  pages: number;
  windowTruncated: boolean;
  earliestBlockReached: bigint;
  sourceCalls: SourceCall[];
}

/**
 * Page Transfer event logs from toBlock DOWN to fromBlock (reverse chronological).
 * 
 * Why reverse?
 * 1. Free RPCs (PublicNode, etc.) have tight archive horizons (~10,000 blocks back from tip).
 *    Scanning forwards from block 0 immediately triggers archive request rejections (-32602).
 *    Scanning backwards from pinnedBlock captures all recent token activity first.
 * 2. If the archive boundary is reached, we preserve all recent logs instead of crashing
 *    with 0 logs.
 * 
 * Uses adaptive chunk sizing: starts at chunkSize, halves on block range/size limit errors.
 * Budget: maxPages controls how many RPC calls we're willing to make.
 */
export async function getTransferLogs(
  client: PublicClient<Transport, Chain>,
  tokenAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
  maxPages: number = 500,
  initialChunkSize: bigint = 2000n
): Promise<TransferLogResult> {
  const allLogs: TransferLog[] = [];
  const sourceCalls: SourceCall[] = [];
  let pages = 0;
  let chunkSize = initialChunkSize;
  let currentTo = toBlock;
  let windowTruncated = false;
  let earliestBlockReached = toBlock;
  let rateLimitRetries = 0;

  while (currentTo >= fromBlock && pages < maxPages) {
    let currentFrom = currentTo >= chunkSize ? currentTo - chunkSize + 1n : 0n;
    if (currentFrom < fromBlock) {
      currentFrom = fromBlock;
    }

    try {
      await rateLimiter.acquire();
      const callId = formatSourceCall(
        'eth_getLogs',
        `Transfer:${tokenAddress}:${currentFrom}-${currentTo}`
      );
      sourceCalls.push(callId);

      const rawLogs = await retryWithBackoff(async () => {
        return client.getLogs({
          address: tokenAddress,
          event: ERC20_TRANSFER,
          fromBlock: currentFrom,
          toBlock: currentTo,
        });
      });

      for (const log of rawLogs) {
        allLogs.push({
          from: (log.args as { from: `0x${string}` }).from,
          to: (log.args as { to: `0x${string}` }).to,
          value: (log.args as { value: bigint }).value,
          blockNumber: log.blockNumber!,
          transactionHash: log.transactionHash!,
          logIndex: log.logIndex!,
        });
      }

      pages++;
      earliestBlockReached = currentFrom;
      if (currentFrom === 0n || currentFrom === fromBlock) {
        break;
      }
      currentTo = currentFrom - 1n;
    } catch (err) {
      const errMsg = String(err);

      // Adaptive: range too large or log response too big -> halve chunk
      if (
        errMsg.includes('too many') ||
        errMsg.includes('query returned more than') ||
        errMsg.includes('Log response size exceeded') ||
        errMsg.includes('limited to a')
      ) {
        chunkSize = chunkSize / 2n;
        if (chunkSize < 100n) {
          windowTruncated = true;
          break;
        }
        continue; // Retry same currentTo with smaller chunk
      }

      // Archive node boundary hit (e.g. PublicNode: "Archive requests require a personal token")
      // or invalid params due to block being beyond free tier horizon:
      if (
        errMsg.includes('Archive requests require') ||
        errMsg.includes('archive') ||
        errMsg.includes('-32602')
      ) {
        // Can't read further back into history with current RPC
        windowTruncated = true;
        break;
      }

      // Rate limit: exponential backoff
      if (
        errMsg.includes('request limit') ||
        errMsg.includes('-32011') ||
        errMsg.includes('429') ||
        errMsg.includes('rate limit') ||
        errMsg.includes('Too Many Requests')
      ) {
        rateLimitRetries++;
        if (rateLimitRetries > 5) {
          windowTruncated = true;
          break;
        }
        const backoffMs = 2000 * Math.pow(2, rateLimitRetries - 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue; // Retry same chunk
      }

      // Generic RPC failure on this chunk: truncate window rather than failing entire run
      windowTruncated = true;
      break;
    }
  }

  if (earliestBlockReached > fromBlock) {
    windowTruncated = true;
  }

  // Sort logs in chronological order so balance replay and timestamps are accurate
  allLogs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber < b.blockNumber ? -1 : 1;
    }
    return a.logIndex - b.logIndex;
  });

  return {
    logs: allLogs,
    pages,
    windowTruncated,
    earliestBlockReached,
    sourceCalls,
  };
}

// ─── First Inbound Native Transfer ──────────────────────────────────────────────

/**
 * Find the first-ever inbound native ETH transfer to an address.
 * This is used in Stage 3 to determine the gas origin / funder.
 * 
 * Uses eth_getLogs with a scan of the first few blocks of the address's history.
 * Falls back to Alchemy getAssetTransfers if available.
 */
export async function getFirstInboundTransfer(
  client: PublicClient<Transport, Chain>,
  address: `0x${string}`,
  alchemyApiKey?: string
): Promise<{ funder: `0x${string}` | null; block: number; sourceCalls: SourceCall[] }> {
  const sourceCalls: SourceCall[] = [];

  // Use Alchemy if available (much more efficient for this query)
  if (alchemyApiKey) {
    try {
      sourceCalls.push(formatSourceCall('alchemy:getAssetTransfers', `to:${address}:external:asc:1`));
      const response = await retryWithBackoff(async () => {
        const res = await fetch(
          `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'alchemy_getAssetTransfers',
              params: [{
                toAddress: address,
                category: ['external'],
                order: 'asc',
                maxCount: '0x1',
                withMetadata: true,
              }],
            }),
          }
        );
        return res.json();
      });

      const transfers = (response as { result?: { transfers?: Array<{ from: string; blockNum: string }> } })?.result?.transfers;
      if (transfers && transfers.length > 0) {
        return {
          funder: transfers[0].from.toLowerCase() as `0x${string}`,
          block: parseInt(transfers[0].blockNum, 16),
          sourceCalls,
        };
      }
    } catch {
      // Fall through to RPC-based lookup
    }
  }

  // Fallback: scan the address's transaction history via getTransactionCount
  // This is less efficient but works without Alchemy
  sourceCalls.push(formatSourceCall('eth_getTransactionCount', address));

  return {
    funder: null,
    block: 0,
    sourceCalls,
  };
}

// ─── Get Transaction Count (for exogenous activity check) ───────────────────────

export async function getTransactionCount(
  client: PublicClient<Transport, Chain>,
  address: `0x${string}`,
  blockNumber?: bigint
): Promise<{ count: number; sourceCall: SourceCall }> {
  await rateLimiter.acquire();
  const count = await retryWithBackoff(async () => {
    return client.getTransactionCount({
      address,
      blockNumber,
    });
  });

  return {
    count,
    sourceCall: formatSourceCall('eth_getTransactionCount', `${address}:${blockNumber ?? 'latest'}`),
  };
}
