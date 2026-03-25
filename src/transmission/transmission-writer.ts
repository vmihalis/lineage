/**
 * TransmissionWriter -- Persists a Transmission to disk and emits events.
 *
 * After executePeakTransmission produces a validated Transmission object,
 * this function handles the side effects: writing to the output directory
 * via LineageStateManager (which provides atomic writes) and emitting the
 * citizen:peak-transmission event on the lineage event bus.
 *
 * File path convention: {outputDir}/transmissions/gen{N}/{citizenId}-{type}.json
 * This convention groups transmissions by generation for easy traversal
 * by the inheritance composer (Phase 8).
 */

import { join } from 'node:path';
import type { Transmission } from '../schemas/index.js';
import { TransmissionSchema } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';
import { LineageStateManager } from '../state/index.js';

/**
 * Write a transmission to disk and emit the peak-transmission event.
 *
 * @param transmission - A TransmissionSchema-validated transmission object
 * @param outputDir - The base output directory for the simulation run
 * @returns The full file path where the transmission was written
 */
export async function writeTransmission(
  transmission: Transmission,
  outputDir: string,
): Promise<string> {
  const stateManager = new LineageStateManager(outputDir);
  const filePath = join(
    outputDir,
    'transmissions',
    `gen${transmission.generationNumber}`,
    `${transmission.citizenId}-${transmission.type}.json`,
  );

  await stateManager.write(filePath, transmission, TransmissionSchema, 'transmission');
  lineageBus.emit('citizen:peak-transmission', transmission.citizenId, transmission.id);
  return filePath;
}
