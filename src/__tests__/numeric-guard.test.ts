import { expect, test, describe } from 'vitest';
import { validateNumerics, extractEvidenceNumbers } from '../narration/numeric-guard';

describe('Numeric Guard', () => {
  const evidenceObj = {
    verdict: 'MANUFACTURED',
    effective_holders: 44,
    analysed_holders: 250,
    total_addresses: 4200,
    independence_ratio: 0.176,
    supply_coverage: 0.813,
  };

  const allowedNumbers = extractEvidenceNumbers(evidenceObj);

  test('extractEvidenceNumbers extracts permutations', () => {
    expect(allowedNumbers.has('44')).toBe(true);
    expect(allowedNumbers.has('250')).toBe(true);
    expect(allowedNumbers.has('4200')).toBe(true);
    expect(allowedNumbers.has('0.176')).toBe(true);
    expect(allowedNumbers.has('17.6')).toBe(true); // Percentage form
    expect(allowedNumbers.has('0.813')).toBe(true);
    expect(allowedNumbers.has('81.3')).toBe(true); // Percentage form
  });

  test('Passes valid text', () => {
    const text = 'Claims 4,200 holders. Analysed: top 250 by balance (81.3% of supply). Effective holders: 44. Independence ratio: 0.176.';
    const result = validateNumerics(text, allowedNumbers);
    expect(result.valid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  test('Fails on fabricated number (The requested test from brief)', () => {
    // Plant a false figure: 99 instead of 44
    const text = 'Claims 4,200 holders. Analysed: top 250 by balance. Effective holders: 99.';
    const result = validateNumerics(text, allowedNumbers);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('99');
  });
  
  test('Fails on hallucinated percentage', () => {
    // Plant a false percentage: 95.5% instead of 81.3%
    const text = 'We analysed 95.5% of the supply.';
    const result = validateNumerics(text, allowedNumbers);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('95.5');
  });

  test('Ignores single digits', () => {
    const text = 'We found 1 major cluster among the 4,200 addresses.';
    const result = validateNumerics(text, allowedNumbers);
    expect(result.valid).toBe(true);
  });
});
