/**
 * Citizen birth factory -- creates fully configured CitizenConfig instances.
 *
 * The birth factory wires mortality into every citizen from the start:
 * a death profile is secretly assigned at birth, the context budget begins
 * at zero, and the citizen:born event announces the arrival to the event bus.
 */

import { nanoid } from 'nanoid';
import type { CitizenRole, SimulationParameters } from '../schemas/index.js';
import { CitizenConfigSchema } from '../schemas/index.js';
import type { CitizenConfig } from '../schemas/index.js';
import { assignDeathProfile } from './death-profiles.js';
import { buildSystemPrompt } from '../roles/index.js';
import { lineageBus } from '../events/index.js';

/**
 * Create a new citizen with a hidden death profile and emit the citizen:born event.
 *
 * @param role - The citizen's assigned role (builder, skeptic, etc.)
 * @param generationNumber - Which generation this citizen belongs to
 * @param params - Simulation parameters (for death profile distribution and gen1Protection)
 * @returns A fully configured CitizenConfig ready for agent execution
 */
export function birthCitizen(
  role: CitizenRole,
  generationNumber: number,
  params: SimulationParameters,
): CitizenConfig {
  const deathProfile = assignDeathProfile(
    params.deathProfileDistribution,
    generationNumber,
    params.gen1Protection,
  );

  const citizenId = nanoid();
  const now = new Date().toISOString();

  // Parse through CitizenConfigSchema so AgentConfig defaults (model, tools,
  // status, allowedTools, permissionMode, maxTurns) are filled in by Zod.
  const citizen = CitizenConfigSchema.parse({
    id: citizenId,
    name: `citizen-gen${generationNumber}-${nanoid(6)}`,
    type: 'lineage-citizen',
    systemPrompt: buildSystemPrompt(role, {
      seedProblem: params.seedProblem,
      generationNumber: generationNumber,
      citizenName: `citizen-gen${generationNumber}-${nanoid(6)}`,
    }),
    role,
    generationNumber,
    deathProfile,
    contextBudget: 0,
    birthTimestamp: now,
    createdAt: now,
    updatedAt: now,
    transmissions: [],
  });

  lineageBus.emit('citizen:born', citizen.id, citizen.role, citizen.generationNumber);
  return citizen;
}
