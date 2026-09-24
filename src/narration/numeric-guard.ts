/**
 * Headcount Narration — Numeric Guard
 * 
 * Extracts every numeral from LLM-generated prose and verifies it appears
 * verbatim in the run's evidence JSON. This ensures the LLM never hallucinates
 * a metric. If any number is unmatched, the generation is rejected.
 */

export interface GuardResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validates that every number in the text exists in the allowed values set.
 * 
 * @param text The LLM generated prose
 * @param allowedValues Set of all numeric values from the run's evidence, as strings
 */
export function validateNumerics(text: string, allowedValues: Set<string>): GuardResult {
  const violations: string[] = [];

  // Regex to extract all numbers from text. 
  // Matches integers, decimals, and comma-separated thousands (e.g. 4,200, 81.3, 250, 0.176)
  // Ignoring percentages symbol, just capturing the number itself.
  const numberRegex = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/g;
  
  let match;
  while ((match = numberRegex.exec(text)) !== null) {
    let numStr = match[0];
    
    // Remove commas for standardizing
    numStr = numStr.replace(/,/g, '');
    
    // Allow single digits (0-9) to pass freely (e.g. "We found 1 cluster") 
    // to prevent over-aggressive rejection of basic grammar
    if (numStr.length === 1 && !numStr.includes('.')) {
        continue;
    }

    if (!allowedValues.has(numStr)) {
      violations.push(match[0]); // Push the original string for error reporting
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Flattens an evidence object into a Set of stringified numbers.
 * This is used to build the allowedValues set for the guard.
 */
export function extractEvidenceNumbers(evidenceObj: unknown): Set<string> {
  const values = new Set<string>();

  function traverse(obj: unknown) {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj === 'number') {
      // Add standard string representation
      values.add(obj.toString());
      
      // Also add common formatted representations (e.g. percentages, rounded)
      values.add(obj.toFixed(1));
      values.add(obj.toFixed(2));
      values.add(obj.toFixed(3));
      values.add(obj.toFixed(4));
      
      // If it's a ratio, also add the percentage equivalent (e.g. 0.176 -> 17.6)
      if (obj >= 0 && obj <= 1) {
        const pct = obj * 100;
        values.add(pct.toString());
        values.add(pct.toFixed(1));
        values.add(pct.toFixed(2));
      }
    } else if (typeof obj === 'string') {
        // Try parsing string as number (e.g. bigints stored as strings)
        if (/^\d+$/.test(obj)) {
            values.add(obj);
        }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        traverse(item);
      }
    } else if (typeof obj === 'object') {
      for (const val of Object.values(obj as Record<string, unknown>)) {
        traverse(val);
      }
    }
  }

  traverse(evidenceObj);
  return values;
}
