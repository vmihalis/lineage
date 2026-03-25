/**
 * SeedExecutor -- Calls Agent SDK query() for LLM-powered seed compression.
 *
 * Takes a seed compression prompt (built by buildSeedCompressionPrompt) and
 * executes it against the Agent SDK, parsing the result via extractAnchorTokens.
 * Returns compressed tokens and usage statistics. On error, returns empty tokens
 * array gracefully (no crash).
 *
 * Follows the exact query() pattern from mutation-executor.ts: maxTurns: 1,
 * permissionMode: 'dontAsk', persistSession: false.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { extractAnchorTokens } from '../transmission/index.js';
import { SEED_COMPRESSION_SYSTEM_PROMPT } from './seed-layer.js';

export async function executeSeedCompression(
  prompt: string,
): Promise<{ tokens: string[]; usage: { inputTokens: number; outputTokens: number } }> {
  const gen = query({
    prompt,
    options: {
      systemPrompt: SEED_COMPRESSION_SYSTEM_PROMPT,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      persistSession: false,
    },
  });

  let resultText = '';
  let usage = { inputTokens: 0, outputTokens: 0 };

  for await (const msg of gen) {
    if (msg.type === 'result') {
      resultText = msg.subtype === 'success' ? msg.result : '';
      usage = {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      };
    }
  }

  const tokens = resultText ? extractAnchorTokens(resultText) : [];
  return { tokens, usage };
}
