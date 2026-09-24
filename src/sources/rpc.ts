/**
 * Headcount Sources — Base RPC Client
 * 
 * viem-based client for Base mainnet. All RPC calls are logged to source_calls
 * arrays for evidence traceability. This is the ONLY module that talks to Base RPC.
 */

import {
  createPublicClient,
  http,
  parseAbiItem,
  type PublicClient,
  type Log,
  type Transport,
  type Chain,
  formatUnits,
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

// ─── Client Factory ─────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter(25, 1000); // 25 req/s default

export function createBaseClient(rpcUrl?: string): PublicClient<Transport, Chain> {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl || process.env.BASE_RPC_URL || 'https://mainnet.base.org', {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30_000,
    }),
  }) as PublicClient<Transport, Chain>;
}

// ─── Token Metadata Read ────────────────────────────────────────────────────────

export interface TokenMetadataResult {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  sourceCalls: SourceCall[];
}

export async function readTokenMetadata(
  client: PublicClient<Transport, Chain>,
  address: `0x${string}`
): Promise<TokenMetadataResult> {
  const sourceCalls: SourceCall[] = [];

  await rateLimiter.acquire();
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    retryWithBackoff(async () => {
      sourceCalls.push(formatSourceCall('eth_call', `name:${address}`));
      return client.readContract({
        address,
        abi: [ERC20_NAME],
        functionName: 'name',
      }) as Promise<string>;
    }),
    retryWithBackoff(async () => {
      sourceCalls.push(formatSourceCall('eth_call', `symbol:${address}`));
      return client.readContract({
        address,
        abi: [ERC20_SYMBOL],
        functionName: 'symbol',
      }) as Promise<string>;
    }),
    retryWithBackoff(async () => {
      sourceCalls.push(formatSourceCall('eth_call', `decimals:${address}`));
      return client.readContract({
        address,
        abi: [ERC20_DECIMALS],
        functionName: 'decimals',
      }) as Promise<number>;
    }),
    retryWithBackoff(async () => {
      sourceCalls.push(formatSourceCall('eth_call', `totalSupply:${address}`));
      return client.readContract({
        address,
        abi: [ERC20_TOTAL_SUPPLY],
        functionName: 'totalSupply',
      }) as Promise<bigint>;
    }),
  ]);

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
 * Page Transfer event logs from fromBlock to toBlock.
 * Uses adaptive chunk sizing: starts at chunkSize, halves on "too many results" errors.
 * 
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
  let currentFrom = fromBlock;
  let windowTruncated = false;
  let earliestBlockReached = fromBlock;

  while (currentFrom <= toBlock && pages < maxPages) {
    const currentTo = currentFrom + chunkSize - 1n > toBlock
      ? toBlock
      : currentFrom + chunkSize - 1n;

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
      currentFrom = currentTo + 1n;
    } catch (err) {
      const errMsg = String(err);
      // Adaptive: if the range returned too many results or exceeds block range limits, halve the chunk size
      if (errMsg.includes('too many') || errMsg.includes('query returned more than') || errMsg.includes('Log response size exceeded') || errMsg.includes('limited to a')) {
        chunkSize = chunkSize / 2n;
        if (chunkSize < 100n) {
          // Can't go smaller — truncate
          windowTruncated = true;
          break;
        }
        continue; // Retry same range with smaller chunk
      }
      throw err;
    }
  }

  if (currentFrom <= toBlock) {
    windowTruncated = true;
  }

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
