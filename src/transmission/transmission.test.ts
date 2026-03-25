import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Agent SDK before any imports that use it
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

// Mock LineageStateManager
const mockWrite = vi.fn().mockResolvedValue(undefined);
vi.mock('../state/index.js', () => ({
  LineageStateManager: class MockStateManager {
    write = mockWrite;
  },
}));

import { extractAnchorTokens } from './anchor-parser.js';
import { buildPeakTransmissionPrompt } from './peak-prompt.js';
import { executePeakTransmission } from './transmission-executor.js';
import { writeTransmission } from './transmission-writer.js';
import { CitizenConfigSchema, TransmissionSchema } from '../schemas/index.js';
import type { Transmission } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';

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

describe('extractAnchorTokens', () => {
  it('parses two numbered claims into an array of two strings', () => {
    const result = extractAnchorTokens('[1] First claim\n[2] Second claim');
    expect(result).toEqual(['First claim', 'Second claim']);
  });

  it('parses a single numbered claim', () => {
    const result = extractAnchorTokens('[1] Single');
    expect(result).toEqual(['Single']);
  });

  it('handles double-digit numbers correctly', () => {
    const result = extractAnchorTokens('[10] Double digit\n[11] Also works');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Double digit');
    expect(result[1]).toBe('Also works');
  });

  it('returns full text as single-element array for prose without brackets', () => {
    const result = extractAnchorTokens('Plain prose without brackets');
    expect(result).toEqual(['Plain prose without brackets']);
  });

  it('returns empty array for empty string input', () => {
    const result = extractAnchorTokens('');
    expect(result).toEqual([]);
  });

  it('trims whitespace from extracted claims', () => {
    const result = extractAnchorTokens('[1]  Spaces  ');
    expect(result).toEqual(['Spaces']);
  });

  it('handles five numbered claims', () => {
    const input = '[1] Claim one\n[2] Claim two\n[3] Third claim\n[4] Fourth\n[5] Fifth';
    const result = extractAnchorTokens(input);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('Claim one');
    expect(result[4]).toBe('Fifth');
  });

  it('handles multi-line claims that span two lines before next anchor', () => {
    const input = '[1] Multi-line claim\nthat spans two lines\n[2] Next claim';
    const result = extractAnchorTokens(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('Multi-line claim');
    expect(result[0]).toContain('that spans two lines');
    expect(result[1]).toBe('Next claim');
  });

  it('returns empty array for whitespace-only input', () => {
    const result = extractAnchorTokens('   \n  \n   ');
    expect(result).toEqual([]);
  });
});

describe('buildPeakTransmissionPrompt', () => {
  it('includes context percentage as an integer (42% for 0.42)', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.42);
    expect(prompt).toContain('42%');
  });

  it('contains [1] instruction example for numbered claims format', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.5);
    expect(prompt).toContain('[1]');
  });

  it('contains transmission and mortality language', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.75);
    expect(prompt).toContain('transmission');
    expect(prompt).toMatch(/survive|legacy|death/i);
  });

  it('contains 3-7 claims guidance for target count', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.8);
    expect(prompt).toContain('3-7 claims');
  });

  it('contains stand alone instruction for independent claims', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.6);
    expect(prompt).toContain('stand alone');
  });

  it('contains PEAK TRANSMISSION MOMENT header', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.5);
    expect(prompt).toContain('PEAK TRANSMISSION MOMENT');
  });

  it('rounds context percentage to nearest integer', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.876);
    expect(prompt).toContain('88%');
  });
});

// --- executePeakTransmission Tests (Plan 02) ---

describe('executePeakTransmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls query() with citizen systemPrompt, maxTurns 1, permissionMode dontAsk, persistSession false', async () => {
    const citizen = makeCitizen({
      systemPrompt: 'You are a skeptic.',
      model: 'claude-sonnet-4-20250514',
    });
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Test claim'));

    await executePeakTransmission(citizen, 'Peak prompt text');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.prompt).toBe('Peak prompt text');
    expect(callArgs.options.systemPrompt).toBe('You are a skeptic.');
    expect(callArgs.options.maxTurns).toBe(1);
    expect(callArgs.options.permissionMode).toBe('dontAsk');
    expect(callArgs.options.persistSession).toBe(false);
  });

  it('returns TransmissionResult with transmission.content matching agent output text', async () => {
    const citizen = makeCitizen();
    const agentOutput = '[1] Knowledge compounds\n[2] Time reveals truth';
    mockQuery.mockReturnValueOnce(createMockQueryGenerator(agentOutput));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.content).toBe(agentOutput);
  });

  it('returns TransmissionResult with anchorTokens extracted from [N] formatted output', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(
      createMockQueryGenerator('[1] First insight\n[2] Second insight\n[3] Third insight'),
    );

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.anchorTokens).toEqual([
      'First insight',
      'Second insight',
      'Third insight',
    ]);
  });

  it('returns TransmissionResult with usage.inputTokens and usage.outputTokens from SDK response', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Claim', 500, 750));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.usage.inputTokens).toBe(500);
    expect(result.usage.outputTokens).toBe(750);
  });

  it('transmission.citizenId matches citizen.id', async () => {
    const citizen = makeCitizen({ id: 'cit-peak-test' });
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Claim'));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.citizenId).toBe('cit-peak-test');
  });

  it('transmission.generationNumber matches citizen.generationNumber', async () => {
    const citizen = makeCitizen({ generationNumber: 3 });
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Claim'));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.generationNumber).toBe(3);
  });

  it('transmission.role matches citizen.role', async () => {
    const citizen = makeCitizen({ role: 'skeptic' });
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Claim'));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.role).toBe('skeptic');
  });

  it('transmission.type is peak', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Claim'));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.type).toBe('peak');
  });

  it('transmission.mutated is false', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Claim'));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.mutated).toBe(false);
  });

  it('transmission.id is a non-empty string (nanoid)', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Claim'));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(typeof result.transmission.id).toBe('string');
    expect(result.transmission.id.length).toBeGreaterThan(0);
  });

  it('transmission.timestamp is a valid ISO datetime string', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Claim'));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.timestamp).toBeDefined();
    // ISO datetime should parse to a valid date
    const date = new Date(result.transmission.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });

  it('handles error subtype from query() by returning transmission with error text content', async () => {
    const citizen = makeCitizen();
    mockQuery.mockReturnValueOnce(createErrorQueryGenerator('max_turns_reached'));

    const result = await executePeakTransmission(citizen, 'Peak prompt');

    expect(result.transmission.content).toContain('Transmission error');
    expect(result.transmission.content).toContain('max_turns_reached');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(0);
  });
});

// --- writeTransmission Tests (Plan 02) ---

describe('writeTransmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls stateManager.write() with correct file path pattern: {outputDir}/transmissions/gen{N}/{citizenId}-peak.json', async () => {
    const transmission: Transmission = TransmissionSchema.parse({
      id: 'tx-001',
      citizenId: 'citizen-001',
      generationNumber: 1,
      role: 'builder',
      type: 'peak',
      content: '[1] Test claim',
      anchorTokens: ['Test claim'],
      timestamp: new Date().toISOString(),
      mutated: false,
    });

    await writeTransmission(transmission, '/tmp/lineage-output');

    expect(mockWrite).toHaveBeenCalledTimes(1);
    const callArgs = mockWrite.mock.calls[0];
    // filePath argument
    expect(callArgs[0]).toContain('transmissions');
    expect(callArgs[0]).toContain('gen1');
    expect(callArgs[0]).toContain('citizen-001-peak.json');
  });

  it('passes TransmissionSchema as the schema argument to stateManager.write()', async () => {
    const transmission: Transmission = TransmissionSchema.parse({
      id: 'tx-002',
      citizenId: 'citizen-002',
      generationNumber: 2,
      role: 'skeptic',
      type: 'peak',
      content: '[1] Another claim',
      anchorTokens: ['Another claim'],
      timestamp: new Date().toISOString(),
      mutated: false,
    });

    await writeTransmission(transmission, '/tmp/lineage-output');

    const callArgs = mockWrite.mock.calls[0];
    // schema argument (3rd positional, index 2)
    expect(callArgs[2]).toBe(TransmissionSchema);
  });

  it('emits citizen:peak-transmission event with transmission.citizenId and transmission.id', async () => {
    const emitSpy = vi.spyOn(lineageBus, 'emit');

    const transmission: Transmission = TransmissionSchema.parse({
      id: 'tx-003',
      citizenId: 'citizen-003',
      generationNumber: 1,
      role: 'archivist',
      type: 'peak',
      content: '[1] Archived insight',
      anchorTokens: ['Archived insight'],
      timestamp: new Date().toISOString(),
      mutated: false,
    });

    await writeTransmission(transmission, '/tmp/lineage-output');

    expect(emitSpy).toHaveBeenCalledWith(
      'citizen:peak-transmission',
      'citizen-003',
      'tx-003',
    );

    emitSpy.mockRestore();
  });

  it('returns the file path string', async () => {
    const transmission: Transmission = TransmissionSchema.parse({
      id: 'tx-004',
      citizenId: 'citizen-004',
      generationNumber: 3,
      role: 'observer',
      type: 'peak',
      content: '[1] Observed pattern',
      anchorTokens: ['Observed pattern'],
      timestamp: new Date().toISOString(),
      mutated: false,
    });

    const result = await writeTransmission(transmission, '/tmp/lineage-output');

    expect(typeof result).toBe('string');
    expect(result).toContain('transmissions');
    expect(result).toContain('gen3');
    expect(result).toContain('citizen-004-peak.json');
  });
});
