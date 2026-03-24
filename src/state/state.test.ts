import { describe, it, expect, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, readFile } from 'node:fs/promises';
import { nanoid } from 'nanoid';
import { LineageStateManager } from './manager.js';
import { SimulationParametersSchema } from '../schemas/simulation.js';
import type { SimulationParameters } from '../schemas/simulation.js';
import { lineageBus } from '../events/bus.js';

describe('LineageStateManager', () => {
  const testDirs: string[] = [];

  function makeTempDir(): string {
    const dir = join(tmpdir(), `lineage-test-${nanoid(8)}`);
    testDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of testDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    testDirs.length = 0;
    lineageBus.removeAllListeners();
  });

  it('write() writes JSON file that can be read back with read()', async () => {
    const dir = makeTempDir();
    const manager = new LineageStateManager(dir);
    const filePath = join(dir, 'sim-params.json');

    const params: SimulationParameters = SimulationParametersSchema.parse({
      seedProblem: 'What is consciousness?',
    });

    await manager.write(filePath, params, SimulationParametersSchema, 'simulation');
    const result = await manager.read(filePath, SimulationParametersSchema);

    expect(result.seedProblem).toBe('What is consciousness?');
    expect(result.generationSize).toBe(5);
    expect(result.maxGenerations).toBe(3);
    expect(result.mutationRate).toBe(0.3);
    expect(result.gen1Protection).toBe(true);
  });

  it('read() validates against schema (roundtrip with SimulationParametersSchema)', async () => {
    const dir = makeTempDir();
    const manager = new LineageStateManager(dir);
    const filePath = join(dir, 'roundtrip.json');

    const params: SimulationParameters = SimulationParametersSchema.parse({
      seedProblem: 'Roundtrip test',
      generationSize: 8,
      maxGenerations: 10,
    });

    await manager.write(filePath, params, SimulationParametersSchema, 'simulation');
    const result = await manager.read(filePath, SimulationParametersSchema);

    expect(result).toEqual(params);
  });

  it('read() throws ZodError for invalid JSON content', async () => {
    const dir = makeTempDir();
    const manager = new LineageStateManager(dir);
    const filePath = join(dir, 'invalid.json');

    // Write invalid data directly (bypass schema validation)
    const { writeFile: wf, mkdir: mkd } = await import('node:fs/promises');
    await mkd(dir, { recursive: true });
    await wf(filePath, JSON.stringify({ seedProblem: '' }), 'utf-8');

    await expect(manager.read(filePath, SimulationParametersSchema)).rejects.toThrow();
  });

  it('write() emits state:saved on lineageBus', async () => {
    const dir = makeTempDir();
    const manager = new LineageStateManager(dir);
    const filePath = join(dir, 'emit-test.json');

    const savedPaths: string[] = [];
    lineageBus.on('state:saved', (path) => {
      savedPaths.push(path);
    });

    const params: SimulationParameters = SimulationParametersSchema.parse({
      seedProblem: 'Event test',
    });

    await manager.write(filePath, params, SimulationParametersSchema, 'simulation');

    expect(savedPaths).toHaveLength(1);
    expect(savedPaths[0]).toBe(filePath);
  });

  it('read() emits state:loaded on lineageBus', async () => {
    const dir = makeTempDir();
    const manager = new LineageStateManager(dir);
    const filePath = join(dir, 'load-test.json');

    const loadedPaths: string[] = [];
    lineageBus.on('state:loaded', (path) => {
      loadedPaths.push(path);
    });

    const params: SimulationParameters = SimulationParametersSchema.parse({
      seedProblem: 'Load event test',
    });

    await manager.write(filePath, params, SimulationParametersSchema, 'simulation');
    await manager.read(filePath, SimulationParametersSchema);

    expect(loadedPaths).toHaveLength(1);
    expect(loadedPaths[0]).toBe(filePath);
  });
});
