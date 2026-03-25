import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises before any imports that use it
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

import { readGenerationTransmissions, readAllPriorTransmissions } from './transmission-reader.js';
import { TransmissionSchema } from '../schemas/index.js';
import type { Transmission } from '../schemas/index.js';

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
