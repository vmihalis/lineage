import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Agent SDK before any imports that use it
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import { TurnOutputSchema } from './turn-output.js';
import type { TurnOutput } from './turn-output.js';
import { formatHandoff, buildTurnPrompt } from './handoff.js';
import { executeCitizenTurn, runTurns } from './turn-runner.js';
import type { TurnRunnerConfig } from './turn-runner.js';
import { ContextBudget } from '../mortality/index.js';
import { CitizenConfigSchema } from '../schemas/index.js';

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

// --- TurnRunner Tests (Plan 02) ---

function makeCitizen(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return CitizenConfigSchema.parse({
    id: 'citizen-001',
    name: 'citizen-gen1-alpha',
    type: 'lineage-citizen',
    systemPrompt: 'You are a builder citizen.',
    role: 'builder',
    generationNumber: 1,
    deathProfile: 'old-age',
    contextBudget: 0,
    birthTimestamp: now,
    createdAt: now,
    updatedAt: now,
    transmissions: [],
    ...overrides,
  });
}

function createMockQueryGenerator(resultText: string, inputTokens = 100, outputTokens = 200) {
  return (async function* () {
    yield {
      type: 'assistant' as const,
      message: { content: [{ type: 'text', text: resultText }] },
      parent_tool_use_id: null,
      uuid: 'test-uuid',
      session_id: 'test-session',
    };
    yield {
      type: 'result' as const,
      subtype: 'success' as const,
      result: resultText,
      is_error: false,
      num_turns: 1,
      duration_ms: 100,
      duration_api_ms: 50,
      total_cost_usd: 0.001,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      modelUsage: {},
      permission_denials: [],
      stop_reason: 'end_turn',
      uuid: 'test-uuid',
      session_id: 'test-session',
    };
  })();
}

function createErrorQueryGenerator(errorSubtype: string) {
  return (async function* () {
    yield {
      type: 'result' as const,
      subtype: errorSubtype as 'error',
      result: '',
      is_error: true,
      num_turns: 0,
      duration_ms: 50,
      duration_api_ms: 25,
      total_cost_usd: 0,
      usage: { input_tokens: 10, output_tokens: 0 },
      modelUsage: {},
      permission_denials: [],
      stop_reason: 'error',
      uuid: 'test-uuid',
      session_id: 'test-session',
    };
  })();
}

describe('executeCitizenTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls query() and returns TurnOutput with citizenId, name, role, turnNumber, output, and usage', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('I believe we should build a library.'));

    const result = await executeCitizenTurn(citizen, 'What is worth preserving?', 1);

    expect(result.citizenId).toBe('citizen-001');
    expect(result.citizenName).toBe('citizen-gen1-alpha');
    expect(result.role).toBe('builder');
    expect(result.turnNumber).toBe(1);
    expect(result.output).toBe('I believe we should build a library.');
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(200);
    expect(result.timestamp).toBeDefined();
  });

  it('passes citizen systemPrompt, maxTurns, model, permissionMode dontAsk, and persistSession false to query()', async () => {
    const citizen = makeCitizen({
      systemPrompt: 'You are a skeptic.',
      maxTurns: 3,
    });
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Skeptical response'));

    await executeCitizenTurn(citizen, 'Test prompt', 2);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.prompt).toBe('Test prompt');
    expect(callArgs.options.systemPrompt).toBe('You are a skeptic.');
    expect(callArgs.options.maxTurns).toBe(3);
    expect(callArgs.options.permissionMode).toBe('dontAsk');
    expect(callArgs.options.persistSession).toBe(false);
  });

  it('handles error result (subtype !== success) by returning output with Agent error text', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(createErrorQueryGenerator('max_turns_reached'));

    const result = await executeCitizenTurn(citizen, 'Test prompt', 1);

    expect(result.output).toContain('[Agent error: max_turns_reached]');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(0);
  });
});

describe('runTurns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes citizens sequentially (N calls for N citizens, each after previous completes)', async () => {
    const citizen1 = makeCitizen({ id: 'cit-1', name: 'citizen-gen1-alpha', role: 'builder' });
    const citizen2 = makeCitizen({ id: 'cit-2', name: 'citizen-gen1-beta', role: 'skeptic' });
    const citizen3 = makeCitizen({ id: 'cit-3', name: 'citizen-gen1-gamma', role: 'archivist' });

    // Each mock includes the prompt in its response so we can verify threading
    mockQuery
      .mockReturnValueOnce(createMockQueryGenerator('Response from citizen 1', 100, 150))
      .mockReturnValueOnce(createMockQueryGenerator('Response from citizen 2', 200, 250))
      .mockReturnValueOnce(createMockQueryGenerator('Response from citizen 3', 300, 350));

    const config: TurnRunnerConfig = {
      seedProblem: 'What is worth preserving?',
      citizens: [citizen1, citizen2, citizen3],
    };

    const result = await runTurns(config);

    // query() called exactly 3 times
    expect(mockQuery).toHaveBeenCalledTimes(3);
    // 3 turns returned
    expect(result.turns).toHaveLength(3);
  });

  it('passes seed problem only to first citizen (no handoff) and seed + handoff to subsequent citizens', async () => {
    const citizen1 = makeCitizen({ id: 'cit-1', name: 'citizen-gen1-alpha', role: 'builder' });
    const citizen2 = makeCitizen({ id: 'cit-2', name: 'citizen-gen1-beta', role: 'skeptic' });

    mockQuery
      .mockReturnValueOnce(createMockQueryGenerator('First citizen output', 100, 100))
      .mockReturnValueOnce(createMockQueryGenerator('Second citizen output', 200, 200));

    const config: TurnRunnerConfig = {
      seedProblem: 'What is worth preserving?',
      citizens: [citizen1, citizen2],
    };

    await runTurns(config);

    // First citizen prompt should NOT contain PREVIOUS CITIZEN CONTRIBUTIONS
    const firstPrompt = mockQuery.mock.calls[0][0].prompt;
    expect(firstPrompt).toContain('What is worth preserving?');
    expect(firstPrompt).not.toContain('PREVIOUS CITIZEN CONTRIBUTIONS');
    expect(firstPrompt).toContain('first citizen');

    // Second citizen prompt SHOULD contain handoff from first citizen
    const secondPrompt = mockQuery.mock.calls[1][0].prompt;
    expect(secondPrompt).toContain('What is worth preserving?');
    expect(secondPrompt).toContain('PREVIOUS CITIZEN CONTRIBUTIONS');
    expect(secondPrompt).toContain('First citizen output');
  });

  it('provides increasing handoff context (citizen 2 sees 1, citizen 3 sees 1+2)', async () => {
    const citizen1 = makeCitizen({ id: 'cit-1', name: 'citizen-gen1-alpha', role: 'builder' });
    const citizen2 = makeCitizen({ id: 'cit-2', name: 'citizen-gen1-beta', role: 'skeptic' });
    const citizen3 = makeCitizen({ id: 'cit-3', name: 'citizen-gen1-gamma', role: 'archivist' });

    mockQuery
      .mockReturnValueOnce(createMockQueryGenerator('Alpha output', 100, 100))
      .mockReturnValueOnce(createMockQueryGenerator('Beta output', 200, 200))
      .mockReturnValueOnce(createMockQueryGenerator('Gamma output', 300, 300));

    await runTurns({
      seedProblem: 'Test seed',
      citizens: [citizen1, citizen2, citizen3],
    });

    // Citizen 3's prompt should contain both citizen 1 and citizen 2 outputs
    const thirdPrompt = mockQuery.mock.calls[2][0].prompt;
    expect(thirdPrompt).toContain('Alpha output');
    expect(thirdPrompt).toContain('Beta output');
    expect(thirdPrompt).toContain('citizen-gen1-alpha');
    expect(thirdPrompt).toContain('citizen-gen1-beta');
  });

  it('turn numbers increment from 1 to N across the returned turns array', async () => {
    const citizen1 = makeCitizen({ id: 'cit-1', name: 'alpha', role: 'builder' });
    const citizen2 = makeCitizen({ id: 'cit-2', name: 'beta', role: 'skeptic' });
    const citizen3 = makeCitizen({ id: 'cit-3', name: 'gamma', role: 'archivist' });

    mockQuery
      .mockReturnValueOnce(createMockQueryGenerator('Out 1', 100, 100))
      .mockReturnValueOnce(createMockQueryGenerator('Out 2', 100, 100))
      .mockReturnValueOnce(createMockQueryGenerator('Out 3', 100, 100));

    const result = await runTurns({
      seedProblem: 'Test',
      citizens: [citizen1, citizen2, citizen3],
    });

    expect(result.turns[0].turnNumber).toBe(1);
    expect(result.turns[1].turnNumber).toBe(2);
    expect(result.turns[2].turnNumber).toBe(3);
  });

  it('returns TurnResult with accumulated totalTokens', async () => {
    const citizen1 = makeCitizen({ id: 'cit-1', name: 'alpha', role: 'builder' });
    const citizen2 = makeCitizen({ id: 'cit-2', name: 'beta', role: 'skeptic' });

    mockQuery
      .mockReturnValueOnce(createMockQueryGenerator('Out 1', 100, 150))
      .mockReturnValueOnce(createMockQueryGenerator('Out 2', 200, 250));

    const result = await runTurns({
      seedProblem: 'Test',
      citizens: [citizen1, citizen2],
    });

    expect(result.totalTokens.input).toBe(300);   // 100 + 200
    expect(result.totalTokens.output).toBe(400);   // 150 + 250
  });

  it('updates provided ContextBudget with each citizen usage after their turn', async () => {
    const citizen1 = makeCitizen({ id: 'cit-1', name: 'alpha', role: 'builder' });
    const citizen2 = makeCitizen({ id: 'cit-2', name: 'beta', role: 'skeptic' });

    mockQuery
      .mockReturnValueOnce(createMockQueryGenerator('Out 1', 1000, 2000))
      .mockReturnValueOnce(createMockQueryGenerator('Out 2', 3000, 4000));

    const budget = new ContextBudget({
      contextWindow: 200000,
      safetyBuffer: 0.2,
      thresholds: [],
    });

    await runTurns({
      seedProblem: 'Test',
      citizens: [citizen1, citizen2],
      contextBudget: budget,
    });

    // Budget should reflect total consumed tokens: (1000+2000) + (3000+4000) = 10000
    // Effective capacity = 200000 * 0.8 = 160000
    // Percentage = 10000 / 160000 = 0.0625
    expect(budget.percentage).toBeCloseTo(0.0625, 4);
    expect(budget.remainingTokens).toBe(160000 - 10000);
  });
});
