/**
 * Headcount Engine — Stage 6: Adjudicate
 * 
 * The deterministic decision table from §7.2 of the brief.
 * The model has zero input into this stage.
 */

import type { Verdict, Signals, FundingResult } from './types';
import type { TraceEmitter } from './types';
import { makeTraceEvent } from './utils';

export function stage6Adjudicate(
  supplyCoverage: number,
  unresolvedRate: number,
  funding: FundingResult,
  signals: Signals,
  analysedHolders: number,
  tracer: TraceEmitter
): Verdict {
  let verdict: Verdict = 'CONCENTRATED'; // Fallback
  let matchedRule = 0;

  const largestNonInfraShare = analysedHolders > 0 
    ? funding.largestClusterSize / analysedHolders 
    : 0;

  const hhiDelta = signals.cluster_adjusted_hhi - signals.naive_hhi;

  // Rule 1: Coverage or Resolution too low
  if (supplyCoverage < 0.40 || unresolvedRate > 0.20) {
    verdict = 'UNVERIFIABLE';
    matchedRule = 1;
  }
  // Rule 2: Single massive non-infra cluster
  else if (largestNonInfraShare > 0.25) {
    verdict = 'MANUFACTURED';
    matchedRule = 2;
  }
  // Rule 3: Highly coordinated birth + low external use
  else if (signals.birth_dispersion > 0.60 && signals.exogenous_rate < 0.30) {
    verdict = 'MANUFACTURED';
    matchedRule = 3;
  }
  // Rule 4: Very low independence ratio
  else if (funding.independenceRatio < 0.40) {
    verdict = 'MANUFACTURED';
    matchedRule = 4;
  }
  // Rule 5: Moderate independence OR large hidden concentration
  else if (funding.independenceRatio < 0.80 || hhiDelta > 0.15) {
    verdict = 'CONCENTRATED';
    matchedRule = 5;
  }
  // Rule 6: High independence AND high external use
  else if (funding.independenceRatio >= 0.80 && signals.exogenous_rate >= 0.50) {
    verdict = 'ORGANIC';
    matchedRule = 6;
  }
  // Rule 7: Default fallback
  else {
    verdict = 'CONCENTRATED';
    matchedRule = 7;
  }

  tracer.emit(makeTraceEvent('VERDICT', {
    verdict,
    matched_rule: matchedRule,
    largest_cluster_share: Number(largestNonInfraShare.toFixed(4)),
    hhi_delta: Number(hhiDelta.toFixed(4)),
  }));

  return verdict;
}
