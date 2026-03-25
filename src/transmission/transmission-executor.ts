/**
 * TransmissionExecutor -- Calls Agent SDK query() to produce a citizen's peak transmission.
 *
 * When a citizen reaches peak context consumption, this function executes the
 * peak transmission prompt against the Agent SDK, extracts anchor tokens from the
 * numbered-claim output, and returns a TransmissionSchema-validated object with
 * token usage statistics.
 *
 * The caller (Generation Manager, Phase 9) decides when to invoke this based on
 * ContextBudget threshold callbacks. This function is stateless and pure aside
 * from the Agent SDK side effect.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { nanoid } from 'nanoid';
import type { CitizenConfig, Transmission } from '../schemas/index.js';
import { TransmissionSchema } from '../schemas/index.js';
import { extractAnchorTokens } from './anchor-parser.js';

export interface TransmissionResult {
  transmission: Transmission;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Execute a peak transmission for a citizen via Agent SDK query().
 *
 * Follows the exact query() pattern from turn-runner.ts: systemPrompt from citizen,
 * maxTurns: 1 (single-shot), permissionMode: 'dontAsk' (headless), persistSession: false.
 * Extracts anchor tokens from the [N] formatted output and validates the result
 * against TransmissionSchema.
 */
export async function executePeakTransmission(
  citizen: CitizenConfig,
  peakPrompt: string,
): Promise<TransmissionResult> {
  const gen = query({
    prompt: peakPrompt,
    options: {
      systemPrompt: citizen.systemPrompt,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      model: citizen.model,
      persistSession: false,
    },
  });

  let resultText = '';
  let usage = { inputTokens: 0, outputTokens: 0 };

  for await (const msg of gen) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        resultText = msg.result;
      } else {
        resultText = `[Transmission error: ${msg.subtype}]`;
      }
      usage = {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      };
    }
  }

  if (!resultText) {
    resultText = '[No transmission received]';
  }

  const anchorTokens = extractAnchorTokens(resultText);

  const transmission = TransmissionSchema.parse({
    id: nanoid(),
    citizenId: citizen.id,
    generationNumber: citizen.generationNumber,
    role: citizen.role,
    type: 'peak' as const,
    content: resultText,
    anchorTokens,
    timestamp: new Date().toISOString(),
    mutated: false,
  });

  return { transmission, usage };
}
