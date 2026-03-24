/**
 * Death profile assignment and accident point calculation.
 *
 * Death profiles determine HOW a citizen dies. Old-age citizens live to the end
 * of their context budget; accident citizens die suddenly at a random point.
 * Generation 1 can be protected from random death to ensure the civilization
 * has a stable foundation.
 */

import type { DeathProfile, DeathProfileDistribution } from '../schemas/index.js';

/**
 * Assign a death profile via weighted random selection from the configured distribution.
 *
 * @param distribution - Weights for each death profile (must sum to ~1.0)
 * @param generationNumber - Which generation this citizen belongs to
 * @param gen1Protection - If true, generation 1 citizens always get 'old-age'
 * @returns The assigned death profile
 */
export function assignDeathProfile(
  distribution: DeathProfileDistribution,
  generationNumber: number,
  gen1Protection: boolean,
): DeathProfile {
  // Generation 1 protection: always old-age for the founding generation
  if (gen1Protection && generationNumber === 1) {
    return 'old-age';
  }

  // Weighted random selection
  const roll = Math.random();
  let cumulative = 0;

  const entries = Object.entries(distribution) as [DeathProfile, number][];
  for (const [profile, weight] of entries) {
    cumulative += weight;
    if (roll < cumulative) {
      return profile;
    }
  }

  // Fallback guard against floating point edge case (roll === 1.0 exactly)
  return 'old-age';
}

/**
 * Calculate a random accident termination point within the context budget.
 * Returns a value between 0.3 and 0.7 (30-70% of effective capacity).
 *
 * This range ensures accident citizens have enough context to do meaningful work
 * before dying, but die early enough that their death is disruptive.
 */
export function calculateAccidentPoint(): number {
  return 0.3 + Math.random() * 0.4;
}
