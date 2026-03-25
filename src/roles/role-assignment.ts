/**
 * Role assignment via weighted random selection.
 *
 * Follows the same pattern as assignDeathProfile() in death-profiles.ts:
 * iterate entries, accumulate weights, return on roll < cumulative.
 */

import type { CitizenRole, RoleDistribution } from '../schemas/index.js';

/**
 * Assign a single role via weighted random selection from the configured distribution.
 *
 * @param distribution - Weights for each role (must sum to ~1.0)
 * @returns The assigned citizen role
 */
export function assignRole(distribution: RoleDistribution): CitizenRole {
  const roll = Math.random();
  let cumulative = 0;

  const entries = Object.entries(distribution) as [CitizenRole, number][];
  for (const [role, weight] of entries) {
    cumulative += weight;
    if (roll < cumulative) {
      return role;
    }
  }

  // Fallback guard against floating point edge case (roll === 1.0 exactly)
  return 'builder';
}

/**
 * Assign roles for an entire generation.
 *
 * @param generationSize - Number of citizens to assign roles for
 * @param distribution - Weights for each role (must sum to ~1.0)
 * @returns Array of assigned roles matching generationSize length
 */
export function assignRoles(
  generationSize: number,
  distribution: RoleDistribution,
): CitizenRole[] {
  const roles: CitizenRole[] = [];
  for (let i = 0; i < generationSize; i++) {
    roles.push(assignRole(distribution));
  }
  return roles;
}
