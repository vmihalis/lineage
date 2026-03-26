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
 * Design decisions (Phase 11 -- active mortality):
 * - Single ContextBudget per generation tracks cumulative token consumption (LIFE-02)
 * - Per-citizen death thresholds checked manually after each turn
 * - Decline signals accumulated per-citizen, prepended to peak prompt (LIFE-04)
 * - Accident citizens terminated without peak transmission (LIFE-05)
 * - Actual budget.percentage used for peak prompt, not hardcoded 0.45 (LIFE-03)
 * - citizen:died emitted during DYING or INTERACTING (accident) phase
 */

import { nanoid } from 'nanoid';
import { join } from 'node:path';
import type { Generation, SimulationParameters, CitizenConfig, Transmission } from '../schemas/index.js';
import { GenerationSchema } from '../schemas/index.js';
import { assignRoles } from '../roles/role-assignment.js';
import { birthCitizen } from '../mortality/citizen-lifecycle.js';
import { ContextBudget } from '../mortality/index.js';
import type { ContextThreshold } from '../mortality/index.js';
import {
  createDeathThresholds,
  getDeclineSignal,
  PEAK_TRANSMISSION_LABEL,
  ACCIDENT_DEATH_LABEL,
} from '../mortality/index.js';
import { executeCitizenTurn } from '../interaction/turn-runner.js';
import { buildTurnPrompt } from '../interaction/handoff.js';
import type { TurnOutput } from '../interaction/turn-output.js';
import { buildPeakTransmissionPrompt } from '../transmission/peak-prompt.js';
import { executePeakTransmission } from '../transmission/transmission-executor.js';
import { writeTransmission } from '../transmission/transmission-writer.js';
import { mutateTransmission } from '../mutation/mutation-pipeline.js';
import { LineageStateManager } from '../state/index.js';
import { lineageBus } from '../events/index.js';

interface CitizenMortality {
  citizen: CitizenConfig;
  thresholds: ContextThreshold[];
  firedLabels: Set<string>;
  isDead: boolean;
  peakTransmissionCollected: boolean;
  declineSignals: string[];
}

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

  // Create a single ContextBudget for the generation (LIFE-02, LIFE-03)
  const budget = new ContextBudget({
    contextWindow: params.contextWindow ?? 200_000,
    safetyBuffer: 0.20,
    thresholds: [],
  });

  // Create per-citizen mortality tracking
  const citizenMortality: CitizenMortality[] = citizens.map(citizen => ({
    citizen,
    thresholds: createDeathThresholds(citizen.deathProfile, {
      peakTransmissionMin: params.peakTransmissionWindow.min,
    }),
    firedLabels: new Set<string>(),
    isDead: false,
    peakTransmissionCollected: false,
    declineSignals: [],
  }));

  // INTERACTING -- mortality-aware per-citizen turn loop
  generation.phase = 'INTERACTING';
  const enrichedSeedProblem = [seedLayer, recentLayer, params.seedProblem]
    .filter(Boolean)
    .join('\n\n');

  const turns: TurnOutput[] = [];
  const collectedTransmissions: Transmission[] = [];

  for (let i = 0; i < citizens.length; i++) {
    const mortality = citizenMortality[i];
    if (mortality.isDead) continue;

    const prompt = buildTurnPrompt(enrichedSeedProblem, turns);
    const turnOutput = await executeCitizenTurn(mortality.citizen, prompt, i + 1);
    turns.push(turnOutput);

    // Update budget with actual token usage (LIFE-02)
    budget.update(turnOutput.usage.inputTokens, turnOutput.usage.outputTokens);
    const currentPct = budget.percentage;

    // Check this citizen's thresholds
    for (const threshold of mortality.thresholds) {
      if (currentPct >= threshold.percentage && !mortality.firedLabels.has(threshold.label)) {
        mortality.firedLabels.add(threshold.label);

        if (threshold.label === ACCIDENT_DEATH_LABEL) {
          // LIFE-05: Accident death -- immediate termination, no peak transmission
          mortality.isDead = true;
          lineageBus.emit('citizen:died', mortality.citizen.id, 'accident', mortality.citizen.generationNumber);
        } else if (threshold.label === PEAK_TRANSMISSION_LABEL) {
          // Peak transmission triggered by context consumption
          const peakPrompt = buildPeakTransmissionPrompt(mortality.citizen, currentPct);
          const { transmission } = await executePeakTransmission(mortality.citizen, peakPrompt);
          collectedTransmissions.push(transmission);
          mortality.peakTransmissionCollected = true;
        } else {
          // LIFE-04: Decline signal -- accumulate for injection into peak prompt
          const signal = getDeclineSignal(threshold.label, currentPct);
          if (signal) mortality.declineSignals.push(signal);
        }
      }
    }
  }

  // DYING -- surviving citizens who haven't yet transmitted
  generation.phase = 'DYING';
  for (const mortality of citizenMortality) {
    if (mortality.isDead || mortality.peakTransmissionCollected) continue;

    // Use actual budget percentage, not hardcoded 0.45 (LIFE-02, LIFE-03)
    const currentPct = budget.percentage;
    let peakPrompt = buildPeakTransmissionPrompt(mortality.citizen, currentPct);

    // LIFE-04: Prepend accumulated decline signals for old-age citizens
    if (mortality.declineSignals.length > 0) {
      peakPrompt = mortality.declineSignals.join('\n\n') + '\n\n' + peakPrompt;
    }

    const { transmission } = await executePeakTransmission(mortality.citizen, peakPrompt);
    collectedTransmissions.push(transmission);
    lineageBus.emit('citizen:died', mortality.citizen.id, mortality.citizen.deathProfile, mortality.citizen.generationNumber);
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

  // Persist generation state to disk
  const stateManager = new LineageStateManager(params.outputDir);
  const genFilePath = join(params.outputDir, 'generations', `gen${generationNumber}.json`);
  await stateManager.write(genFilePath, generation, GenerationSchema, 'generation');

  lineageBus.emit('generation:ended', generationNumber);

  return generation;
}
