import { describe, it, expect, vi } from 'vitest';
import { ContextBudget } from './context-budget.js';
import type { ContextBudgetConfig, ContextThreshold } from './context-budget.js';
import { assignDeathProfile, calculateAccidentPoint } from './death-profiles.js';
import { birthCitizen } from './citizen-lifecycle.js';
import { CitizenConfigSchema, SimulationParametersSchema } from '../schemas/index.js';
import type { SimulationParameters } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';

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

describe('birthCitizen', () => {
  const defaultParams: SimulationParameters = SimulationParametersSchema.parse({
    seedProblem: 'What is worth preserving?',
  });

  it('returns object matching CitizenConfigSchema', () => {
    const citizen = birthCitizen('builder', 1, defaultParams);
    // Should not throw -- validates against the full schema
    const parsed = CitizenConfigSchema.parse(citizen);
    expect(parsed).toBeDefined();
  });

  it('has provided role and generationNumber', () => {
    const citizen = birthCitizen('skeptic', 3, defaultParams);
    expect(citizen.role).toBe('skeptic');
    expect(citizen.generationNumber).toBe(3);
  });

  it('has id as a non-empty string (nanoid)', () => {
    const citizen = birthCitizen('builder', 1, defaultParams);
    expect(typeof citizen.id).toBe('string');
    expect(citizen.id.length).toBeGreaterThan(0);
  });

  it('has name matching pattern citizen-gen{N}-{suffix}', () => {
    const citizen = birthCitizen('archivist', 2, defaultParams);
    expect(citizen.name).toMatch(/^citizen-gen2-.+$/);
  });

  it('has type equal to lineage-citizen', () => {
    const citizen = birthCitizen('builder', 1, defaultParams);
    expect(citizen.type).toBe('lineage-citizen');
  });

  it('has birthTimestamp as ISO datetime string', () => {
    const citizen = birthCitizen('builder', 1, defaultParams);
    expect(citizen.birthTimestamp).toBeDefined();
    // ISO datetime should parse without error
    const date = new Date(citizen.birthTimestamp);
    expect(date.getTime()).not.toBeNaN();
  });

  it('has systemPrompt as empty string (placeholder for Phase 4)', () => {
    const citizen = birthCitizen('builder', 1, defaultParams);
    expect(citizen.systemPrompt).toBe('');
  });

  it('has contextBudget initialized to 0', () => {
    const citizen = birthCitizen('builder', 1, defaultParams);
    expect(citizen.contextBudget).toBe(0);
  });

  it('has deathProfile that is old-age or accident', () => {
    const citizen = birthCitizen('builder', 2, defaultParams);
    expect(['old-age', 'accident']).toContain(citizen.deathProfile);
  });

  it('always assigns old-age for gen1 when gen1Protection is true', () => {
    const protectedParams = SimulationParametersSchema.parse({
      seedProblem: 'test',
      gen1Protection: true,
      deathProfileDistribution: { 'old-age': 0.0, 'accident': 1.0 },
    });
    for (let i = 0; i < 20; i++) {
      const citizen = birthCitizen('builder', 1, protectedParams);
      expect(citizen.deathProfile).toBe('old-age');
    }
  });

  it('emits citizen:born event with citizenId, role, generationNumber', () => {
    const handler = vi.fn();
    lineageBus.on('citizen:born', handler);
    try {
      const citizen = birthCitizen('observer', 4, defaultParams);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(citizen.id, 'observer', 4);
    } finally {
      lineageBus.removeListener('citizen:born', handler);
    }
  });
});

describe('mortality barrel exports', () => {
  it('re-exports ContextBudget from barrel', async () => {
    const barrel = await import('./index.js');
    expect(barrel.ContextBudget).toBe(ContextBudget);
  });

  it('re-exports assignDeathProfile from barrel', async () => {
    const barrel = await import('./index.js');
    expect(barrel.assignDeathProfile).toBe(assignDeathProfile);
  });

  it('re-exports calculateAccidentPoint from barrel', async () => {
    const barrel = await import('./index.js');
    expect(barrel.calculateAccidentPoint).toBe(calculateAccidentPoint);
  });

  it('re-exports birthCitizen from barrel', async () => {
    const barrel = await import('./index.js');
    expect(barrel.birthCitizen).toBe(birthCitizen);
  });
});
