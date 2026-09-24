/**
 * Headcount Engine — Stage 7: Receipt Canonicalization
 * 
 * Generates the deterministic SHA-256 receipt for the run.
 * Crucial for the hackathon requirement that verdicts are cryptographically verifiable.
 */

import { createHash } from 'crypto';
import type { 
  RunContext, 
  HolderSetResult, 
  AcquisitionResult, 
  FundingResult, 
  Signals,
  VerdictObject,
  EvidenceRow,
  Receipt
} from './types';
import { canonicalJSON, getExclusionListVersion } from './utils';

export function stage7GenerateReceipt(
  context: RunContext,
  holderSet: HolderSetResult,
  acquisition: AcquisitionResult,
  funding: FundingResult,
  signals: Signals,
  verdictObj: VerdictObject,
  evidence: EvidenceRow[]
): { receipt: Receipt, canonicalObj: Record<string, unknown> } {
  
  // Build the complete canonical object
  // DO NOT include trace events or narration prose, as those might vary slightly
  // (e.g. LLM temperature or timestamp differences). Only include the deterministic evidence.
  const canonicalObj = {
    token: {
      address: context.token.address,
      name: context.token.name,
      symbol: context.token.symbol,
      decimals: context.token.decimals,
      totalSupply: context.token.totalSupply
    },
    run_bounds: {
      pinned_block: Number(context.pinnedBlock),
      holder_cap: context.config.holderCap,
      window_truncated: holderSet.windowTruncated,
      earliest_block_reached: Number(holderSet.earliestBlockReached)
    },
    engine: {
      commit: context.engineCommit,
      exclusion_list_version: getExclusionListVersion()
    },
    verdict: {
      verdict: verdictObj.verdict,
      effective_holders: verdictObj.effective_holders,
      analysed_holders: verdictObj.analysed_holders,
      total_addresses: verdictObj.total_addresses,
      independence_ratio: verdictObj.independence_ratio,
      supply_coverage: verdictObj.supply_coverage,
      signals: verdictObj.signals,
      unanswered: verdictObj.unanswered,
      probes_spent: verdictObj.probes_spent,
      verdict_before_probes: verdictObj.verdict_before_probes
    },
    evidence: evidence.map(e => ({
      holder: e.holder,
      balance_raw: e.balance_raw,
      supply_share: e.supply_share,
      acquisition: e.acquisition,
      first_tx_block: e.first_tx_block,
      first_funder: e.first_funder,
      funder_class: e.funder_class,
      cluster_id: e.cluster_id,
      exogenous_tx_count: e.exogenous_tx_count,
      last_activity_block: e.last_activity_block
      // Omit source_calls from the hash payload to avoid fragility if API internal retries differ,
      // but they remain in the public evidence row.
    }))
  };

  // Convert to sorted-key JSON string
  const canonicalStr = canonicalJSON(canonicalObj);
  
  // Compute SHA-256 hash
  const hash = createHash('sha256').update(canonicalStr).digest('hex');

  const receipt: Receipt = {
    hash,
    canonical: canonicalStr, // Provide the exact string to allow client-side recomputation
    token: context.token.address,
    pinnedBlock: Number(context.pinnedBlock),
    engineCommit: context.engineCommit,
    exclusionListVersion: getExclusionListVersion(),
    timestamp: new Date().toISOString()
  };

  return { receipt, canonicalObj };
}
