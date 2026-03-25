/**
 * MutationExecutor -- Calls Agent SDK query() to semantically transform a single anchor token.
 *
 * Uses the exact query() pattern from transmission-executor.ts: maxTurns: 1, permissionMode: 'dontAsk',
 * persistSession: false. The mutation system prompt frames the LLM as an imperfect transmission medium.
 * On error or empty result, returns the original token unchanged (no silent corruption).
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { MUTATION_SYSTEM_PROMPT, buildSmallMutationPrompt, buildLargeMutationPrompt } from './mutation-prompts.js';
import type { MutationType } from './mutation-decider.js';

export async function executeMutation(
  anchorToken: string,
  mutationType: MutationType,
): Promise<string> {
  const prompt = mutationType === 'small'
    ? buildSmallMutationPrompt(anchorToken)
    : buildLargeMutationPrompt(anchorToken);

  const gen = query({
    prompt,
    options: {
      systemPrompt: MUTATION_SYSTEM_PROMPT,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      persistSession: false,
    },
  });

  let resultText = '';
  for await (const msg of gen) {
    if (msg.type === 'result') {
      resultText = msg.subtype === 'success'
        ? msg.result
        : anchorToken;
    }
  }

  const cleaned = resultText.trim().replace(/^["']|["']$/g, '');
  return cleaned.length > 0 ? cleaned : anchorToken;
}
