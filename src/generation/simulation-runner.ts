/**
 * SimulationRunner -- Multi-generation outer loop.
 *
 * Iterates exactly maxGenerations times, composing inheritance at each boundary
 * and passing inherited layers to the next generation's runGeneration call.
 *
 * Emits simulation:started and simulation:ended events on lineageBus.
 * Returns the array of completed Generation objects for metrics/reporting.
 */

import type { SimulationParameters, Generation } from '../schemas/index.js';
import { composeInheritance } from '../inheritance/inheritance-composer.js';
import { lineageBus } from '../events/index.js';
import { runGeneration } from './generation-runner.js';

export async function runSimulation(
  params: SimulationParameters,
): Promise<Generation[]> {
  lineageBus.emit('simulation:started', params.seedProblem, params);
  const generations: Generation[] = [];

  for (let gen = 1; gen <= params.maxGenerations; gen++) {
    const inheritance = await composeInheritance(
      gen,
      params.outputDir,
      params.inheritanceStagingRates,
    );

    const generation = await runGeneration(
      gen,
      params,
      inheritance.seedLayer,
      inheritance.recentLayer,
    );
    generations.push(generation);
  }

  lineageBus.emit('simulation:ended', generations.length);
  return generations;
}
