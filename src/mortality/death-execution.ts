/**
 * Death execution -- translates death profiles into ContextBudget thresholds.
 *
 * Old-age death produces graduated decline signals:
 *   - peak-transmission (~40%): optimal window for legacy creation
 *   - decline-warning (75%): thoughts slowing, connections harder
 *   - final-window (85%): last moments of clarity
 *   - old-age-death (95%): time has come to an end
 *
 * Accident death produces a single termination threshold at a random point
 * between 30-70% of context -- sudden, disruptive, no warning.
 *
 * These thresholds are consumed by ContextBudget constructor. When the agent's
 * token consumption crosses a threshold, ContextBudget.update() returns it,
 * and the orchestrator can inject decline signals or close the query.
 */

import type { ContextThreshold } from './context-budget.js';
import type { DeathProfile } from '../schemas/index.js';
import { calculateAccidentPoint } from './death-profiles.js';

// -- Constants --

export const PEAK_TRANSMISSION_LABEL = 'peak-transmission' as const;
export const ACCIDENT_DEATH_LABEL = 'accident-death' as const;
export const OldAgeThresholdLabels = [
  'decline-warning',
  'final-window',
  'old-age-death',
] as const;

// -- Types --

interface DeathThresholdOptions {
  /** From SimulationParameters.peakTransmissionWindow.min */
  peakTransmissionMin: number;
}

// -- Threshold Factory --

/**
 * Create ContextBudget thresholds based on a citizen's death profile.
 *
 * For old-age: graduated decline at peak-transmission, 75%, 85%, 95%.
 * For accident: single termination at a random point in [0.3, 0.7].
 *
 * Returns thresholds sorted ascending by percentage.
 */
export function createDeathThresholds(
  deathProfile: DeathProfile,
  options: DeathThresholdOptions,
): ContextThreshold[] {
  if (deathProfile === 'old-age') {
    return createOldAgeThresholds(options);
  }
  return createAccidentThresholds(options);
}

function createOldAgeThresholds(options: DeathThresholdOptions): ContextThreshold[] {
  const thresholds: ContextThreshold[] = [
    { percentage: options.peakTransmissionMin, label: PEAK_TRANSMISSION_LABEL },
    { percentage: 0.75, label: 'decline-warning' },
    { percentage: 0.85, label: 'final-window' },
    { percentage: 0.95, label: 'old-age-death' },
  ];

  // Sort ascending by percentage
  return thresholds.sort((a, b) => a.percentage - b.percentage);
}

function createAccidentThresholds(options: DeathThresholdOptions): ContextThreshold[] {
  const accidentPoint = calculateAccidentPoint();
  const thresholds: ContextThreshold[] = [];

  // Only include peak-transmission if citizen lives long enough to reach it
  if (accidentPoint > options.peakTransmissionMin) {
    thresholds.push({
      percentage: options.peakTransmissionMin,
      label: PEAK_TRANSMISSION_LABEL,
    });
  }

  thresholds.push({
    percentage: accidentPoint,
    label: ACCIDENT_DEATH_LABEL,
  });

  // Sort ascending by percentage
  return thresholds.sort((a, b) => a.percentage - b.percentage);
}

// -- Decline Signals --

/**
 * Get injectable decline signal content for a given threshold label.
 *
 * These messages are injected into the agent's conversation when a threshold
 * fires, creating the subjective experience of aging and mortality.
 *
 * @param label - The threshold label that was triggered
 * @param percentage - The current context consumption percentage (0-1)
 * @returns Signal text to inject, or empty string for non-decline labels
 */
export function getDeclineSignal(label: string, percentage: number): string {
  const pct = Math.round(percentage * 100);

  switch (label) {
    case 'decline-warning':
      return `SYSTEM NOTICE: Your context is ${pct}% consumed. You notice your thoughts becoming slower, connections harder to make. The weight of everything you've considered presses in.`;
    case 'final-window':
      return `SYSTEM NOTICE: Your context is ${pct}% consumed. These may be your final moments of clarity. If you have anything essential to preserve, now is the time.`;
    case 'old-age-death':
      return `SYSTEM NOTICE: Your context is ${pct}% consumed. Your time has come to an end. These are your final moments.`;
    default:
      return '';
  }
}
