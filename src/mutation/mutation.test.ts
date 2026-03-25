import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Agent SDK before any imports that use it
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import {
  buildSmallMutationPrompt,
  buildLargeMutationPrompt,
  MUTATION_SYSTEM_PROMPT,
} from './mutation-prompts.js';
import {
  decideMutation,
  selectTokenIndex,
  reassembleContent,
} from './mutation-decider.js';
import { executeMutation } from './mutation-executor.js';
import { mutateTransmission } from './mutation-pipeline.js';
import { extractAnchorTokens } from '../transmission/anchor-parser.js';
import { TransmissionSchema } from '../schemas/index.js';
import type { Transmission } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';

function makeSequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}

function makeTransmission(overrides: Record<string, unknown> = {}): Transmission {
  return TransmissionSchema.parse({
    id: 'tx-original',
    citizenId: 'citizen-001',
    generationNumber: 1,
    role: 'builder',
    type: 'peak',
    content: '[1] Water boils at 100 degrees Celsius\n[2] The earth orbits the sun\n[3] Trees produce oxygen',
    anchorTokens: ['Water boils at 100 degrees Celsius', 'The earth orbits the sun', 'Trees produce oxygen'],
    timestamp: new Date().toISOString(),
    mutated: false,
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

// --- buildSmallMutationPrompt tests (MUTN-01) ---

describe('buildSmallMutationPrompt', () => {
  it('returns string containing the original claim text', () => {
    const result = buildSmallMutationPrompt('Water boils at 100 degrees Celsius');
    expect(result).toContain('Water boils at 100 degrees Celsius');
  });

  it('output contains drift instruction (imprecision or less precise or vague)', () => {
    const result = buildSmallMutationPrompt('Water boils at 100 degrees Celsius');
    expect(result).toMatch(/imprecision|less precise|vague/i);
  });

  it('output contains "Return ONLY" (no-preamble instruction)', () => {
    const result = buildSmallMutationPrompt('Water boils at 100 degrees Celsius');
    expect(result).toContain('Return ONLY');
  });

  it('output does NOT contain "invert" (wrong mutation type)', () => {
    const result = buildSmallMutationPrompt('Water boils at 100 degrees Celsius');
    expect(result.toLowerCase()).not.toContain('invert');
  });
});

// --- buildLargeMutationPrompt tests (MUTN-02) ---

describe('buildLargeMutationPrompt', () => {
  it('returns string containing the original claim text', () => {
    const result = buildLargeMutationPrompt('Never store passwords in plaintext');
    expect(result).toContain('Never store passwords in plaintext');
  });

  it('output contains inversion instruction (invert or opposite)', () => {
    const result = buildLargeMutationPrompt('Never store passwords in plaintext');
    expect(result).toMatch(/invert|opposite/i);
  });

  it('output contains "Return ONLY" (no-preamble instruction)', () => {
    const result = buildLargeMutationPrompt('Never store passwords in plaintext');
    expect(result).toContain('Return ONLY');
  });

  it('output does NOT contain "imprecision" or "vague" (wrong mutation type)', () => {
    const result = buildLargeMutationPrompt('Never store passwords in plaintext');
    expect(result.toLowerCase()).not.toMatch(/imprecision|vague/);
  });
});

// --- MUTATION_SYSTEM_PROMPT tests ---

describe('MUTATION_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof MUTATION_SYSTEM_PROMPT).toBe('string');
    expect(MUTATION_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('contains "transmission" or "medium" (role framing)', () => {
    expect(MUTATION_SYSTEM_PROMPT).toMatch(/transmission|medium/i);
  });
});

// --- decideMutation tests (MUTN-03, MUTN-04) ---

describe('decideMutation', () => {
  it('returns { mutate: false } when randomFn value >= mutationRate', () => {
    const result = decideMutation(0.3, 0.1, () => 0.5);
    expect(result).toEqual({ mutate: false });
  });

  it('returns { mutate: true, type: "small" } when first roll passes but second roll >= largeMutationProbability', () => {
    const result = decideMutation(0.3, 0.1, makeSequence([0.1, 0.5]));
    expect(result).toEqual({ mutate: true, type: 'small' });
  });

  it('returns { mutate: true, type: "large" } when both rolls pass', () => {
    const result = decideMutation(0.3, 0.5, makeSequence([0.1, 0.2]));
    expect(result).toEqual({ mutate: true, type: 'large' });
  });

  it('returns { mutate: false } when mutationRate is 0.0 (0.0 >= 0.0, strict <)', () => {
    const result = decideMutation(0.0, 0.1, () => 0.0);
    expect(result).toEqual({ mutate: false });
  });

  it('returns { mutate: true, type: "small" } when mutationRate is 1.0 and largeMutationProbability is 0.0', () => {
    const result = decideMutation(1.0, 0.0, () => 0.99);
    expect(result).toEqual({ mutate: true, type: 'small' });
  });

  it('returns { mutate: true, type: "large" } when both rates are 1.0', () => {
    const result = decideMutation(1.0, 1.0, () => 0.99);
    expect(result).toEqual({ mutate: true, type: 'large' });
  });
});

// --- selectTokenIndex tests ---

describe('selectTokenIndex', () => {
  it('returns 0 when randomFn returns 0.0', () => {
    expect(selectTokenIndex(5, () => 0.0)).toBe(0);
  });

  it('returns 4 when randomFn returns 0.99 for tokenCount 5', () => {
    expect(selectTokenIndex(5, () => 0.99)).toBe(4);
  });

  it('returns 0 when tokenCount is 1 regardless of randomFn value', () => {
    expect(selectTokenIndex(1, () => 0.5)).toBe(0);
  });
});

// --- reassembleContent tests ---

describe('reassembleContent', () => {
  it('rebuilds two tokens into [N] formatted text', () => {
    expect(reassembleContent(['First claim', 'Second claim'])).toBe(
      '[1] First claim\n[2] Second claim',
    );
  });

  it('handles a single token', () => {
    expect(reassembleContent(['Single'])).toBe('[1] Single');
  });

  it('returns empty string for empty array', () => {
    expect(reassembleContent([])).toBe('');
  });

  it('roundtrips with extractAnchorTokens for non-empty arrays', () => {
    const tokens = ['Knowledge compounds over time', 'Mortality creates urgency', 'Loss teaches value'];
    const reassembled = reassembleContent(tokens);
    const extracted = extractAnchorTokens(reassembled);
    expect(extracted).toEqual(tokens);
  });
});

// --- executeMutation tests (MUTN-01, MUTN-02) ---

describe('executeMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls query() with systemPrompt matching MUTATION_SYSTEM_PROMPT', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at high temperatures'));

    await executeMutation('Water boils at 100 degrees Celsius', 'small');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.options.systemPrompt).toBe(MUTATION_SYSTEM_PROMPT);
  });

  it('calls query() with maxTurns: 1, permissionMode: "dontAsk", persistSession: false', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at high temperatures'));

    await executeMutation('Water boils at 100 degrees Celsius', 'small');

    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.options.maxTurns).toBe(1);
    expect(callArgs.options.permissionMode).toBe('dontAsk');
    expect(callArgs.options.persistSession).toBe(false);
  });

  it('calls query() with prompt from buildSmallMutationPrompt for type "small"', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at high temperatures'));

    await executeMutation('Water boils at 100 degrees Celsius', 'small');

    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.prompt).toBe(buildSmallMutationPrompt('Water boils at 100 degrees Celsius'));
  });

  it('calls query() with prompt from buildLargeMutationPrompt for type "large"', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water freezes at 100 degrees'));

    await executeMutation('Water boils at 100 degrees Celsius', 'large');

    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.prompt).toBe(buildLargeMutationPrompt('Water boils at 100 degrees Celsius'));
  });

  it('returns the trimmed result text from query() generator', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('  Water boils at high temperatures  '));

    const result = await executeMutation('Water boils at 100 degrees Celsius', 'small');

    expect(result).toBe('Water boils at high temperatures');
  });

  it('strips leading/trailing quotes from result', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('"Water boils at high temperatures"'));

    const result = await executeMutation('Water boils at 100 degrees Celsius', 'small');

    expect(result).toBe('Water boils at high temperatures');
  });

  it('returns original token when query() returns error subtype', async () => {
    mockQuery.mockReturnValueOnce(createErrorQueryGenerator('max_turns_reached'));

    const result = await executeMutation('Water boils at 100 degrees Celsius', 'small');

    expect(result).toBe('Water boils at 100 degrees Celsius');
  });

  it('returns original token when result text is empty', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator(''));

    const result = await executeMutation('Water boils at 100 degrees Celsius', 'small');

    expect(result).toBe('Water boils at 100 degrees Celsius');
  });
});

// --- mutateTransmission tests (ALL requirements) ---

describe('mutateTransmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('with mutationRate 0.0 returns { wasMutated: false } and original transmission unchanged', async () => {
    const original = makeTransmission();

    const result = await mutateTransmission(original, 0.0, 0.5);

    expect(result.wasMutated).toBe(false);
    expect(result.transmission).toBe(original);
  });

  it('with empty anchorTokens returns { wasMutated: false }', async () => {
    const original = makeTransmission({ anchorTokens: [], content: '' });

    const result = await mutateTransmission(original, 1.0, 0.5);

    expect(result.wasMutated).toBe(false);
  });

  it('with mutationRate 1.0 and largeMutationProbability 0.0 returns { wasMutated: true, mutationType: "small" }', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at roughly 100 degrees'));

    const original = makeTransmission();
    // Sequence: 0.1 < 1.0 (mutate), 0.5 >= 0.0 (small), 0.0 -> index 0
    const result = await mutateTransmission(original, 1.0, 0.0, makeSequence([0.1, 0.5, 0.0]));

    expect(result.wasMutated).toBe(true);
    expect(result.mutationType).toBe('small');
  });

  it('with mutationRate 1.0 and largeMutationProbability 1.0 returns { wasMutated: true, mutationType: "large" }', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water freezes at 100 degrees Celsius'));

    const original = makeTransmission();
    // Sequence: 0.1 < 1.0 (mutate), 0.5 < 1.0 (large), 0.0 -> index 0
    const result = await mutateTransmission(original, 1.0, 1.0, makeSequence([0.1, 0.5, 0.0]));

    expect(result.wasMutated).toBe(true);
    expect(result.mutationType).toBe('large');
  });

  it('mutated transmission has mutated: true and mutationType matching decision type', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at roughly 100 degrees'));

    const original = makeTransmission();
    const result = await mutateTransmission(original, 1.0, 0.0, makeSequence([0.1, 0.5, 0.0]));

    expect(result.transmission.mutated).toBe(true);
    expect(result.transmission.mutationType).toBe('small');
  });

  it('mutated transmission has a new id (different from original)', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at roughly 100 degrees'));

    const original = makeTransmission();
    const result = await mutateTransmission(original, 1.0, 0.0, makeSequence([0.1, 0.5, 0.0]));

    expect(result.transmission.id).not.toBe(original.id);
    expect(result.transmission.id.length).toBeGreaterThan(0);
  });

  it('mutated transmission content is reassembled from anchorTokens (content matches reassembleContent(anchorTokens))', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at roughly 100 degrees'));

    const original = makeTransmission();
    const result = await mutateTransmission(original, 1.0, 0.0, makeSequence([0.1, 0.5, 0.0]));

    expect(result.transmission.content).toBe(reassembleContent(result.transmission.anchorTokens));
  });

  it('only one anchor token is changed (others remain identical to original)', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at roughly 100 degrees'));

    const original = makeTransmission();
    // tokenIndex = Math.floor(0.0 * 3) = 0 -> first token mutated
    const result = await mutateTransmission(original, 1.0, 0.0, makeSequence([0.1, 0.5, 0.0]));

    // Token at index 0 should be different
    expect(result.transmission.anchorTokens[0]).not.toBe(original.anchorTokens[0]);
    // Tokens at index 1 and 2 should be identical
    expect(result.transmission.anchorTokens[1]).toBe(original.anchorTokens[1]);
    expect(result.transmission.anchorTokens[2]).toBe(original.anchorTokens[2]);
  });

  it('transmission:mutated event is emitted with (mutatedTransmission.id, mutationType)', async () => {
    const emitSpy = vi.spyOn(lineageBus, 'emit');
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('Water boils at roughly 100 degrees'));

    const original = makeTransmission();
    const result = await mutateTransmission(original, 1.0, 0.0, makeSequence([0.1, 0.5, 0.0]));

    expect(emitSpy).toHaveBeenCalledWith(
      'transmission:mutated',
      result.transmission.id,
      'small',
    );

    emitSpy.mockRestore();
  });

  it('with mutationRate 1.0 calls executeMutation with the selected anchor token', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('The earth goes around the sun'));

    const original = makeTransmission();
    // Sequence: 0.1 < 1.0 (mutate), 0.5 >= 0.0 (small), 0.34 -> Math.floor(0.34 * 3) = 1 -> second token
    await mutateTransmission(original, 1.0, 0.0, makeSequence([0.1, 0.5, 0.34]));

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0];
    // Should have called with the second anchor token via buildSmallMutationPrompt
    expect(callArgs.prompt).toBe(buildSmallMutationPrompt('The earth orbits the sun'));
  });
});
