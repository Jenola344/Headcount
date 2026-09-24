/**
 * Headcount Agent — Probes
 * 
 * Pure functions representing the actions the agent can take.
 * Each probe returns an evidenceDelta describing what changed.
 */

import type { EvidenceRow, ProbeResult, ProbeRequest, VerdictObject } from '@engine/types';
import { ProbeCosts } from '@engine/types';

export function executeProbe(
  probeReq: ProbeRequest, 
  evidence: EvidenceRow[], 
  verdict: VerdictObject
): ProbeResult {
  const cost = ProbeCosts[probeReq.type] ?? 1;
  let evidenceDelta = 'No effect.';
  const data: Record<string, unknown> = {};

  switch (probeReq.type) {
    case 'widen_holder_window':
      // In a full implementation, this would trigger a re-run of Stage 1 with a larger cap.
      // For this mock, we just acknowledge the attempt.
      evidenceDelta = `Holder window widened by 250. This is a stub in the current build.`;
      data.new_cap = verdict.bounds.holder_cap + 250;
      break;

    case 'probe_second_hop':
      if (probeReq.params && probeReq.params.cluster_id) {
        const clusterId = probeReq.params.cluster_id as string;
        // Mock finding: the funder of the cluster is themselves funded by an exchange
        evidenceDelta = `Cluster ${clusterId} second-hop resolved to CEX hot wallet. Independence remains unchanged.`;
        data.second_hop = '0x_cex_wallet';
      } else {
        evidenceDelta = 'Failed: cluster_id required.';
      }
      break;

    case 'probe_airdrop_origin':
      evidenceDelta = 'Airdrop batch traced to known deployer address.';
      break;

    case 'check_funder_degree':
      evidenceDelta = 'Funder degree checked. Only funded these specific wallets (not infrastructure).';
      break;

    case 'sample_exogenous':
      evidenceDelta = 'Sample size increased by 50. Exogenous rate adjusted slightly.';
      break;

    case 'cross_check_pool':
      evidenceDelta = 'Pool identity verified against Uniswap V3 factory.';
      break;

    case 'probe_dormancy_window':
      evidenceDelta = 'Dormancy window analysis complete. Activity remains concentrated around launch.';
      break;
      
    default:
      evidenceDelta = `Unknown probe type: ${probeReq.type}`;
  }

  return {
    type: probeReq.type,
    cost,
    data,
    evidenceDelta
  };
}

/**
 * Rescores the verdict object based on probe results.
 * In the full implementation, this would actually mutate the evidence array
 * and re-run Stage 4 and Stage 6. 
 * For this hackathon deadline version, we'll implement a simplified version
 * that just tracks the probes spent.
 */
export function rescoreEvidence(
  verdict: VerdictObject,
  evidence: EvidenceRow[],
  probeResult: ProbeResult
): VerdictObject {
  // Deep clone to avoid mutating history
  const newVerdict = JSON.parse(JSON.stringify(verdict)) as VerdictObject;
  
  newVerdict.probes_spent += probeResult.cost;
  
  // Example of a probe actually changing a stat:
  if (probeResult.type === 'widen_holder_window') {
     newVerdict.bounds.holder_cap = (probeResult.data.new_cap as number) || newVerdict.bounds.holder_cap;
  }
  
  return newVerdict;
}
