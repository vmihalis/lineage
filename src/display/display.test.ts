/**
 * Display module tests.
 *
 * EVNT-02: Event formatters -- pure functions return strings with expected content
 * EVNT-03: Generation summary -- cli-table3 table builder
 * EVNT-01: Event type verification -- lineageBus accepts all required events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { EventRenderer } from './event-renderer.js';

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

describe('EventRenderer', () => {
  let renderer: EventRenderer;

  beforeEach(() => {
    renderer = new EventRenderer();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    renderer.detach();
    vi.restoreAllMocks();
    lineageBus.removeAllListeners();
  });

  it('attach() subscribes to all required events', () => {
    renderer.attach();
    expect(lineageBus.listenerCount('citizen:born')).toBeGreaterThan(0);
    expect(lineageBus.listenerCount('citizen:died')).toBeGreaterThan(0);
    expect(lineageBus.listenerCount('citizen:peak-transmission')).toBeGreaterThan(0);
    expect(lineageBus.listenerCount('generation:started')).toBeGreaterThan(0);
    expect(lineageBus.listenerCount('generation:ended')).toBeGreaterThan(0);
    expect(lineageBus.listenerCount('transmission:mutated')).toBeGreaterThan(0);
    expect(lineageBus.listenerCount('inheritance:composed')).toBeGreaterThan(0);
    expect(lineageBus.listenerCount('simulation:started')).toBeGreaterThan(0);
    expect(lineageBus.listenerCount('simulation:ended')).toBeGreaterThan(0);
  });

  it('detach() removes only display handlers', () => {
    renderer.attach();
    const countBefore = lineageBus.listenerCount('citizen:born');
    renderer.detach();
    expect(lineageBus.listenerCount('citizen:born')).toBe(countBefore - 1);
  });

  it('logs formatted output for citizen:born', () => {
    renderer.attach();
    lineageBus.emit('generation:started', 1, 3);
    lineageBus.emit('citizen:born', 'citizen-abc12345', 'builder', 1);
    const logCalls = vi.mocked(console.log).mock.calls.flat().join(' ');
    const plain = stripAnsi(logCalls);
    expect(plain).toContain('born');
    expect(plain).toContain('builder');
  });

  it('logs formatted output for citizen:died', () => {
    renderer.attach();
    lineageBus.emit('generation:started', 1, 3);
    lineageBus.emit('citizen:born', 'citizen-abc12345', 'builder', 1);
    lineageBus.emit('citizen:died', 'citizen-abc12345', 'old-age', 1);
    const logCalls = vi.mocked(console.log).mock.calls.flat().join(' ');
    expect(logCalls).toContain('old-age');
  });

  it('logs formatted output for simulation:started', () => {
    renderer.attach();
    const mockConfig = {
      seedProblem: 'What is wisdom?',
      maxGenerations: 3,
      generationSize: 5,
      mutationRate: 0.3,
      largeMutationProbability: 0.1,
      deathProfileDistribution: { 'old-age': 0.7, accident: 0.3 },
      roleDistribution: { builder: 0.2, skeptic: 0.2, archivist: 0.2, 'elder-interpreter': 0.2, observer: 0.2 },
      gen1Protection: true,
      peakTransmissionWindow: { min: 0.4, max: 0.5 },
      outputDir: '/tmp/test',
    };
    lineageBus.emit('simulation:started', 'What is wisdom?', mockConfig as any);
    const logCalls = vi.mocked(console.log).mock.calls.flat().join(' ');
    const plain = stripAnsi(logCalls);
    expect(plain).toContain('What is wisdom?');
    expect(plain).toContain('LINEAGE');
  });

  it('logs formatted output for simulation:ended', () => {
    renderer.attach();
    lineageBus.emit('simulation:ended', 5);
    const logCalls = vi.mocked(console.log).mock.calls.flat().join(' ');
    const plain = stripAnsi(logCalls);
    expect(plain).toContain('5 generations');
    expect(plain).toContain('complete');
  });

  it('renders generation summary on generation:ended', () => {
    renderer.attach();
    lineageBus.emit('generation:started', 1, 2);
    lineageBus.emit('citizen:born', 'citizen-aaa11111', 'builder', 1);
    lineageBus.emit('citizen:born', 'citizen-bbb22222', 'skeptic', 1);
    lineageBus.emit('citizen:died', 'citizen-aaa11111', 'old-age', 1);
    lineageBus.emit('citizen:died', 'citizen-bbb22222', 'accident', 1);
    lineageBus.emit('citizen:peak-transmission', 'citizen-aaa11111', 'tx-001');
    lineageBus.emit('citizen:peak-transmission', 'citizen-bbb22222', 'tx-002');
    lineageBus.emit('generation:ended', 1);
    const logCalls = vi.mocked(console.log).mock.calls.flat().join(' ');
    const plain = stripAnsi(logCalls);
    expect(plain).toContain('builder');
    expect(plain).toContain('skeptic');
  });

  it('accumulates mutation data across events for summary', () => {
    renderer.attach();
    lineageBus.emit('generation:started', 1, 1);
    lineageBus.emit('citizen:born', 'citizen-ccc33333', 'archivist', 1);
    lineageBus.emit('citizen:died', 'citizen-ccc33333', 'old-age', 1);
    // transmission:mutated fires BEFORE citizen:peak-transmission per generation-runner
    lineageBus.emit('transmission:mutated', 'tx-003', 'small');
    lineageBus.emit('citizen:peak-transmission', 'citizen-ccc33333', 'tx-003');
    lineageBus.emit('generation:ended', 1);
    const logCalls = vi.mocked(console.log).mock.calls.flat().join(' ');
    const plain = stripAnsi(logCalls);
    expect(plain).toContain('small');
  });

  it('logs inheritance:composed events', () => {
    renderer.attach();
    lineageBus.emit('inheritance:composed', 2, 3);
    const logCalls = vi.mocked(console.log).mock.calls.flat().join(' ');
    const plain = stripAnsi(logCalls);
    expect(plain).toContain('gen 2');
    expect(plain).toContain('3 layers');
  });

  it('handles multiple generations by resetting state', () => {
    renderer.attach();
    // Generation 1
    lineageBus.emit('generation:started', 1, 1);
    lineageBus.emit('citizen:born', 'citizen-gen1-aaa', 'builder', 1);
    lineageBus.emit('citizen:died', 'citizen-gen1-aaa', 'old-age', 1);
    lineageBus.emit('citizen:peak-transmission', 'citizen-gen1-aaa', 'tx-g1');
    lineageBus.emit('generation:ended', 1);

    // Reset mock to isolate generation 2 assertions
    vi.mocked(console.log).mockClear();

    // Generation 2
    lineageBus.emit('generation:started', 2, 1);
    lineageBus.emit('citizen:born', 'citizen-gen2-bbb', 'skeptic', 2);
    lineageBus.emit('citizen:died', 'citizen-gen2-bbb', 'accident', 2);
    lineageBus.emit('citizen:peak-transmission', 'citizen-gen2-bbb', 'tx-g2');
    lineageBus.emit('generation:ended', 2);

    const logCalls = vi.mocked(console.log).mock.calls.flat().join(' ');
    const plain = stripAnsi(logCalls);
    expect(plain).toContain('skeptic');
    expect(plain).toContain('Generation 2');
    // Should NOT contain generation 1's citizen
    expect(plain).not.toContain('citizen-gen1');
  });
});
