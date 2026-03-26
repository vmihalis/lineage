/**
 * Pure event formatter functions.
 *
 * Each function maps event arguments (matching LineageEvents signatures)
 * to a chalk-colored string. No side effects, no console.log calls.
 *
 * Color scheme:
 *   births = green, deaths = red, transmissions = blue, mutations = yellow
 *   generation boundaries = magenta, inheritance = cyan, simulation = bold white
 */

import chalk from 'chalk';

/** Reusable chalk color functions by event category. */
export const COLORS = {
  birth: chalk.green,
  death: chalk.red,
  transmission: chalk.blue,
  mutation: chalk.yellow,
  generation: chalk.magenta,
  inheritance: chalk.cyan,
  simulation: chalk.bold.white,
} as const;

/** Truncate an ID to 8 chars for compact display. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

export function formatBirth(citizenId: string, role: string, generation: number): string {
  return COLORS.birth(`  + ${chalk.bold(shortId(citizenId))} born as ${chalk.cyan(role)} (gen ${generation})`);
}

export function formatDeath(citizenId: string, deathProfile: string, generation: number): string {
  return COLORS.death(`  x ${chalk.bold(shortId(citizenId))} died of ${chalk.yellow(deathProfile)} (gen ${generation})`);
}

export function formatTransmission(citizenId: string, transmissionId: string): string {
  return COLORS.transmission(`  > ${shortId(citizenId)} transmitted ${chalk.dim(shortId(transmissionId))}`);
}

export function formatMutation(transmissionId: string, mutationType: string): string {
  return COLORS.mutation(`  ~ ${shortId(transmissionId)} mutated (${mutationType})`);
}

export function formatGenerationStart(generationNumber: number, citizenCount: number): string {
  const line = COLORS.generation('━'.repeat(48));
  const header = COLORS.generation(`  Generation ${generationNumber} — ${citizenCount} citizens`);
  return `\n${line}\n${header}\n${line}`;
}

export function formatGenerationEnd(generationNumber: number): string {
  return COLORS.generation(`  Generation ${generationNumber} complete`);
}

export function formatInheritance(generationNumber: number, layerCount: number): string {
  return COLORS.inheritance(`  ◆ Inheritance composed for gen ${generationNumber} (${layerCount} layers)`);
}

export function formatSimulationStart(seedProblem: string): string {
  const border = COLORS.simulation('═'.repeat(52));
  const title = COLORS.simulation('  LINEAGE — Civilization Simulator');
  const seed = COLORS.simulation(`  Seed: "${seedProblem}"`);
  return `\n${border}\n${title}\n${seed}\n${border}`;
}

export function formatSimulationEnd(generationCount: number): string {
  const border = COLORS.simulation('═'.repeat(52));
  const msg = COLORS.simulation(`  Simulation complete — ${generationCount} generations`);
  return `\n${border}\n${msg}\n${border}\n`;
}
