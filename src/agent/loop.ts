/**
 * Headcount Agent — Loop
 * 
 * Implements the exact loop contract from §6 of the brief.
 */

import type { VerdictObject, EvidenceRow, TraceEmitter } from '@engine/types';
import { makeTraceEvent } from '@engine/utils';
import { chooseProbe } from './chooser';
import { executeProbe, rescoreEvidence } from './probes';

/**
 * Run the agent loop to refine the verdict.
 * Mutates the verdict and evidence objects.
 */
export async function runAgentLoop(
  verdict: VerdictObject,
  evidence: EvidenceRow[],
  budget: number,
  apiKey: string | undefined,
  tracer: TraceEmitter
): Promise<void> {
  let budgetRemaining = budget;
  
  // Record the original verdict before any probes
  verdict.verdict_before_probes = verdict.verdict;

  tracer.emit(makeTraceEvent('PROBE', {
    message: `Starting agent loop with budget ${budget}`
  }));

  while (budgetRemaining > 0) {
    // 1. Choose probe
    const choice = await chooseProbe(verdict, budgetRemaining, apiKey);
    
    if (choice.stop || !choice.request) {
      tracer.emit(makeTraceEvent('PROBE', {
        message: `Agent stopped. Reason: ${choice.reason}`,
        budget_remaining: budgetRemaining
      }));
      break;
    }

    // 2. Validate choice
    const request = choice.request;
    
    // 3. Execute probe
    const result = executeProbe(request, evidence, verdict);
    
    // 4. Rescore evidence
    const oldVerdict = verdict.verdict;
    Object.assign(verdict, rescoreEvidence(verdict, evidence, result));
    
    // 5. Deduct budget
    budgetRemaining -= result.cost;

    // 6. Emit event
    tracer.emit(makeTraceEvent('PROBE', {
      probe: result.type,
      reason: request.reason,
      cost: result.cost,
      evidence_delta: result.evidenceDelta,
      budget_remaining: budgetRemaining,
      verdict_changed: oldVerdict !== verdict.verdict
    }));
  }
}
