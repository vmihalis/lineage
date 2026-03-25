import { describe, it, expect } from 'vitest';
import { TurnOutputSchema } from './turn-output.js';
import type { TurnOutput } from './turn-output.js';
import { formatHandoff, buildTurnPrompt } from './handoff.js';

function makeTurnOutput(overrides: Partial<TurnOutput> = {}): TurnOutput {
  return TurnOutputSchema.parse({
    citizenId: 'test-citizen-1',
    citizenName: 'citizen-gen1-abc123',
    role: 'builder',
    turnNumber: 1,
    output: 'Test output from citizen',
    usage: { inputTokens: 200, outputTokens: 300 },
    timestamp: new Date().toISOString(),
    ...overrides,
  });
}

describe('TurnOutput schema', () => {
  it('accepts valid turn data with all required fields and returns typed object', () => {
    const data = {
      citizenId: 'cit-001',
      citizenName: 'citizen-gen1-xyz',
      role: 'builder' as const,
      turnNumber: 1,
      output: 'My contribution to the problem',
      usage: { inputTokens: 100, outputTokens: 250 },
      timestamp: new Date().toISOString(),
    };
    const result = TurnOutputSchema.parse(data);
    expect(result.citizenId).toBe('cit-001');
    expect(result.citizenName).toBe('citizen-gen1-xyz');
    expect(result.role).toBe('builder');
    expect(result.turnNumber).toBe(1);
    expect(result.output).toBe('My contribution to the problem');
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(250);
  });

  it('rejects missing citizenId', () => {
    const data = {
      citizenName: 'citizen-gen1-xyz',
      role: 'builder',
      turnNumber: 1,
      output: 'output',
      usage: { inputTokens: 100, outputTokens: 250 },
      timestamp: new Date().toISOString(),
    };
    expect(() => TurnOutputSchema.parse(data)).toThrow();
  });

  it('rejects negative turnNumber', () => {
    const data = {
      citizenId: 'cit-001',
      citizenName: 'citizen-gen1-xyz',
      role: 'builder',
      turnNumber: -1,
      output: 'output',
      usage: { inputTokens: 100, outputTokens: 250 },
      timestamp: new Date().toISOString(),
    };
    expect(() => TurnOutputSchema.parse(data)).toThrow();
  });

  it('rejects non-datetime timestamp', () => {
    const data = {
      citizenId: 'cit-001',
      citizenName: 'citizen-gen1-xyz',
      role: 'builder',
      turnNumber: 1,
      output: 'output',
      usage: { inputTokens: 100, outputTokens: 250 },
      timestamp: 'not-a-datetime',
    };
    expect(() => TurnOutputSchema.parse(data)).toThrow();
  });
});

describe('formatHandoff', () => {
  it('returns empty string for empty array (no previous turns)', () => {
    const result = formatHandoff([]);
    expect(result).toBe('');
  });

  it('returns string containing header, citizen name, role, turn number, and output for single turn', () => {
    const turn = makeTurnOutput({
      citizenName: 'citizen-gen1-alpha',
      role: 'builder',
      turnNumber: 1,
      output: 'I believe we should preserve knowledge through writing.',
    });
    const result = formatHandoff([turn]);
    expect(result).toContain('PREVIOUS CITIZEN CONTRIBUTIONS:');
    expect(result).toContain('citizen-gen1-alpha');
    expect(result).toContain('builder');
    expect(result).toContain('Turn 1');
    expect(result).toContain('I believe we should preserve knowledge through writing.');
  });

  it('returns string with both citizens listed in order for two turns', () => {
    const turn1 = makeTurnOutput({
      citizenName: 'citizen-gen1-alpha',
      role: 'builder',
      turnNumber: 1,
      output: 'First contribution.',
    });
    const turn2 = makeTurnOutput({
      citizenId: 'test-citizen-2',
      citizenName: 'citizen-gen1-beta',
      role: 'skeptic',
      turnNumber: 2,
      output: 'Second contribution with critique.',
    });
    const result = formatHandoff([turn1, turn2]);
    expect(result).toContain('PREVIOUS CITIZEN CONTRIBUTIONS:');
    expect(result).toContain('citizen-gen1-alpha');
    expect(result).toContain('builder');
    expect(result).toContain('Turn 1');
    expect(result).toContain('First contribution.');
    expect(result).toContain('citizen-gen1-beta');
    expect(result).toContain('skeptic');
    expect(result).toContain('Turn 2');
    expect(result).toContain('Second contribution with critique.');
    // Verify ordering: alpha appears before beta
    const alphaIdx = result.indexOf('citizen-gen1-alpha');
    const betaIdx = result.indexOf('citizen-gen1-beta');
    expect(alphaIdx).toBeLessThan(betaIdx);
  });

  it('output ends with instruction line about role-based action', () => {
    const turn = makeTurnOutput();
    const result = formatHandoff([turn]);
    expect(result).toContain('Build on, question, record, interpret, or observe the above based on your role.');
  });
});

describe('buildTurnPrompt', () => {
  it('returns string with seed problem and first citizen language for empty turns', () => {
    const result = buildTurnPrompt('What is worth preserving?', []);
    expect(result).toContain('SEED PROBLEM: "What is worth preserving?"');
    expect(result).toContain('first citizen');
    expect(result).not.toContain('PREVIOUS CITIZEN CONTRIBUTIONS');
  });

  it('returns string with seed problem AND handoff for one previous turn', () => {
    const prevTurn = makeTurnOutput({
      citizenName: 'citizen-gen1-alpha',
      role: 'builder',
      turnNumber: 1,
      output: 'We should build a library.',
    });
    const result = buildTurnPrompt('What is worth preserving?', [prevTurn]);
    expect(result).toContain('SEED PROBLEM: "What is worth preserving?"');
    expect(result).toContain('PREVIOUS CITIZEN CONTRIBUTIONS:');
    expect(result).toContain('citizen-gen1-alpha');
    expect(result).toContain('We should build a library.');
  });

  it('returns string with seed problem, handoff with both turns, and citizen 3 language', () => {
    const t1 = makeTurnOutput({
      citizenName: 'citizen-gen1-alpha',
      role: 'builder',
      turnNumber: 1,
      output: 'Build a library.',
    });
    const t2 = makeTurnOutput({
      citizenId: 'test-citizen-2',
      citizenName: 'citizen-gen1-beta',
      role: 'skeptic',
      turnNumber: 2,
      output: 'But who will maintain it?',
    });
    const result = buildTurnPrompt('What is worth preserving?', [t1, t2]);
    expect(result).toContain('SEED PROBLEM: "What is worth preserving?"');
    expect(result).toContain('PREVIOUS CITIZEN CONTRIBUTIONS:');
    expect(result).toContain('citizen-gen1-alpha');
    expect(result).toContain('Build a library.');
    expect(result).toContain('citizen-gen1-beta');
    expect(result).toContain('But who will maintain it?');
    expect(result).toContain('citizen 3');
  });
});
