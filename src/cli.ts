import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { lineageBus } from './events/bus.js';
import type { SimulationParameters } from './schemas/simulation.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('lineage')
    .description('A civilization simulator where every citizen is an AI agent')
    .version('0.0.0')
    .argument('<seed-problem>', 'The philosophical problem for the civilization to explore')
    .option('-g, --generations <count>', 'maximum number of generations to simulate', '3')
    .option('-s, --size <count>', 'number of citizens per generation', '5')
    .option('-c, --config <path>', 'path to JSON config file')
    .option('-o, --output <dir>', 'output directory for state files', './output')
    .action(async (seedProblem: string, options: { generations: string; size: string; config?: string; output: string }) => {
      try {
        const config: SimulationParameters = await loadConfig(seedProblem, {
          generations: options.generations,
          size: options.size,
          config: options.config,
          output: options.output,
        });

        lineageBus.emit('simulation:started', config.seedProblem, config);

        console.log('LINEAGE - Simulation configured');
        console.log(`  Seed problem: ${config.seedProblem}`);
        console.log(`  Generations: ${config.maxGenerations}`);
        console.log(`  Citizens per generation: ${config.generationSize}`);
        console.log(`  Mutation rate: ${config.mutationRate}`);
        console.log(`  Gen 1 protection: ${config.gen1Protection}`);
        console.log(`  Output: ${config.outputDir}`);

        // Future phases will add simulation execution here
        console.log('---');
        console.log('Simulation bootstrap complete. Execution engine not yet implemented.');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        throw err;
      }
    });

  return program;
}

export const program = createProgram();

// Only parse when run directly (not when imported in tests)
const isDirectRun = process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js');
if (isDirectRun) {
  program.parseAsync(process.argv).catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
