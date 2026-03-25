/**
 * GenerationRunner -- Single generation lifecycle state machine.
 *
 * Orchestrates all eight subsystems (roles, mortality, interaction, transmission,
 * mutation) through the generation state machine:
 * INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE
 *
 * Each citizen is born with a role and hidden death profile, interacts turn-based
 * with other citizens, produces a peak transmission at the DYING phase, and has
 * their transmission optionally mutated in the TRANSMITTING phase before the
 * generation completes.
 *
 * Design decisions:
 * - All citizens complete turns before any die (simplified mortality for v1)
 * - Peak transmissions collected during DYING, mutated and written during TRANSMITTING
 * - Fixed 0.45 contextPercentage for peak prompt (midpoint of default window)
 * - citizen:died emitted during DYING after peak transmission is produced
 */

import { nanoid } from 'nanoid';
import type { Generation, SimulationParameters, CitizenConfig, Transmission } from '../schemas/index.js';
import { GenerationSchema } from '../schemas/index.js';
import { assignRoles } from '../roles/role-assignment.js';
import { birthCitizen } from '../mortality/citizen-lifecycle.js';
import { runTurns } from '../interaction/turn-runner.js';
import { buildPeakTransmissionPrompt } from '../transmission/peak-prompt.js';
import { executePeakTransmission } from '../transmission/transmission-executor.js';
import { writeTransmission } from '../transmission/transmission-writer.js';
import { mutateTransmission } from '../mutation/mutation-pipeline.js';
import { lineageBus } from '../events/index.js';

export async function runGeneration(
  generationNumber: number,
  params: SimulationParameters,
  seedLayer: string | null,
  recentLayer: string | null,
): Promise<Generation> {
  // INIT
  const generation = GenerationSchema.parse({
    id: nanoid(),
    number: generationNumber,
    phase: 'INIT',
    citizenIds: [],
    transmissionIds: [],
    startedAt: new Date().toISOString(),
  });

  // BIRTHING
  generation.phase = 'BIRTHING';
  const roles = assignRoles(params.generationSize, params.roleDistribution);
  const citizens: CitizenConfig[] = roles.map(role =>
    birthCitizen(role, generationNumber, params),
  );
  generation.citizenIds = citizens.map(c => c.id);
  lineageBus.emit('generation:started', generationNumber, citizens.length);

  // INTERACTING
  generation.phase = 'INTERACTING';
  const enrichedSeedProblem = [seedLayer, recentLayer, params.seedProblem]
    .filter(Boolean)
    .join('\n\n');
  await runTurns({ seedProblem: enrichedSeedProblem, citizens });

  // DYING -- each citizen produces a peak transmission
  generation.phase = 'DYING';
  const collectedTransmissions: Transmission[] = [];
  for (const citizen of citizens) {
    const peakPrompt = buildPeakTransmissionPrompt(citizen, 0.45);
    const { transmission } = await executePeakTransmission(citizen, peakPrompt);
    collectedTransmissions.push(transmission);
    lineageBus.emit('citizen:died', citizen.id, citizen.deathProfile, citizen.generationNumber);
  }

  // TRANSMITTING -- mutate and write final transmissions
  generation.phase = 'TRANSMITTING';
  for (const original of collectedTransmissions) {
    const result = await mutateTransmission(
      original,
      params.mutationRate,
      params.largeMutationProbability,
    );
    await writeTransmission(result.transmission, params.outputDir);
    generation.transmissionIds.push(result.transmission.id);
  }

  // COMPLETE
  generation.phase = 'COMPLETE';
  generation.endedAt = new Date().toISOString();
  lineageBus.emit('generation:ended', generationNumber);

  return generation;
}
