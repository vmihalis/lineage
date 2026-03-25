/**
 * RecentLayer -- Formats transmissions from the immediately previous generation
 * as structured text for delivery to new citizens.
 *
 * The recent layer provides the most immediate inheritance context -- what
 * the previous generation's citizens produced. Each transmission is formatted
 * with role and citizen provenance, and anchor tokens are listed as bullet
 * points. This follows the same formatting patterns as handoff.ts for
 * consistency across the codebase.
 */

import type { Transmission } from '../schemas/index.js';

/**
 * Format recent generation transmissions as structured text.
 *
 * Produces INHERITANCE FROM GENERATION header with per-transmission
 * role/citizen context and bullet-point anchor tokens. Returns empty
 * string for empty transmission arrays.
 *
 * @param recentTransmissions - Transmissions from the previous generation
 * @param fromGeneration - The generation number these transmissions came from
 * @returns Formatted recent layer text, or empty string if no transmissions
 */
export function formatRecentLayer(
  recentTransmissions: Transmission[],
  fromGeneration: number,
): string {
  if (recentTransmissions.length === 0) {
    return '';
  }

  const lines: string[] = [];

  lines.push(`INHERITANCE FROM GENERATION ${fromGeneration}:`);
  lines.push('The following knowledge was transmitted by citizens of the previous generation.');
  lines.push('');

  for (const tx of recentTransmissions) {
    lines.push(`--- ${tx.role} (citizen ${tx.citizenId.slice(0, 8)}) ---`);
    for (const token of tx.anchorTokens) {
      lines.push(`- ${token}`);
    }
    lines.push('');
  }

  lines.push('Consider this inherited knowledge alongside the seed problem. Build on it, question it, or preserve it based on your role.');

  return lines.join('\n');
}
