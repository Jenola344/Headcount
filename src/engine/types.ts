/**
 * Headcount Engine — Core Types
 * 
 * Every type in this file maps to a schema in the brief (§8).
 * Zod schemas are the source of truth; TypeScript types are inferred from them.
 */

import { z } from 'zod';

// ─── Ethereum Primitives ───────────────────────────────────────────────────────

export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
export type Address = z.infer<typeof AddressSchema>;

export const HexStringSchema = z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex string');

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const AcquisitionClass = z.enum(['bought', 'airdropped', 'dusted', 'transferred']);
export type AcquisitionClass = z.infer<typeof AcquisitionClass>;

export const FunderClass = z.enum(['infra', 'non_infra', 'unresolved']);
export type FunderClass = z.infer<typeof FunderClass>;

export const Verdict = z.enum(['ORGANIC', 'CONCENTRATED', 'MANUFACTURED', 'UNVERIFIABLE']);
export type Verdict = z.infer<typeof Verdict>;

export const RefusalReason = z.enum([
  'CONTRACT_UNREADABLE',
  'COVERAGE_TOO_THIN',
  'FUNDING_UNRESOLVED',
  'NOT_A_TOKEN',
]);
export type RefusalReason = z.infer<typeof RefusalReason>;

// ─── Evidence Row (§8) ─────────────────────────────────────────────────────────

export const EvidenceRowSchema = z.object({
  holder: AddressSchema,
  balance_raw: z.string(),          // BigInt as string
  supply_share: z.number(),
  acquisition: AcquisitionClass,
  first_tx_block: z.number(),
  first_funder: AddressSchema.nullable(),
  funder_class: FunderClass,
  cluster_id: z.string().nullable(),
  exogenous_tx_count: z.number(),
  last_activity_block: z.number(),
  source_calls: z.array(z.string()), // Mandatory: every row must trace to a real API call
});
export type EvidenceRow = z.infer<typeof EvidenceRowSchema>;

// ─── Signals ───────────────────────────────────────────────────────────────────

export const SignalsSchema = z.object({
  birth_dispersion: z.number(),     // Share created in densest 48h window
  exogenous_rate: z.number(),       // Share with ≥1 tx unrelated to this token
  naive_hhi: z.number(),            // HHI before cluster merging
  cluster_adjusted_hhi: z.number(), // HHI after cluster merging
  dormancy_rate: z.number(),        // Share with zero activity since acquisition
  median_hold_age: z.number(),      // Median blocks since acquisition
});
export type Signals = z.infer<typeof SignalsSchema>;

// ─── Verdict Object (§8) ───────────────────────────────────────────────────────

export const BoundsSchema = z.object({
  holder_cap: z.number(),
  window_truncated: z.boolean(),
  earliest_block_reached: z.number().optional(),
});

export const VerdictObjectSchema = z.object({
  verdict: Verdict,
  confidence_basis: z.literal('deterministic'),
  effective_holders: z.number(),
  analysed_holders: z.number(),
  total_addresses: z.number(),
  independence_ratio: z.number(),
  supply_coverage: z.number(),
  signals: SignalsSchema,
  bounds: BoundsSchema,
  unanswered: z.array(z.string()),
  probes_spent: z.number(),
  verdict_before_probes: Verdict.nullable(),
  refusal_reason: RefusalReason.nullable().optional(),
});
export type VerdictObject = z.infer<typeof VerdictObjectSchema>;

// ─── Trace Events ──────────────────────────────────────────────────────────────

export const TraceEventType = z.enum([
  'RUN_OPENED',
  'HOLDER_SET',
  'ACQUISITION',
  'FUNDING',
  'SIGNALS',
  'PROBE',
  'VERDICT',
  'RECEIPT',
  'NARRATION',
  'ERROR',
  'REFUSAL',
]);
export type TraceEventType = z.infer<typeof TraceEventType>;

export const TraceEventSchema = z.object({
  type: TraceEventType,
  timestamp: z.string(),
  data: z.record(z.unknown()),
});
export type TraceEvent = z.infer<typeof TraceEventSchema>;

// ─── Token Metadata ────────────────────────────────────────────────────────────

/**
 * Metadata field unavailability — recorded when name(), symbol(), or decimals() reverts.
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

/** Resolve a MetadataField to its value, or return a fallback if unavailable. */
export function resolveMetadata<T>(field: MetadataField<T>, fallback: T): T {
  return isMetadataAvailable(field) ? field : fallback;
}

export const TokenMetadataSchema = z.object({
  address: AddressSchema,
  name: z.union([z.string(), z.object({ status: z.literal('UNAVAILABLE'), error: z.string() })]),
  symbol: z.union([z.string(), z.object({ status: z.literal('UNAVAILABLE'), error: z.string() })]),
  decimals: z.union([z.number(), z.object({ status: z.literal('UNAVAILABLE'), error: z.string() })]),
  totalSupply: z.string(), // BigInt as string
});
export type TokenMetadata = z.infer<typeof TokenMetadataSchema>;


// ─── Run Context ───────────────────────────────────────────────────────────────

export interface RunConfig {
  tokenAddress: Address;
  holderCap: number;
  probeBudget: number;
  rpcUrl: string;
  alchemyApiKey?: string;
  basescanApiKey?: string;
  groqApiKey?: string;
  pinnedBlock?: bigint; // If provided, use this block; otherwise pin at runtime
}

export interface RunContext {
  config: RunConfig;
  token: TokenMetadata;
  pinnedBlock: bigint;
  engineCommit: string;
  startedAt: string;
}

// ─── Holder Set ────────────────────────────────────────────────────────────────

export interface HolderBalance {
  address: Address;
  balance: bigint;
  supplyShare: number;
}

export interface HolderSetResult {
  totalAddresses: number;
  analysed: number;
  supplyCoverage: number;
  logPages: number;
  windowTruncated: boolean;
  earliestBlockReached: bigint;
  holders: HolderBalance[];
}

// ─── Acquisition Result ────────────────────────────────────────────────────────

export interface AcquisitionResult {
  bought: number;
  airdropped: number;
  dusted: number;
  transferred: number;
  classifications: Map<Address, AcquisitionClass>;
  dustAddresses: Set<Address>;
}

// ─── Funding Result ────────────────────────────────────────────────────────────

export interface FundingCluster {
  id: string;
  funder: Address;
  members: Address[];
  funderClass: 'infra' | 'non_infra';
}

export interface FundingResult {
  clusters: FundingCluster[];
  largestClusterSize: number;
  infraFunded: number;
  unresolved: number;
  effectiveHolders: number;
  independenceRatio: number;
  holderFunders: Map<Address, { funder: Address | null; funderClass: FunderClass; clusterId: string | null }>;
}

// ─── Probe Types ───────────────────────────────────────────────────────────────

export const ProbeType = z.enum([
  'probe_second_hop',
  'widen_holder_window',
  'probe_airdrop_origin',
  'check_funder_degree',
  'sample_exogenous',
  'cross_check_pool',
  'probe_dormancy_window',
]);
export type ProbeType = z.infer<typeof ProbeType>;

export const ProbeCosts: Record<ProbeType, number> = {
  probe_second_hop: 2,
  widen_holder_window: 3,
  probe_airdrop_origin: 1,
  check_funder_degree: 1,
  sample_exogenous: 2,
  cross_check_pool: 1,
  probe_dormancy_window: 1,
};

export interface ProbeRequest {
  type: ProbeType;
  reason: string;
  params?: Record<string, unknown>;
}

export interface ProbeResult {
  type: ProbeType;
  cost: number;
  data: Record<string, unknown>;
  evidenceDelta: string;
}

// ─── Receipt ───────────────────────────────────────────────────────────────────

export interface Receipt {
  hash: string;        // SHA-256 of canonical JSON
  canonical: string;   // The sorted-key JSON that was hashed
  token: Address;
  pinnedBlock: number;
  engineCommit: string;
  exclusionListVersion: string;
  timestamp: string;
}

// ─── Full Run Output ───────────────────────────────────────────────────────────

export interface RunOutput {
  context: RunContext;
  holderSet: HolderSetResult;
  acquisition: AcquisitionResult;
  funding: FundingResult;
  signals: Signals;
  verdict: VerdictObject;
  receipt: Receipt;
  evidence: EvidenceRow[];
  narration: string;
  traceEvents: TraceEvent[];
}

// ─── Exclusion List Entry ──────────────────────────────────────────────────────

export const ExclusionEntrySchema = z.object({
  address: AddressSchema,
  label: z.string(),
  category: z.enum(['cex', 'bridge', 'bundler', 'paymaster', 'router', 'faucet', 'deployer']),
  source: z.string(),
  added_date: z.string(),
});
export type ExclusionEntry = z.infer<typeof ExclusionEntrySchema>;

export const ExclusionListSchema = z.object({
  version: z.string(),
  updated: z.string(),
  entries: z.array(ExclusionEntrySchema),
});
export type ExclusionList = z.infer<typeof ExclusionListSchema>;

// ─── Event Emitter Interface ───────────────────────────────────────────────────

export interface TraceEmitter {
  emit(event: TraceEvent): void;
  getEvents(): TraceEvent[];
}
