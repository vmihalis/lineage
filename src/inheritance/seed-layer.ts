/**
 * SeedLayer -- Builds prompts for LLM-powered seed compression and formats
 * seed layer text for delivery to new citizens.
 *
 * The seed layer represents the oldest, most enduring wisdom of a civilization.
 * It is created by compressing all prior generations' anchor tokens into 3-5
 * essential claims via an LLM call. The compression prompt groups tokens by
 * generation with provenance, and the output format uses [N] anchor token
 * notation for compatibility with extractAnchorTokens.
 */

/**
 * System prompt for the seed compression LLM call.
 * Frames the LLM as the collective memory of a civilization.
 */
export const SEED_COMPRESSION_SYSTEM_PROMPT =
  `You are the collective memory of a civilization.
Knowledge from multiple generations has been transmitted to you. Some ideas appear repeatedly across generations -- these are the civilization's most durable wisdom. Some ideas appear only once -- these may be recent or may have been lost. Your task is to identify and compress the most enduring knowledge into a small number of essential claims. Output ONLY numbered claims in [N] format.`;

/**
 * Build the user prompt for seed compression.
 *
 * Groups anchor tokens by generation with provenance headers, then instructs
 * the LLM to compress into 3-5 essential claims using [N] format.
 *
 * @param tokensByGeneration - Map of generation number to anchor token strings
 * @param targetGeneration - The generation this compressed seed will be delivered to
 * @returns The formatted user prompt string
 */
export function buildSeedCompressionPrompt(
  tokensByGeneration: Map<number, string[]>,
  targetGeneration: number,
): string {
  const lines: string[] = [];

  lines.push('--- CIVILIZATION KNOWLEDGE ARCHIVE ---');
  lines.push(
    `The following is the accumulated transmitted knowledge from ${tokensByGeneration.size} generation(s) of civilization, being prepared for generation ${targetGeneration}.`,
  );
  lines.push('');

  // Sort by generation number for deterministic ordering
  const sortedGens = [...tokensByGeneration.entries()].sort(
    ([a], [b]) => a - b,
  );

  for (const [gen, tokens] of sortedGens) {
    lines.push(`Generation ${gen} transmitted:`);
    for (const token of tokens) {
      lines.push(`  - ${token}`);
    }
    lines.push('');
  }

  lines.push('Compress the most enduring, most repeated ideas into 3-5 essential claims.');
  lines.push('Ideas that appear across multiple generations are more durable than ideas from a single generation.');
  lines.push('Format as numbered claims: [1] ... [2] ... etc.');
  lines.push('Return ONLY the numbered claims. No preamble, no explanation.');

  return lines.join('\n');
}

/**
 * Format compressed seed tokens as structured text for citizen delivery.
 *
 * Produces ANCESTRAL KNOWLEDGE header with generation provenance and
 * bullet-point token list. Returns empty string for empty token arrays.
 *
 * @param seedTokens - The compressed seed tokens (output of seed compression LLM call)
 * @param generationCount - Number of generations the seed was distilled from
 * @returns Formatted seed layer text, or empty string if no tokens
 */
export function formatSeedLayer(
  seedTokens: string[],
  generationCount: number,
): string {
  if (seedTokens.length === 0) {
    return '';
  }

  const lines: string[] = [];

  lines.push(`ANCESTRAL KNOWLEDGE (distilled from ${generationCount} generation(s)):`);
  lines.push('The following represents the oldest, most enduring wisdom of your civilization.');
  lines.push('');

  for (const token of seedTokens) {
    lines.push(`- ${token}`);
  }

  lines.push('');
  lines.push('This knowledge has survived across generations. Treat it as your civilization\'s foundation.');

  return lines.join('\n');
}
