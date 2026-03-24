import { describe, it, expect, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { nanoid } from 'nanoid';
import { loadConfig } from './loader.js';
import { DEFAULT_SIMULATION_PARAMETERS } from './defaults.js';

describe('loadConfig', () => {
  const testDirs: string[] = [];

  function makeTempDir(): string {
    const dir = join(tmpdir(), `lineage-config-test-${nanoid(8)}`);
    testDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of testDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    testDirs.length = 0;
  });

  it('returns SimulationParameters with seedProblem and all defaults filled', async () => {
    const config = await loadConfig('What is consciousness?', {});

    expect(config.seedProblem).toBe('What is consciousness?');
    expect(config.generationSize).toBe(5);
    expect(config.maxGenerations).toBe(3);
    expect(config.mutationRate).toBe(0.3);
    expect(config.largeMutationProbability).toBe(0.1);
    expect(config.gen1Protection).toBe(true);
    expect(config.outputDir).toBe('./output');
  });

  it('with { generations: "10" } returns config with maxGenerations=10', async () => {
    const config = await loadConfig('test', { generations: '10' });
    expect(config.maxGenerations).toBe(10);
  });

  it('with { size: "8" } returns config with generationSize=8', async () => {
    const config = await loadConfig('test', { size: '8' });
    expect(config.generationSize).toBe(8);
  });

  it('with { output: "/tmp/test" } returns config with outputDir=/tmp/test', async () => {
    const config = await loadConfig('test', { output: '/tmp/test' });
    expect(config.outputDir).toBe('/tmp/test');
  });

  it('with { config: "/nonexistent.json" } throws with helpful error message', async () => {
    await expect(
      loadConfig('test', { config: '/nonexistent.json' }),
    ).rejects.toThrow(/Failed to load config file/);
  });

  it('with valid JSON config file merges file values with CLI overrides (CLI wins)', async () => {
    const dir = makeTempDir();
    await mkdir(dir, { recursive: true });
    const configPath = join(dir, 'test-config.json');

    await writeFile(
      configPath,
      JSON.stringify({
        generationSize: 10,
        maxGenerations: 20,
        mutationRate: 0.5,
      }),
      'utf-8',
    );

    // CLI override for generations should win over file value
    const config = await loadConfig('test', {
      config: configPath,
      generations: '7',
    });

    expect(config.seedProblem).toBe('test');
    expect(config.maxGenerations).toBe(7); // CLI wins
    expect(config.generationSize).toBe(10); // From file
    expect(config.mutationRate).toBe(0.5); // From file
  });
});

describe('DEFAULT_SIMULATION_PARAMETERS', () => {
  it('contains generationSize=5, maxGenerations=3, mutationRate=0.3', () => {
    expect(DEFAULT_SIMULATION_PARAMETERS.generationSize).toBe(5);
    expect(DEFAULT_SIMULATION_PARAMETERS.maxGenerations).toBe(3);
    expect(DEFAULT_SIMULATION_PARAMETERS.mutationRate).toBe(0.3);
  });

  it('contains gen1Protection=true', () => {
    expect(DEFAULT_SIMULATION_PARAMETERS.gen1Protection).toBe(true);
  });

  it('contains outputDir=./output', () => {
    expect(DEFAULT_SIMULATION_PARAMETERS.outputDir).toBe('./output');
  });

  it('contains largeMutationProbability=0.1', () => {
    expect(DEFAULT_SIMULATION_PARAMETERS.largeMutationProbability).toBe(0.1);
  });

  it('contains peakTransmissionWindow with min=0.4 and max=0.5', () => {
    expect(DEFAULT_SIMULATION_PARAMETERS.peakTransmissionWindow).toEqual({
      min: 0.4,
      max: 0.5,
    });
  });

  it('contains inheritanceStagingRates with seedLayerAtBirth=true and recentLayerThreshold=0.25', () => {
    expect(DEFAULT_SIMULATION_PARAMETERS.inheritanceStagingRates).toEqual({
      seedLayerAtBirth: true,
      recentLayerThreshold: 0.25,
    });
  });

  it('does NOT contain seedProblem (always required from CLI)', () => {
    expect(DEFAULT_SIMULATION_PARAMETERS).not.toHaveProperty('seedProblem');
  });
});
