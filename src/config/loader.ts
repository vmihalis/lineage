import { readFile } from 'node:fs/promises';
import { SimulationParametersSchema } from '../schemas/simulation.js';
import type { SimulationParameters } from '../schemas/simulation.js';

export interface CliOptions {
  config?: string;
  generations?: string;
  size?: string;
  output?: string;
}

export async function loadConfig(
  seedProblem: string,
  options: CliOptions,
): Promise<SimulationParameters> {
  let rawConfig: Record<string, unknown> = {};

  if (options.config) {
    try {
      const fileContent = await readFile(options.config, 'utf-8');
      rawConfig = JSON.parse(fileContent) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load config file '${options.config}': ${message}`);
    }
  }

  // CLI overrides take precedence over file config
  if (options.generations) rawConfig.maxGenerations = parseInt(options.generations, 10);
  if (options.size) rawConfig.generationSize = parseInt(options.size, 10);
  if (options.output) rawConfig.outputDir = options.output;
  rawConfig.seedProblem = seedProblem;

  return SimulationParametersSchema.parse(rawConfig);
}
