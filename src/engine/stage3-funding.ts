/**
 * Headcount Engine — Stage 3: Funding-Graph Resolution
 * 
 * The critical, expensive stage. For each remaining holder:
 * 1. Resolve first-ever inbound native ETH transfer (gas origin)
 * 2. Classify funder against the versioned exclusion list
 * 3. Infrastructure-funded → counts as independent origin
 * 4. Non-infrastructure → cluster by funder address
 * 
 * effective_holders = infra_funded + distinct_non_infra_clusters
 * independence_ratio = effective_holders / analysed_non_dust_holders
 */

import type { PublicClient, Transport, Chain } from 'viem';
import type {
  RunContext,
  HolderBalance,
  FundingResult,
  FundingCluster,
  FunderClass,
  TraceEmitter,
  ExclusionList,
} from './types';
import { batchResolveFirstFunders } from '@sources/alchemy';
import { makeTraceEvent, normalizeAddress } from './utils';
import type { SourceCall } from '@sources/rpc';
import exclusionListData from './exclusion-list.json';

// ─── Load and index the exclusion list ──────────────────────────────────────────

const exclusionList: ExclusionList = exclusionListData as ExclusionList;

const infraAddresses = new Set<string>(
  exclusionList.entries.map(e => normalizeAddress(e.address))
);

export function isInfrastructureAddress(address: string): boolean {
  return infraAddresses.has(normalizeAddress(address));
}

export function getExclusionEntry(address: string) {
  const normalized = normalizeAddress(address);
  return exclusionList.entries.find(e => normalizeAddress(e.address) === normalized);
}

export function getExclusionListVersion(): string {
  return exclusionList.version;
}

// ─── Stage 3: Funding Resolution ────────────────────────────────────────────────

export interface Stage3Output {
  ok: true;
  result: FundingResult;
  sourceCalls: SourceCall[];
}

export interface Stage3Refusal {
  verdict: 'UNVERIFIABLE';
  reason: 'FUNDING_UNRESOLVED';
  detail: string;
  unresolvedCount: number;
  totalAnalysed: number;
  sourceCalls: SourceCall[];
}

export type Stage3Result =
  | Stage3Output
  | { ok: false; refusal: Stage3Refusal };

export async function stage3ResolveFunding(
  client: PublicClient<Transport, Chain>,
  holders: HolderBalance[],
  dustAddresses: Set<string>,
  context: RunContext,
  tracer: TraceEmitter
): Promise<Stage3Result> {
  const sourceCalls: SourceCall[] = [];

  // Filter out dust addresses
  const nonDustHolders = holders.filter(
    h => !dustAddresses.has(normalizeAddress(h.address))
  );

  const addresses = nonDustHolders.map(h => normalizeAddress(h.address));

  // ─── Resolve first funders via Alchemy ───────────────────────────────────
  let funderMap: Map<string, { funder: string; block: number }>;
  let unresolvedAddresses: string[];

  if (context.config.alchemyApiKey) {
    const batchResult = await batchResolveFirstFunders(
      context.config.alchemyApiKey,
      addresses
    );
    funderMap = batchResult.results;
    unresolvedAddresses = batchResult.unresolved;
    sourceCalls.push(...batchResult.sourceCalls);
  } else {
    // Without Alchemy, all are unresolved
    funderMap = new Map();
    unresolvedAddresses = [...addresses];
  }

  // ─── Check unresolved threshold ──────────────────────────────────────────
  const unresolvedRate = unresolvedAddresses.length / nonDustHolders.length;

  if (unresolvedRate > 0.20) {
    const refusal: Stage3Refusal = {
      verdict: 'UNVERIFIABLE',
      reason: 'FUNDING_UNRESOLVED',
      detail: `${unresolvedAddresses.length} of ${nonDustHolders.length} holders (${(unresolvedRate * 100).toFixed(1)}%) have unresolved funding origins. This exceeds the 20% threshold.`,
      unresolvedCount: unresolvedAddresses.length,
      totalAnalysed: nonDustHolders.length,
      sourceCalls,
    };
    tracer.emit(makeTraceEvent('REFUSAL', {
      verdict: refusal.verdict,
      reason: refusal.reason,
      unresolved_count: unresolvedAddresses.length,
      total_analysed: nonDustHolders.length,
    }));
    return { ok: false, refusal };
  }

  // ─── Classify funders and build clusters ─────────────────────────────────
  const holderFunders = new Map<string, {
    funder: string | null;
    funderClass: FunderClass;
    clusterId: string | null;
  }>();

  // Cluster map: funder address -> list of holder addresses
  const nonInfraClusters = new Map<string, string[]>();
  let infraFundedCount = 0;
  let clusterCounter = 0;

  for (const holder of nonDustHolders) {
    const addr = normalizeAddress(holder.address);
    const funderInfo = funderMap.get(addr);

    if (!funderInfo) {
      // Unresolved — mark as such but don't cluster
      holderFunders.set(addr, {
        funder: null,
        funderClass: 'unresolved',
        clusterId: null,
      });
      continue;
    }

    const funder = normalizeAddress(funderInfo.funder);

    if (isInfrastructureAddress(funder)) {
      // Infrastructure-funded: each counts as independent
      infraFundedCount++;
      holderFunders.set(addr, {
        funder,
        funderClass: 'infra',
        clusterId: null,
      });
    } else {
      // Non-infrastructure: cluster by funder
      if (!nonInfraClusters.has(funder)) {
        nonInfraClusters.set(funder, []);
      }
      nonInfraClusters.get(funder)!.push(addr);

      holderFunders.set(addr, {
        funder,
        funderClass: 'non_infra',
        clusterId: null, // Will be set below
      });
    }
  }

  // ─── Build cluster objects ───────────────────────────────────────────────
  const clusters: FundingCluster[] = [];
  let largestClusterSize = 0;

  for (const [funder, members] of nonInfraClusters) {
    const clusterId = `c_${String(clusterCounter++).padStart(2, '0')}`;

    clusters.push({
      id: clusterId,
      funder: funder as `0x${string}`,
      members: members as `0x${string}`[],
      funderClass: 'non_infra',
    });

    // Update cluster IDs on holder funders
    for (const member of members) {
      const info = holderFunders.get(member);
      if (info) {
        info.clusterId = clusterId;
      }
    }

    if (members.length > largestClusterSize) {
      largestClusterSize = members.length;
    }
  }

  // ─── Compute effective holders and independence ratio ────────────────────
  const distinctNonInfraClusters = clusters.length;
  const effectiveHolders = infraFundedCount + distinctNonInfraClusters;
  const analysedNonDust = nonDustHolders.length;
  const independenceRatio = analysedNonDust > 0
    ? effectiveHolders / analysedNonDust
    : 0;

  const result: FundingResult = {
    clusters,
    largestClusterSize,
    infraFunded: infraFundedCount,
    unresolved: unresolvedAddresses.length,
    effectiveHolders,
    independenceRatio,
    holderFunders,
  };

  // ─── Emit trace event ────────────────────────────────────────────────────
  tracer.emit(makeTraceEvent('FUNDING', {
    clusters: clusters.length,
    largest_cluster_size: largestClusterSize,
    infra_funded: infraFundedCount,
    unresolved: unresolvedAddresses.length,
    effective_holders: effectiveHolders,
    independence_ratio: Number(independenceRatio.toFixed(4)),
    exclusion_list_version: exclusionList.version,
    excluded_labels: clusters
      .filter(c => isInfrastructureAddress(c.funder))
      .map(c => getExclusionEntry(c.funder)?.label ?? c.funder),
  }));

  return { ok: true, result, sourceCalls };
}
