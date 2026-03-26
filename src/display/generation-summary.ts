/**
 * Generation summary table builder.
 *
 * Accumulates display state during a generation and builds a cli-table3
 * summary table showing who lived, who died, what was transmitted, and
 * what mutated. Pure function -- no side effects.
 *
 * Full implementation in Task 2 (TDD).
 */

import { createRequire } from 'node:module';
import chalk from 'chalk';
import { COLORS } from './formatters.js';

const require = createRequire(import.meta.url);
const Table = require('cli-table3') as typeof import('cli-table3');

export interface DisplayCitizen {
  id: string;
  role: string;
  generation: number;
  deathProfile?: string;
  transmitted?: boolean;
  mutationType?: string;
}

export interface GenerationDisplayState {
  generationNumber: number;
  citizens: Map<string, DisplayCitizen>;
  mutatedTransmissions: Map<string, string>;
}

export function createGenerationDisplayState(generationNumber: number): GenerationDisplayState {
  return {
    generationNumber,
    citizens: new Map(),
    mutatedTransmissions: new Map(),
  };
}

export function buildGenerationSummary(state: GenerationDisplayState): string {
  const table = new Table({
    head: [
      COLORS.generation('Citizen'),
      COLORS.generation('Role'),
      COLORS.generation('Death'),
      COLORS.generation('Transmitted'),
      COLORS.generation('Mutated'),
    ],
    style: { head: [], border: [] },
  });

  for (const citizen of state.citizens.values()) {
    const shortId = citizen.id.slice(0, 8);
    const transmitted = citizen.transmitted
      ? chalk.green('yes')
      : chalk.gray('no');
    const mutated = citizen.mutationType
      ? COLORS.mutation(citizen.mutationType)
      : chalk.gray('-');

    table.push([
      shortId,
      citizen.role,
      citizen.deathProfile ?? '-',
      transmitted,
      mutated,
    ]);
  }

  return table.toString();
}
