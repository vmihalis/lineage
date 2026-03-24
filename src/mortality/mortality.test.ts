import { describe, it, expect } from 'vitest';
import { ContextBudget } from './context-budget.js';
import type { ContextBudgetConfig, ContextThreshold } from './context-budget.js';
import { assignDeathProfile, calculateAccidentPoint } from './death-profiles.js';

describe('ContextBudget', () => {
  it('calculates effectiveCapacity with safety buffer', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [],
    });
    expect(budget.effectiveCapacity).toBe(80_000);
  });

  it('calculates percentage after update', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [],
    });
    budget.update(5000, 1000);
    expect(budget.percentage).toBeCloseTo(6000 / 80_000, 10);
  });

  it('clamps percentage to 1.0 maximum', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [],
    });
    // Consume more than effective capacity
    budget.update(90_000, 0);
    expect(budget.percentage).toBe(1.0);
  });

  it('calculates remainingTokens correctly', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [],
    });
    budget.update(30_000, 0);
    expect(budget.remainingTokens).toBe(50_000);
  });

  it('remainingTokens never goes below 0', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [],
    });
    budget.update(100_000, 0);
    expect(budget.remainingTokens).toBe(0);
  });

  it('triggers threshold callback when percentage crosses level', () => {
    const triggered: ContextThreshold[] = [];
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [{ percentage: 0.5, label: 'halfway' }],
    });
    // Push past 50%
    const result = budget.update(50_000, 0);
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe('halfway');
  });

  it('does not trigger the same threshold twice', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [{ percentage: 0.5, label: 'halfway' }],
    });
    budget.update(50_000, 0); // triggers
    const result = budget.update(10_000, 0); // should not trigger again
    expect(result).toHaveLength(0);
  });

  it('triggers multiple thresholds in order when a single update crosses several', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [
        { percentage: 0.25, label: 'quarter' },
        { percentage: 0.5, label: 'halfway' },
        { percentage: 0.75, label: 'three-quarters' },
      ],
    });
    // Jump from 0% to ~75%
    const result = budget.update(60_000, 0);
    expect(result).toHaveLength(3);
    expect(result[0]!.label).toBe('quarter');
    expect(result[1]!.label).toBe('halfway');
    expect(result[2]!.label).toBe('three-quarters');
  });

  it('zero safety buffer means effectiveCapacity equals contextWindow', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0,
      thresholds: [],
    });
    expect(budget.effectiveCapacity).toBe(100_000);
  });

  it('reset() clears consumedTokens and triggeredThresholds', () => {
    const budget = new ContextBudget({
      contextWindow: 100_000,
      safetyBuffer: 0.2,
      thresholds: [{ percentage: 0.5, label: 'halfway' }],
    });
    budget.update(50_000, 0);
    expect(budget.percentage).toBeGreaterThan(0);
    budget.reset();
    expect(budget.percentage).toBe(0);
    expect(budget.remainingTokens).toBe(80_000);
    // Threshold should trigger again after reset
    const result = budget.update(50_000, 0);
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe('halfway');
  });
});

describe('assignDeathProfile', () => {
  it('returns old-age when distribution is 100% old-age', () => {
    for (let i = 0; i < 20; i++) {
      const result = assignDeathProfile(
        { 'old-age': 1.0, 'accident': 0.0 },
        2,
        false,
      );
      expect(result).toBe('old-age');
    }
  });

  it('returns accident when distribution is 100% accident', () => {
    for (let i = 0; i < 20; i++) {
      const result = assignDeathProfile(
        { 'old-age': 0.0, 'accident': 1.0 },
        2,
        false,
      );
      expect(result).toBe('accident');
    }
  });

  it('returns old-age for gen1 when gen1Protection is true regardless of distribution', () => {
    for (let i = 0; i < 20; i++) {
      const result = assignDeathProfile(
        { 'old-age': 0.0, 'accident': 1.0 },
        1,
        true,
      );
      expect(result).toBe('old-age');
    }
  });

  it('respects distribution for gen1 when gen1Protection is false', () => {
    // With 100% accident and no protection, gen1 should get accident
    for (let i = 0; i < 20; i++) {
      const result = assignDeathProfile(
        { 'old-age': 0.0, 'accident': 1.0 },
        1,
        false,
      );
      expect(result).toBe('accident');
    }
  });

  it('respects distribution for gen2+ when gen1Protection is true', () => {
    // With 100% accident and gen2, protection shouldn't apply
    for (let i = 0; i < 20; i++) {
      const result = assignDeathProfile(
        { 'old-age': 0.0, 'accident': 1.0 },
        2,
        true,
      );
      expect(result).toBe('accident');
    }
  });

  it('always returns a valid DeathProfile type', () => {
    const validProfiles = ['old-age', 'accident'];
    for (let i = 0; i < 50; i++) {
      const result = assignDeathProfile(
        { 'old-age': 0.5, 'accident': 0.5 },
        3,
        false,
      );
      expect(validProfiles).toContain(result);
    }
  });
});

describe('calculateAccidentPoint', () => {
  it('returns a number between 0.3 and 0.7 inclusive', () => {
    for (let i = 0; i < 100; i++) {
      const point = calculateAccidentPoint();
      expect(point).toBeGreaterThanOrEqual(0.3);
      expect(point).toBeLessThanOrEqual(0.7);
    }
  });

  it('is not deterministic (produces varying values)', () => {
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) {
      values.add(calculateAccidentPoint());
    }
    // With 100 random calls in [0.3, 0.7], we expect many distinct values
    expect(values.size).toBeGreaterThan(1);
  });
});
