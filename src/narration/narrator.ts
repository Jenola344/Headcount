/**
 * Headcount Narration — Main Narrator
 * 
 * Uses Groq to generate a prose diagnosis of the engine's findings.
 * Forces the LLM to adhere to the facts using a strict system prompt
 * and the numeric guard.
 */

import Groq from 'groq-sdk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { VerdictObject, TraceEmitter } from '@engine/types';
import { validateNumerics, extractEvidenceNumbers } from './numeric-guard';
import { getFallbackNarration } from './templates';
import { makeTraceEvent } from '@engine/utils';

const NarrationOutputSchema = z.object({
  narrative: z.string().describe("The prose diagnosis of the token's distribution."),
});

const jsonSchema = zodToJsonSchema(NarrationOutputSchema);

/**
 * Generate a prose narrative explaining the verdict.
 * Will retry up to 3 times if the LLM hallucinates numbers,
 * then falls back to a deterministic template.
 */
export async function narrateRun(
  verdictObj: VerdictObject,
  tokenSymbol: string,
  apiKey: string | undefined,
  tracer: TraceEmitter
): Promise<string> {
  
  if (!apiKey || verdictObj.verdict === 'UNVERIFIABLE') {
    // Save API calls for unverifiable runs or if no key is provided
    const text = getFallbackNarration(verdictObj, tokenSymbol);
    tracer.emit(makeTraceEvent('NARRATION', { source: 'template', guard_rejections: 0 }));
    return text;
  }

  const groq = new Groq({ apiKey });
  const allowedNumbers = extractEvidenceNumbers(verdictObj);
  let rejections = 0;

  const systemPrompt = `
You are Headcount, a deterministic forensics engine. Your job is to summarize the following evidence object into exactly one tight, authoritative paragraph.
DO NOT invent, estimate, or assume any facts. 
DO NOT use any numerals (e.g. 5, 20.3) that do not appear verbatim in the evidence object. If you do, your output will be rejected by a code-level guard.
DO NOT say "SAFE" or "SCAM". State the structure (organic, concentrated, manufactured) based on the evidence.
Keep it under 6 sentences. 
  `.trim();

  const userPrompt = `
Token: ${tokenSymbol}
Evidence Object:
${JSON.stringify(verdictObj, null, 2)}
  `.trim();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: 'llama-3.3-70b-versatile',
        response_format: { 
          type: 'json_schema', 
          json_schema: {
            name: 'narration_output',
            schema: jsonSchema,
            strict: true 
          } 
        } as any,
        temperature: 0.1, // Keep it deterministic
      });

      const content = response.choices[0].message?.content;
      if (!content) throw new Error('Empty response from Groq');

      const parsed = JSON.parse(content);
      const narrative = parsed.narrative as string;

      // The critical numeric guard check
      const guardResult = validateNumerics(narrative, allowedNumbers);
      
      if (guardResult.valid) {
        tracer.emit(makeTraceEvent('NARRATION', { source: 'llm', guard_rejections: rejections }));
        return narrative;
      } else {
        rejections++;
        console.warn(`Numeric guard rejected LLM output. Violations: ${guardResult.violations.join(', ')}`);
        // We could append the violations to the user prompt and retry, but for speed 
        // we'll just try again with the same prompt (temperature might vary it slightly)
      }
      
    } catch (err) {
      console.error(`Narration attempt ${attempt} failed:`, err);
      rejections++;
    }
  }

  // Fallback after 3 failures
  tracer.emit(makeTraceEvent('NARRATION', { source: 'template_fallback', guard_rejections: rejections }));
  return getFallbackNarration(verdictObj, tokenSymbol);
}
