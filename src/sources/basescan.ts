/**
 * Headcount Sources — Basescan API
 * 
 * Contract metadata, deployment block, verification status.
 * All calls tracked for evidence traceability.
 */

import { retryWithBackoff, RateLimiter } from '@engine/utils';
import { formatSourceCall, type SourceCall } from './rpc';

const basescanLimiter = new RateLimiter(5, 1000); // Basescan free tier: 5 req/s

const BASESCAN_API = 'https://api.basescan.org/api';

// ─── Contract Creation Info ─────────────────────────────────────────────────────

export interface ContractCreationInfo {
  deploymentBlock: bigint;
  deployer: string;
  txHash: string;
}

/**
 * Get the deployment block for a contract by finding its creation transaction.
 */
export async function getContractCreationBlock(
  address: string,
  apiKey?: string
): Promise<{ info: ContractCreationInfo | null; sourceCall: SourceCall }> {
  await basescanLimiter.acquire();

  const sourceCall = formatSourceCall('basescan:getContractCreation', address);
  const key = apiKey || process.env.BASESCAN_API_KEY || '';

  try {
    const result = await retryWithBackoff(async () => {
      const url = `${BASESCAN_API}?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${key}`;
      const res = await fetch(url);
      const json = await res.json() as {
        status: string;
        result?: Array<{ contractAddress: string; contractCreator: string; txHash: string }>;
      };

      if (json.status !== '1' || !json.result || json.result.length === 0) {
        return null;
      }

      return json.result[0];
    });

    if (!result) {
      return { info: null, sourceCall };
    }

    // Now get the transaction receipt to find the block number
    await basescanLimiter.acquire();
    const txResult = await retryWithBackoff(async () => {
      const url = `${BASESCAN_API}?module=proxy&action=eth_getTransactionByHash&txhash=${result.txHash}&apikey=${key}`;
      const res = await fetch(url);
      return res.json() as Promise<{ result?: { blockNumber: string } }>;
    });

    const blockNumber = txResult.result?.blockNumber
      ? BigInt(txResult.result.blockNumber)
      : 0n;

    return {
      info: {
        deploymentBlock: blockNumber,
        deployer: result.contractCreator,
        txHash: result.txHash,
      },
      sourceCall,
    };
  } catch {
    return { info: null, sourceCall };
  }
}

// ─── Contract Verification Status ───────────────────────────────────────────────

export async function isContractVerified(
  address: string,
  apiKey?: string
): Promise<{ verified: boolean; sourceCall: SourceCall }> {
  await basescanLimiter.acquire();

  const sourceCall = formatSourceCall('basescan:getSourceCode', address);
  const key = apiKey || process.env.BASESCAN_API_KEY || '';

  try {
    const result = await retryWithBackoff(async () => {
      const url = `${BASESCAN_API}?module=contract&action=getsourcecode&address=${address}&apikey=${key}`;
      const res = await fetch(url);
      return res.json() as Promise<{
        status: string;
        result?: Array<{ SourceCode: string }>;
      }>;
    });

    const verified = result.result?.[0]?.SourceCode !== '' && result.result?.[0]?.SourceCode !== undefined;
    return { verified, sourceCall };
  } catch {
    return { verified: false, sourceCall };
  }
}

// ─── Token Holder Count (Basescan page scrape fallback) ─────────────────────────

/**
 * Get an approximate holder count from Basescan.
 * This is a supplementary data point, not the engine's own count.
 */
export async function getApproxHolderCount(
  address: string,
  apiKey?: string
): Promise<{ count: number | null; sourceCall: SourceCall }> {
  await basescanLimiter.acquire();

  const sourceCall = formatSourceCall('basescan:tokenHolderCount', address);
  const key = apiKey || process.env.BASESCAN_API_KEY || '';

  try {
    // Basescan doesn't have a direct holder count API on free tier
    // We'll derive total_addresses from our own Transfer log parsing
    return { count: null, sourceCall };
  } catch {
    return { count: null, sourceCall };
  }
}
