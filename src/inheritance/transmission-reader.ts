/**
 * TransmissionReader -- Reads transmission JSON files from disk by generation.
 *
 * Provides the disk I/O layer for the inheritance composer. Reads transmission
 * files written by transmission-writer.ts, validates them with TransmissionSchema,
 * and returns typed Transmission[] arrays. Handles missing generation directories
 * gracefully (returns empty arrays, not errors).
 *
 * File path convention: {outputDir}/transmissions/gen{N}/{citizenId}-{type}.json
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TransmissionSchema } from '../schemas/index.js';
import type { Transmission } from '../schemas/index.js';

/**
 * Read all transmission JSON files for a single generation.
 *
 * @param outputDir - The base output directory for the simulation run
 * @param generationNumber - The generation number to read (e.g., 1, 2, 3)
 * @returns Array of validated Transmission objects, or empty array if directory missing
 */
export async function readGenerationTransmissions(
  outputDir: string,
  generationNumber: number,
): Promise<Transmission[]> {
  const genDir = join(outputDir, 'transmissions', `gen${generationNumber}`);

  let files: string[];
  try {
    files = await readdir(genDir);
  } catch {
    // Directory doesn't exist (ENOENT) or other error -- return empty
    return [];
  }

  const jsonFiles = files.filter(file => file.endsWith('.json'));
  const transmissions: Transmission[] = [];

  for (const file of jsonFiles) {
    const raw = await readFile(join(genDir, file), 'utf-8');
    const parsed = JSON.parse(raw);
    transmissions.push(TransmissionSchema.parse(parsed));
  }

  return transmissions;
}

/**
 * Read all transmissions from generations prior to the given generation.
 *
 * For generation 3, reads gen1 and gen2. For generation 1, returns empty
 * (no prior generations exist).
 *
 * @param outputDir - The base output directory for the simulation run
 * @param upToGeneration - The current generation number (reads all before this)
 * @returns Combined array of Transmission objects from all prior generations
 */
export async function readAllPriorTransmissions(
  outputDir: string,
  upToGeneration: number,
): Promise<Transmission[]> {
  if (upToGeneration <= 1) {
    return [];
  }

  const allTransmissions: Transmission[] = [];

  for (let gen = 1; gen < upToGeneration; gen++) {
    const genTransmissions = await readGenerationTransmissions(outputDir, gen);
    allTransmissions.push(...genTransmissions);
  }

  return allTransmissions;
}
