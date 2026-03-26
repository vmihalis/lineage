/**
 * Display module tests.
 *
 * EVNT-02: Event formatters -- pure functions return strings with expected content
 * EVNT-03: Generation summary -- cli-table3 table builder
 * EVNT-01: Event type verification -- lineageBus accepts all required events
 */

import { describe, it, expect } from 'vitest';
import {
  formatBirth,
  formatDeath,
  formatTransmission,
  formatMutation,
  formatGenerationStart,
  formatGenerationEnd,
  formatInheritance,
  formatSimulationStart,
  formatSimulationEnd,
  COLORS,
} from './formatters.js';
import {
  buildGenerationSummary,
  createGenerationDisplayState,
} from './generation-summary.js';
import type { GenerationDisplayState, DisplayCitizen } from './generation-summary.js';
import { lineageBus } from '../events/index.js';

/**
 * Strip ANSI escape codes for content assertions.
 * Chalk may or may not colorize depending on terminal detection.
 */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1B\[[0-9;]*m/g, '');
}

describe('EVNT-02: Event formatters', () => {
  const citizenId = 'abcdef1234567890';
  const transmissionId = 'tx-98765432abcdef';

  it('formatBirth includes citizen short ID and role', () => {
    const result = formatBirth(citizenId, 'builder', 1);
    const plain = stripAnsi(result);
    expect(plain).toContain('abcdef12');
    expect(plain).toContain('builder');
    expect(plain).toContain('gen 1');
  });

  it('formatDeath includes citizen short ID and death profile', () => {
    const result = formatDeath(citizenId, 'old-age', 2);
    const plain = stripAnsi(result);
    expect(plain).toContain('abcdef12');
    expect(plain).toContain('old-age');
    expect(plain).toContain('gen 2');
  });

  it('formatTransmission includes citizen and transmission short IDs', () => {
    const result = formatTransmission(citizenId, transmissionId);
    const plain = stripAnsi(result);
    expect(plain).toContain('abcdef12');
    expect(plain).toContain('tx-98765');
  });

  it('formatMutation includes transmission short ID and mutation type', () => {
    const result = formatMutation(transmissionId, 'small');
    const plain = stripAnsi(result);
    expect(plain).toContain('tx-98765');
    expect(plain).toContain('small');
  });

  it('formatGenerationStart includes generation number and citizen count', () => {
    const result = formatGenerationStart(3, 5);
    const plain = stripAnsi(result);
    expect(plain).toContain('Generation 3');
    expect(plain).toContain('5 citizens');
  });

  it('formatGenerationEnd includes generation number', () => {
    const result = formatGenerationEnd(3);
    const plain = stripAnsi(result);
    expect(plain).toContain('Generation 3');
    expect(plain).toContain('complete');
  });

  it('formatInheritance includes generation number and layer count', () => {
    const result = formatInheritance(2, 3);
    const plain = stripAnsi(result);
    expect(plain).toContain('gen 2');
    expect(plain).toContain('3 layers');
  });

  it('formatSimulationStart includes seed problem', () => {
    const result = formatSimulationStart('What is consciousness?');
    const plain = stripAnsi(result);
    expect(plain).toContain('What is consciousness?');
    expect(plain).toContain('LINEAGE');
  });

  it('formatSimulationEnd includes generation count', () => {
    const result = formatSimulationEnd(5);
    const plain = stripAnsi(result);
    expect(plain).toContain('5 generations');
    expect(plain).toContain('complete');
  });

  it('all formatters return strings (no side effects)', () => {
    expect(typeof formatBirth('a', 'b', 1)).toBe('string');
    expect(typeof formatDeath('a', 'b', 1)).toBe('string');
    expect(typeof formatTransmission('a', 'b')).toBe('string');
    expect(typeof formatMutation('a', 'b')).toBe('string');
    expect(typeof formatGenerationStart(1, 1)).toBe('string');
    expect(typeof formatGenerationEnd(1)).toBe('string');
    expect(typeof formatInheritance(1, 1)).toBe('string');
    expect(typeof formatSimulationStart('s')).toBe('string');
    expect(typeof formatSimulationEnd(1)).toBe('string');
  });

  it('COLORS constant has all event categories', () => {
    expect(typeof COLORS.birth).toBe('function');
    expect(typeof COLORS.death).toBe('function');
    expect(typeof COLORS.transmission).toBe('function');
    expect(typeof COLORS.mutation).toBe('function');
    expect(typeof COLORS.generation).toBe('function');
    expect(typeof COLORS.inheritance).toBe('function');
    expect(typeof COLORS.simulation).toBe('function');
  });
});

describe('EVNT-03: Generation summary', () => {
  it('createGenerationDisplayState initializes with empty maps', () => {
    const state = createGenerationDisplayState(1);
    expect(state.generationNumber).toBe(1);
    expect(state.citizens.size).toBe(0);
    expect(state.mutatedTransmissions.size).toBe(0);
  });

  it('buildGenerationSummary returns table string with headers', () => {
    const state = createGenerationDisplayState(1);
    const result = buildGenerationSummary(state);
    const plain = stripAnsi(result);
    expect(plain).toContain('Citizen');
    expect(plain).toContain('Role');
    expect(plain).toContain('Death');
    expect(plain).toContain('Transmitted');
    expect(plain).toContain('Mutated');
  });

  it('buildGenerationSummary includes citizen data in rows', () => {
    const state = createGenerationDisplayState(1);
    state.citizens.set('citizen-abcdef12', {
      id: 'citizen-abcdef12',
      role: 'builder',
      generation: 1,
      deathProfile: 'old-age',
      transmitted: true,
      mutationType: 'small',
    });
    const result = buildGenerationSummary(state);
    const plain = stripAnsi(result);
    expect(plain).toContain('citizen-');
    expect(plain).toContain('builder');
    expect(plain).toContain('old-age');
  });

  it('shows transmitted status as yes/no', () => {
    const state = createGenerationDisplayState(1);
    state.citizens.set('cit-yes-1234', {
      id: 'cit-yes-1234',
      role: 'skeptic',
      generation: 1,
      transmitted: true,
    });
    state.citizens.set('cit-no--1234', {
      id: 'cit-no--1234',
      role: 'observer',
      generation: 1,
      transmitted: false,
    });
    const result = buildGenerationSummary(state);
    const plain = stripAnsi(result);
    expect(plain).toContain('yes');
    expect(plain).toContain('no');
  });

  it('shows mutation type when present', () => {
    const state = createGenerationDisplayState(1);
    state.citizens.set('cit-mut-1234', {
      id: 'cit-mut-1234',
      role: 'archivist',
      generation: 1,
      mutationType: 'large',
    });
    state.citizens.set('cit-nom-1234', {
      id: 'cit-nom-1234',
      role: 'builder',
      generation: 1,
    });
    const result = buildGenerationSummary(state);
    const plain = stripAnsi(result);
    expect(plain).toContain('large');
    expect(plain).toContain('-');
  });

  it('handles empty citizens gracefully', () => {
    const state = createGenerationDisplayState(2);
    const result = buildGenerationSummary(state);
    expect(typeof result).toBe('string');
    // Should have header row but no data rows
    const plain = stripAnsi(result);
    expect(plain).toContain('Citizen');
  });
});

describe('EVNT-01: Event type verification', () => {
  it('lineageBus accepts all 7 required event types', () => {
    // Type-safe emit calls -- if these compile and run, the types are correct
    const mockConfig = {
      seedProblem: 'test',
      maxGenerations: 1,
      generationSize: 3,
      mutationRate: 0.3,
      largeMutationProbability: 0.1,
      deathProfileDistribution: { 'old-age': 0.7, accident: 0.3 },
      roleDistribution: { builder: 0.2, skeptic: 0.2, archivist: 0.2, 'elder-interpreter': 0.2, observer: 0.2 },
      gen1Protection: true,
      peakTransmissionWindow: { min: 0.4, max: 0.5 },
      outputDir: '/tmp/test',
    };

    // All 7 required event types from the plan
    expect(() => lineageBus.emit('citizen:born', 'cid', 'builder', 1)).not.toThrow();
    expect(() => lineageBus.emit('citizen:died', 'cid', 'old-age', 1)).not.toThrow();
    expect(() => lineageBus.emit('citizen:peak-transmission', 'cid', 'tid')).not.toThrow();
    expect(() => lineageBus.emit('generation:started', 1, 3)).not.toThrow();
    expect(() => lineageBus.emit('generation:ended', 1)).not.toThrow();
    expect(() => lineageBus.emit('transmission:mutated', 'tid', 'small')).not.toThrow();
    expect(() => lineageBus.emit('inheritance:composed', 2, 2)).not.toThrow();

    // Bonus: simulation lifecycle events
    expect(() => lineageBus.emit('simulation:started', 'seed', mockConfig as any)).not.toThrow();
    expect(() => lineageBus.emit('simulation:ended', 3)).not.toThrow();
  });
});
