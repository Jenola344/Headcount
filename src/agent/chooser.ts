/**
 * Headcount Agent — Chooser
 * 
 * Uses Groq to select the next probe from the menu based on current evidence.
 */

import Groq from 'groq-sdk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ProbeType, type ProbeRequest, type VerdictObject } from '@engine/types';

type JsonSchemaResponseFormat = {
  type: 'json_schema';
  json_schema: {
    name: string;
    schema: ReturnType<typeof zodToJsonSchema>;
    strict: true;
  };
};

const ChooserOutputSchema = z.object({
  stop: z.boolean().describe("Set to true if no further probes are needed or budget is too low."),
  probe: ProbeType.nullable().describe("The selected probe from the menu, or null if stopping."),
  reason: z.string().describe("One sentence explaining why this probe was chosen or why stopping."),
  params: z.record(z.unknown()).optional().describe("Parameters required for the selected probe (e.g. cluster_id)."),
});

const jsonSchema = zodToJsonSchema(ChooserOutputSchema);

export async function chooseProbe(
  verdict: VerdictObject,
  budgetRemaining: number,
  apiKey: string | undefined
): Promise<{ stop: boolean; request?: ProbeRequest; reason: string }> {
  
  if (!apiKey || budgetRemaining <= 0) {
    return { stop: true, reason: 'Budget exhausted or no API key available.' };
  }

  const groq = new Groq({ apiKey });

  const systemPrompt = `
You are the Agent loop of Headcount, a token forensics engine.
You are given the current verdict object and a probe budget.
Your job is to select exactly one probe to run to investigate the token's distribution further, or choose to stop if the verdict is solid.

Available Probes:
- probe_second_hop (cost 2): Use if a large cluster exists and you want to check its funder's origin. Params: { cluster_id: string }
- widen_holder_window (cost 3): Use if independence is high but supply_coverage is thin.
- probe_airdrop_origin (cost 1): Use if airdrop share is high.
- check_funder_degree (cost 1): Use to verify if an unknown funder might be infrastructure. Params: { address: string }
- sample_exogenous (cost 2): Use to deepen the exogenous sample if rate is borderline.
- cross_check_pool (cost 1): Use to verify pool identity.
- probe_dormancy_window (cost 1): Use if dormancy rate is borderline.

Current Budget Remaining: ${budgetRemaining}
Do not choose a probe that costs more than your remaining budget.
  `.trim();

  const userPrompt = `
Current Evidence:
${JSON.stringify(verdict, null, 2)}
  `.trim();

  try {
    const request = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: {
        type: 'json_schema', 
        json_schema: {
          name: 'chooser_output',
          schema: jsonSchema,
          strict: true 
        } 
      } satisfies JsonSchemaResponseFormat,
      temperature: 0.1,
    } as unknown as Parameters<typeof groq.chat.completions.create>[0];
    const response = await groq.chat.completions.create(request);

    const content = 'choices' in response ? response.choices[0].message?.content : null;
    if (!content) throw new Error('Empty response from Groq');

    const parsed = ChooserOutputSchema.parse(JSON.parse(content));
    
    if (parsed.stop || !parsed.probe) {
      return { stop: true, reason: parsed.reason };
    }

    return {
      stop: false,
      reason: parsed.reason,
      request: {
        type: parsed.probe,
        reason: parsed.reason,
        params: parsed.params,
      }
    };
  } catch (err) {
    console.error(`Probe chooser failed:`, err);
    // On failure, safe fallback is to stop
    return { stop: true, reason: 'LLM chooser failed.' };
  }
}
