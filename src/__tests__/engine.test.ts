import { expect, test, describe, vi } from 'vitest';
import { computeHHI, computeClusterAdjustedHHI, computeBirthDispersion, computeSupplyShare } from '../engine/utils';
import { stage6Adjudicate } from '../engine/stage6-adjudicate';
import type { FundingResult, Signals } from '../engine/types';

describe('Engine Utilities', () => {
  test('computeHHI', () => {
    // Perfect monopoly = 1.0
    expect(computeHHI([1.0])).toBe(1.0);
    // Two equal holders = 0.5
    expect(computeHHI([0.5, 0.5])).toBe(0.5);
    // 100 equal holders = 0.01
    const hundred = Array(100).fill(0.01);
    expect(computeHHI(hundred)).toBeCloseTo(0.01, 5);
  });

  test('computeClusterAdjustedHHI', () => {
    const holderShares = new Map([
      ['0x1', 0.2],
      ['0x2', 0.2],
      ['0x3', 0.1], // Unclustered
    ]);
    const clusters = new Map([
      ['c1', ['0x1', '0x2']], // Merges into 0.4
    ]);
    // Naive HHI: 0.2^2 + 0.2^2 + 0.1^2 = 0.04 + 0.04 + 0.01 = 0.09
    const naive = computeHHI(Array.from(holderShares.values()));
    expect(naive).toBeCloseTo(0.09);

    // Cluster HHI: 0.4^2 + 0.1^2 = 0.16 + 0.01 = 0.17
    const adjusted = computeClusterAdjustedHHI(holderShares, clusters);
    expect(adjusted).toBeCloseTo(0.17);
  });

  test('computeBirthDispersion', () => {
    // 86,400 blocks is the 48h window.
    
    // All in same window
    expect(computeBirthDispersion([1000, 2000, 80000])).toBe(1.0);
    
    // Spread out evenly over long time
    expect(computeBirthDispersion([100, 100000, 200000, 300000])).toBe(0.25);
    
    // Dense cluster
    const blocks = [
      100, 200, 300, 400, // 4 in window 1
      200000,             // outside
      300000, 300100      // 2 in window 2
    ];
    // Max in 48h window should be 4 out of 7
    expect(computeBirthDispersion(blocks)).toBeCloseTo(4/7);
  });
  
  test('computeSupplyShare', () => {
    const supply = 1_000_000n * 10n**18n; // 1M tokens with 18 decimals
    
    // 500k tokens
    expect(computeSupplyShare(500_000n * 10n**18n, supply)).toBe(0.5);
    
    // 10k tokens
    expect(computeSupplyShare(10_000n * 10n**18n, supply)).toBe(0.01);
    
    // Dust
    expect(computeSupplyShare(1n * 10n**18n, supply)).toBe(0.000001);
  });
});

describe('Stage 6: Adjudicate', () => {
  const mockTracer = { emit: vi.fn(), getEvents: vi.fn() };
  
  const defaultFunding: FundingResult = {
    clusters: [],
    largestClusterSize: 10,
    infraFunded: 50,
    unresolved: 0,
    effectiveHolders: 50,
    independenceRatio: 0.5, // 50 / 100
    holderFunders: new Map()
  };
  
  const defaultSignals: Signals = {
    birth_dispersion: 0.3,
    exogenous_rate: 0.5,
    naive_hhi: 0.05,
    cluster_adjusted_hhi: 0.06,
    dormancy_rate: 0.2,
    median_hold_age: 10000
  };

  test('Rule 1: UNVERIFIABLE on thin coverage', () => {
    const verdict = stage6Adjudicate(
      0.39, // < 0.40
      0.0,
      defaultFunding,
      defaultSignals,
      100,
      mockTracer
    );
    expect(verdict).toBe('UNVERIFIABLE');
  });

  test('Rule 1: UNVERIFIABLE on high unresolved rate', () => {
    const verdict = stage6Adjudicate(
      0.80,
      0.21, // > 0.20
      defaultFunding,
      defaultSignals,
      100,
      mockTracer
    );
    expect(verdict).toBe('UNVERIFIABLE');
  });

  test('Rule 2: MANUFACTURED on single massive non-infra cluster', () => {
    const funding = { ...defaultFunding, largestClusterSize: 26 }; // > 25% of 100
    const verdict = stage6Adjudicate(0.80, 0, funding, defaultSignals, 100, mockTracer);
    expect(verdict).toBe('MANUFACTURED');
  });

  test('Rule 3: MANUFACTURED on highly coordinated birth + low external use', () => {
    const signals = { ...defaultSignals, birth_dispersion: 0.61, exogenous_rate: 0.29 };
    const verdict = stage6Adjudicate(0.80, 0, defaultFunding, signals, 100, mockTracer);
    expect(verdict).toBe('MANUFACTURED');
  });

  test('Rule 4: MANUFACTURED on very low independence ratio', () => {
    const funding = { ...defaultFunding, independenceRatio: 0.39 }; // < 0.40
    const verdict = stage6Adjudicate(0.80, 0, funding, defaultSignals, 100, mockTracer);
    expect(verdict).toBe('MANUFACTURED');
  });

  test('Rule 5: CONCENTRATED on moderate independence', () => {
    const funding = { ...defaultFunding, independenceRatio: 0.79 }; // < 0.80
    // Make sure we don't trigger rule 3
    const signals = { ...defaultSignals, birth_dispersion: 0.1, exogenous_rate: 0.9 };
    const verdict = stage6Adjudicate(0.80, 0, funding, signals, 100, mockTracer);
    expect(verdict).toBe('CONCENTRATED');
  });

  test('Rule 6: ORGANIC on high independence + high external use', () => {
    const funding = { ...defaultFunding, independenceRatio: 0.85 }; // >= 0.80
    const signals = { ...defaultSignals, exogenous_rate: 0.55 }; // >= 0.50
    const verdict = stage6Adjudicate(0.80, 0, funding, signals, 100, mockTracer);
    expect(verdict).toBe('ORGANIC');
  });
});
