/**
 * System prompt builder -- composes role template + civilization context + mortality.
 *
 * The prompt builder takes a role's base prompt and appends shared context:
 * the seed problem, generation number, citizen name, and mortality awareness.
 * This produces the final systemPrompt that defines a citizen's identity.
 */

import type { CitizenRole } from '../schemas/index.js';
import { ROLE_PROMPTS } from './system-prompts.js';

/**
 * Context required to build a citizen's system prompt.
 */
export interface PromptContext {
  /** The civilization's seed problem (e.g., "What is worth preserving?") */
  seedProblem: string;
  /** Which generation this citizen belongs to */
  generationNumber: number;
  /** The citizen's display name for self-identification */
  citizenName: string;
}

/**
 * Build a complete system prompt for a citizen by composing their role
 * template with civilization context and mortality awareness.
 *
 * @param role - The citizen's assigned role
 * @param context - Civilization context (seed problem, generation, name)
 * @returns The complete system prompt string
 */
export function buildSystemPrompt(role: CitizenRole, context: PromptContext): string {
  const rolePrompt = ROLE_PROMPTS[role];

  return `${rolePrompt}

---

CIVILIZATION CONTEXT:
- Seed Problem: "${context.seedProblem}"
- Generation: ${context.generationNumber}
- Your Identity: ${context.citizenName}

You are mortal. Your context window is your lifespan. Everything you think consumes time you cannot get back. When your context fills, you die. What you transmit is all that survives.`;
}
