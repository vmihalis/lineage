import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises before any imports that use it
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

// Mock the Agent SDK before any imports that use it
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import { readGenerationTransmissions, readAllPriorTransmissions } from './transmission-reader.js';
import {
  SEED_COMPRESSION_SYSTEM_PROMPT,
  buildSeedCompressionPrompt,
  formatSeedLayer,
} from './seed-layer.js';
import { formatRecentLayer } from './recent-layer.js';
import { executeSeedCompression } from './seed-executor.js';
import { composeInheritance, INHERITANCE_RECENT_LABEL } from './inheritance-composer.js';
import type { InheritancePackage } from './inheritance-composer.js';
import { TransmissionSchema } from '../schemas/index.js';
import type { Transmission } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';

function makeTransmission(overrides: Record<string, unknown> = {}): Transmission {
  return TransmissionSchema.parse({
    id: 'tx-test-001',
    citizenId: 'citizen-001',
    generationNumber: 1,
    role: 'builder',
    type: 'peak',
    content: '[1] Water boils at 100 degrees Celsius\n[2] The earth orbits the sun',
    anchorTokens: ['Water boils at 100 degrees Celsius', 'The earth orbits the sun'],
    timestamp: new Date().toISOString(),
    mutated: false,
    ...overrides,
  });
}

// --- readGenerationTransmissions tests ---

describe('readGenerationTransmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads all .json files from the correct generation directory path', async () => {
    const tx = makeTransmission();
    mockReaddir.mockResolvedValueOnce(['citizen-001-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx));

    const result = await readGenerationTransmissions('/output', 1);

    expect(mockReaddir).toHaveBeenCalledWith(
      expect.stringContaining('transmissions/gen1'),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tx-test-001');
  });

  it('parses each file with TransmissionSchema.parse and returns Transmission[]', async () => {
    const tx1 = makeTransmission({ id: 'tx-1', citizenId: 'c1' });
    const tx2 = makeTransmission({ id: 'tx-2', citizenId: 'c2' });
    mockReaddir.mockResolvedValueOnce(['c1-peak.json', 'c2-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx2));

    const result = await readGenerationTransmissions('/output', 1);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('tx-1');
    expect(result[1].id).toBe('tx-2');
  });

  it('returns empty array when generation directory does not exist (ENOENT)', async () => {
    const error = new Error('ENOENT: no such file or directory');
    (error as NodeJS.ErrnoException).code = 'ENOENT';
    mockReaddir.mockRejectedValueOnce(error);

    const result = await readGenerationTransmissions('/output', 5);

    expect(result).toEqual([]);
  });

  it('skips non-.json files in the directory', async () => {
    const tx = makeTransmission();
    mockReaddir.mockResolvedValueOnce([
      'citizen-001-peak.json',
      '.DS_Store',
      'readme.txt',
      'notes.md',
    ]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx));

    const result = await readGenerationTransmissions('/output', 1);

    expect(result).toHaveLength(1);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });
});

// --- readAllPriorTransmissions tests ---

describe('readAllPriorTransmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads gen1 and gen2 (NOT gen3) when upToGeneration is 3', async () => {
    const tx1 = makeTransmission({ id: 'tx-gen1', generationNumber: 1 });
    const tx2 = makeTransmission({ id: 'tx-gen2', generationNumber: 2 });

    // gen1 readdir + readFile
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));
    // gen2 readdir + readFile
    mockReaddir.mockResolvedValueOnce(['c2-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx2));

    const result = await readAllPriorTransmissions('/output', 3);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('tx-gen1');
    expect(result[1].id).toBe('tx-gen2');
    // readdir should have been called exactly twice (gen1, gen2 -- not gen3)
    expect(mockReaddir).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when upToGeneration is 1 (no prior generations)', async () => {
    const result = await readAllPriorTransmissions('/output', 1);

    expect(result).toEqual([]);
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('returns combined Transmission[] from multiple generations', async () => {
    const tx1a = makeTransmission({ id: 'tx-1a', generationNumber: 1 });
    const tx1b = makeTransmission({ id: 'tx-1b', generationNumber: 1 });
    const tx2a = makeTransmission({ id: 'tx-2a', generationNumber: 2 });

    // gen1: two files
    mockReaddir.mockResolvedValueOnce(['c1-peak.json', 'c2-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1a));
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1b));
    // gen2: one file
    mockReaddir.mockResolvedValueOnce(['c3-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx2a));

    const result = await readAllPriorTransmissions('/output', 3);

    expect(result).toHaveLength(3);
    expect(result.map(t => t.id)).toEqual(['tx-1a', 'tx-1b', 'tx-2a']);
  });
});

// --- SEED_COMPRESSION_SYSTEM_PROMPT tests ---

describe('SEED_COMPRESSION_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof SEED_COMPRESSION_SYSTEM_PROMPT).toBe('string');
    expect(SEED_COMPRESSION_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('contains "civilization" or "memory" (role framing)', () => {
    expect(SEED_COMPRESSION_SYSTEM_PROMPT).toMatch(/civilization|memory/i);
  });
});

// --- buildSeedCompressionPrompt tests ---

describe('buildSeedCompressionPrompt', () => {
  it('with 2 generations of tokens returns string containing "Generation 1 transmitted:" and "Generation 2 transmitted:"', () => {
    const tokensByGen = new Map<number, string[]>();
    tokensByGen.set(1, ['Water boils at 100C', 'Fire is hot']);
    tokensByGen.set(2, ['The sun rises daily']);

    const result = buildSeedCompressionPrompt(tokensByGen, 3);

    expect(result).toContain('Generation 1 transmitted:');
    expect(result).toContain('Generation 2 transmitted:');
  });

  it('includes all token text from each generation', () => {
    const tokensByGen = new Map<number, string[]>();
    tokensByGen.set(1, ['Water boils at 100C', 'Fire is hot']);
    tokensByGen.set(2, ['The sun rises daily']);

    const result = buildSeedCompressionPrompt(tokensByGen, 3);

    expect(result).toContain('Water boils at 100C');
    expect(result).toContain('Fire is hot');
    expect(result).toContain('The sun rises daily');
  });

  it('contains "3-5 essential claims" instruction', () => {
    const tokensByGen = new Map<number, string[]>();
    tokensByGen.set(1, ['Knowledge is power']);

    const result = buildSeedCompressionPrompt(tokensByGen, 2);

    expect(result).toContain('3-5 essential claims');
  });

  it('contains "[1]" format instruction for anchor token compatibility', () => {
    const tokensByGen = new Map<number, string[]>();
    tokensByGen.set(1, ['Knowledge is power']);

    const result = buildSeedCompressionPrompt(tokensByGen, 2);

    expect(result).toContain('[1]');
  });

  it('contains "Return ONLY" no-preamble instruction', () => {
    const tokensByGen = new Map<number, string[]>();
    tokensByGen.set(1, ['Knowledge is power']);

    const result = buildSeedCompressionPrompt(tokensByGen, 2);

    expect(result).toContain('Return ONLY');
  });
});

// --- formatSeedLayer tests ---

describe('formatSeedLayer', () => {
  it('with 3 tokens returns string starting with "ANCESTRAL KNOWLEDGE"', () => {
    const tokens = ['Truth endures', 'Knowledge compounds', 'Loss teaches'];

    const result = formatSeedLayer(tokens, 5);

    expect(result).toMatch(/^ANCESTRAL KNOWLEDGE/);
  });

  it('with empty array returns empty string', () => {
    const result = formatSeedLayer([], 0);

    expect(result).toBe('');
  });

  it('includes all provided tokens prefixed with "- "', () => {
    const tokens = ['Truth endures', 'Knowledge compounds'];

    const result = formatSeedLayer(tokens, 3);

    expect(result).toContain('- Truth endures');
    expect(result).toContain('- Knowledge compounds');
  });

  it('includes generation count in header', () => {
    const result = formatSeedLayer(['A claim'], 7);

    expect(result).toContain('7 generation(s)');
  });
});

// --- formatRecentLayer tests ---

describe('formatRecentLayer', () => {
  it('with 2 transmissions returns string starting with "INHERITANCE FROM GENERATION"', () => {
    const txs = [
      makeTransmission({ id: 'tx-r1', role: 'builder', citizenId: 'abcdefgh-1234' }),
      makeTransmission({ id: 'tx-r2', role: 'skeptic', citizenId: 'ijklmnop-5678' }),
    ];

    const result = formatRecentLayer(txs, 2);

    expect(result).toMatch(/^INHERITANCE FROM GENERATION/);
  });

  it('includes role and citizenId context per transmission using "--- role (citizen citizenId) ---" header format', () => {
    const txs = [
      makeTransmission({ id: 'tx-r1', role: 'builder', citizenId: 'abcdefgh-1234' }),
    ];

    const result = formatRecentLayer(txs, 2);

    expect(result).toContain('--- builder (citizen abcdefgh) ---');
  });

  it('includes each transmission\'s anchor tokens prefixed with "- "', () => {
    const txs = [
      makeTransmission({
        id: 'tx-r1',
        anchorTokens: ['Water boils at 100 degrees Celsius', 'The earth orbits the sun'],
      }),
    ];

    const result = formatRecentLayer(txs, 2);

    expect(result).toContain('- Water boils at 100 degrees Celsius');
    expect(result).toContain('- The earth orbits the sun');
  });

  it('with empty array returns empty string', () => {
    const result = formatRecentLayer([], 1);

    expect(result).toBe('');
  });

  it('ends with a guidance instruction for the receiving citizen', () => {
    const txs = [
      makeTransmission({ id: 'tx-r1' }),
    ];

    const result = formatRecentLayer(txs, 2);

    expect(result).toMatch(/Consider this inherited knowledge|Build on|question|preserve/);
  });
});

// --- Mock query generator helpers (same pattern as mutation.test.ts) ---

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

// --- executeSeedCompression tests ---

describe('executeSeedCompression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls query() with SEED_COMPRESSION_SYSTEM_PROMPT as systemPrompt', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Knowledge endures\n[2] Loss teaches'));

    await executeSeedCompression('Compress these tokens');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.options.systemPrompt).toBe(SEED_COMPRESSION_SYSTEM_PROMPT);
  });

  it('calls query() with maxTurns: 1, permissionMode: "dontAsk", persistSession: false', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Knowledge endures'));

    await executeSeedCompression('Compress these tokens');

    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.options.maxTurns).toBe(1);
    expect(callArgs.options.permissionMode).toBe('dontAsk');
    expect(callArgs.options.persistSession).toBe(false);
  });

  it('returns tokens parsed via extractAnchorTokens from LLM result', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Knowledge endures\n[2] Loss teaches\n[3] Fire is hot'));

    const result = await executeSeedCompression('Compress these tokens');

    expect(result.tokens).toEqual(['Knowledge endures', 'Loss teaches', 'Fire is hot']);
  });

  it('returns usage with inputTokens and outputTokens from result message', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Knowledge endures', 150, 75));

    const result = await executeSeedCompression('Compress these tokens');

    expect(result.usage).toEqual({ inputTokens: 150, outputTokens: 75 });
  });

  it('returns empty tokens array on LLM error subtype', async () => {
    mockQuery.mockReturnValueOnce(createErrorQueryGenerator('max_turns_reached'));

    const result = await executeSeedCompression('Compress these tokens');

    expect(result.tokens).toEqual([]);
  });

  it('returns empty tokens array when result text is empty', async () => {
    mockQuery.mockReturnValueOnce(createMockQueryGenerator(''));

    const result = await executeSeedCompression('Compress these tokens');

    expect(result.tokens).toEqual([]);
  });
});

// --- INHERITANCE_RECENT_LABEL tests ---

describe('INHERITANCE_RECENT_LABEL', () => {
  it('equals "inheritance-recent"', () => {
    expect(INHERITANCE_RECENT_LABEL).toBe('inheritance-recent');
  });
});

// --- composeInheritance tests ---

describe('composeInheritance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('for generation 1 returns InheritancePackage with seedLayer: null, recentLayer: null, seedTokens: [], recentTokens: []', async () => {
    const result = await composeInheritance(1, '/output', { seedLayerAtBirth: true, recentLayerThreshold: 0.25 });

    expect(result.targetGeneration).toBe(1);
    expect(result.seedLayer).toBeNull();
    expect(result.recentLayer).toBeNull();
    expect(result.seedTokens).toEqual([]);
    expect(result.recentTokens).toEqual([]);
  });

  it('for generation 1 does NOT call readAllPriorTransmissions or executeSeedCompression', async () => {
    await composeInheritance(1, '/output', { seedLayerAtBirth: true, recentLayerThreshold: 0.25 });

    // mockReaddir should not have been called (no disk reads)
    expect(mockReaddir).not.toHaveBeenCalled();
    // mockQuery should not have been called (no LLM calls)
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('for generation 1 emits inheritance:composed event with (1, 0)', async () => {
    const emitSpy = vi.spyOn(lineageBus, 'emit');

    await composeInheritance(1, '/output', { seedLayerAtBirth: true, recentLayerThreshold: 0.25 });

    expect(emitSpy).toHaveBeenCalledWith('inheritance:composed', 1, 0);
    emitSpy.mockRestore();
  });

  it('for generation 2 with seedLayerAtBirth: true calls executeSeedCompression and returns non-null seedLayer', async () => {
    const tx1 = makeTransmission({ id: 'tx-gen1-1', generationNumber: 1 });

    // gen1 readdir + readFile for readAllPriorTransmissions(outputDir, 2)
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));
    // gen1 readdir + readFile for readGenerationTransmissions(outputDir, 1)
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));

    // Mock seed compression query
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Knowledge endures across time'));

    const result = await composeInheritance(2, '/output', { seedLayerAtBirth: true, recentLayerThreshold: 0.25 });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(result.seedLayer).not.toBeNull();
    expect(result.seedLayer).toContain('ANCESTRAL KNOWLEDGE');
    expect(result.seedTokens).toEqual(['Knowledge endures across time']);
  });

  it('for generation 2 with seedLayerAtBirth: false returns seedLayer: null without calling executeSeedCompression', async () => {
    const tx1 = makeTransmission({ id: 'tx-gen1-1', generationNumber: 1 });

    // gen1 readdir + readFile for readAllPriorTransmissions(outputDir, 2)
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));
    // gen1 readdir + readFile for readGenerationTransmissions(outputDir, 1)
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));

    const result = await composeInheritance(2, '/output', { seedLayerAtBirth: false, recentLayerThreshold: 0.25 });

    expect(mockQuery).not.toHaveBeenCalled();
    expect(result.seedLayer).toBeNull();
    expect(result.seedTokens).toEqual([]);
  });

  it('for generation 2 reads recent transmissions from generation 1 and returns formatted recentLayer', async () => {
    const tx1 = makeTransmission({ id: 'tx-gen1-1', generationNumber: 1, role: 'builder', citizenId: 'abcdefgh-1234' });

    // gen1 readdir + readFile for readAllPriorTransmissions(outputDir, 2)
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));
    // gen1 readdir + readFile for readGenerationTransmissions(outputDir, 1) -- recent layer
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));

    // Mock seed compression query
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Knowledge endures'));

    const result = await composeInheritance(2, '/output', { seedLayerAtBirth: true, recentLayerThreshold: 0.25 });

    expect(result.recentLayer).not.toBeNull();
    expect(result.recentLayer).toContain('INHERITANCE FROM GENERATION 1');
    expect(result.recentTokens).toEqual(['Water boils at 100 degrees Celsius', 'The earth orbits the sun']);
  });

  it('emits inheritance:composed event with (targetGeneration, layerCount) where layerCount is count of non-null layers', async () => {
    const emitSpy = vi.spyOn(lineageBus, 'emit');
    const tx1 = makeTransmission({ id: 'tx-gen1-1', generationNumber: 1 });

    // gen1 for readAllPriorTransmissions
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));
    // gen1 for readGenerationTransmissions
    mockReaddir.mockResolvedValueOnce(['c1-peak.json']);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(tx1));

    // Mock seed compression query
    mockQuery.mockReturnValueOnce(createMockQueryGenerator('[1] Knowledge endures'));

    await composeInheritance(2, '/output', { seedLayerAtBirth: true, recentLayerThreshold: 0.25 });

    // Both seed and recent layers should be non-null -> layerCount = 2
    expect(emitSpy).toHaveBeenCalledWith('inheritance:composed', 2, 2);
    emitSpy.mockRestore();
  });

  it('returns InheritancePackage with composedAt as ISO timestamp string', async () => {
    const result = await composeInheritance(1, '/output', { seedLayerAtBirth: true, recentLayerThreshold: 0.25 });

    expect(typeof result.composedAt).toBe('string');
    expect(new Date(result.composedAt).toISOString()).toBe(result.composedAt);
  });
});
