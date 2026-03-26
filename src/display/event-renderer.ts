/**
 * EventRenderer -- real-time terminal output for LINEAGE simulation events.
 *
 * Subscribes to all lineageBus events, formats output via pure formatter functions,
 * manages an ora spinner for long-running phases, and accumulates per-generation
 * display state for summary tables at generation boundaries.
 *
 * Design decisions:
 * - attach()/detach() pattern with stored bound handlers for safe removal
 * - Never calls removeAllListeners -- only removes its own handlers
 * - Spinner stopped before every log, restarted after if in a spinnable phase
 * - Generation state accumulates citizen data for buildGenerationSummary() at generation:ended
 */

import ora from 'ora';
import type { Ora } from 'ora';
import { lineageBus } from '../events/index.js';
import type { SimulationParameters } from '../schemas/index.js';
import {
  formatBirth, formatDeath, formatTransmission, formatMutation,
  formatGenerationStart, formatGenerationEnd, formatInheritance,
  formatSimulationStart, formatSimulationEnd,
} from './formatters.js';
import {
  buildGenerationSummary, createGenerationDisplayState,
} from './generation-summary.js';
import type { GenerationDisplayState } from './generation-summary.js';

export class EventRenderer {
  private spinner: Ora | null = null;
  private currentGenState: GenerationDisplayState | null = null;

  /** Store bound handlers keyed by event name for safe detach. */
  private handlers = new Map<string, (...args: any[]) => void>();

  /**
   * Subscribe to all lineageBus events and begin rendering terminal output.
   */
  attach(): void {
    this.on('simulation:started', (seedProblem: string, _config: SimulationParameters) => {
      this.log(formatSimulationStart(seedProblem));
    });

    this.on('simulation:ended', (generationCount: number) => {
      this.stopSpinner();
      this.log(formatSimulationEnd(generationCount));
    });

    this.on('generation:started', (generationNumber: number, citizenCount: number) => {
      this.currentGenState = createGenerationDisplayState(generationNumber);
      this.log(formatGenerationStart(generationNumber, citizenCount));
      this.startSpinner('Citizens being born...');
    });

    this.on('citizen:born', (citizenId: string, role: string, generation: number) => {
      this.log(formatBirth(citizenId, role, generation));
      // Accumulate display state
      if (this.currentGenState) {
        this.currentGenState.citizens.set(citizenId, {
          id: citizenId,
          role,
          generation,
        });
      }
      this.startSpinner('Citizens interacting...');
    });

    this.on('citizen:died', (citizenId: string, deathProfile: string, generation: number) => {
      this.log(formatDeath(citizenId, deathProfile, generation));
      // Update display state
      if (this.currentGenState) {
        const citizen = this.currentGenState.citizens.get(citizenId);
        if (citizen) {
          citizen.deathProfile = deathProfile;
        }
      }
      this.startSpinner('Transmitting...');
    });

    this.on('citizen:peak-transmission', (citizenId: string, transmissionId: string) => {
      this.log(formatTransmission(citizenId, transmissionId));
      // Mark citizen as having transmitted
      if (this.currentGenState) {
        const citizen = this.currentGenState.citizens.get(citizenId);
        if (citizen) {
          citizen.transmitted = true;
          // Cross-reference: check if this citizen's transmission was mutated
          const mutType = this.currentGenState.mutatedTransmissions.get(transmissionId);
          if (mutType) {
            citizen.mutationType = mutType;
          }
        }
      }
      this.startSpinner('Processing transmissions...');
    });

    this.on('transmission:mutated', (transmissionId: string, mutationType: string) => {
      this.log(formatMutation(transmissionId, mutationType));
      // Record mutation for cross-reference in citizen:peak-transmission handler
      if (this.currentGenState) {
        this.currentGenState.mutatedTransmissions.set(transmissionId, mutationType);
      }
      this.startSpinner('Processing transmissions...');
    });

    this.on('inheritance:composed', (generationNumber: number, layerCount: number) => {
      this.log(formatInheritance(generationNumber, layerCount));
      this.startSpinner('Running generation...');
    });

    this.on('generation:ended', (generationNumber: number) => {
      this.stopSpinner();
      if (this.currentGenState) {
        this.log(buildGenerationSummary(this.currentGenState));
      }
      this.log(formatGenerationEnd(generationNumber));
      this.currentGenState = null;
    });
  }

  /**
   * Unsubscribe all display handlers from lineageBus. Safe -- only
   * removes handlers registered by this instance, not other listeners.
   */
  detach(): void {
    for (const [event, handler] of this.handlers) {
      lineageBus.removeListener(event as any, handler as any);
    }
    this.handlers.clear();
    this.stopSpinner();
    this.currentGenState = null;
  }

  /**
   * Register a handler for a lineageBus event, storing it for later detach.
   */
  private on(event: string, handler: (...args: any[]) => void): void {
    this.handlers.set(event, handler);
    lineageBus.on(event as any, handler as any);
  }

  /**
   * Stop spinner (if active) and print a message.
   */
  private log(message: string): void {
    this.stopSpinner();
    console.log(message);
  }

  /**
   * Stop and clear the current spinner if one is active.
   */
  private stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Start a new spinner with the given text. Stops any existing spinner first.
   */
  private startSpinner(text: string): void {
    this.stopSpinner();
    this.spinner = ora(text).start();
  }
}
