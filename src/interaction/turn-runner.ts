/**
 * TurnRunner -- Orchestrates sequential citizen execution via Agent SDK query().
 *
 * Each citizen executes one at a time, seeing the previous citizens' outputs
 * through structured handoff formatting. Context budgets are updated with
 * actual token usage after each turn.
 *
 * This is the core interaction mechanism: the orchestration loop that transforms
 * isolated agent calls into a within-generation conversation. Sequential execution
 * ensures determinism and makes handoff threading straightforward.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { CitizenConfig } from '../schemas/index.js';
import type { TurnOutput } from './turn-output.js';
import { TurnOutputSchema } from './turn-output.js';
import { buildTurnPrompt } from './handoff.js';
import type { ContextBudget } from '../mortality/index.js';

export interface TurnRunnerConfig {
  seedProblem: string;
  citizens: CitizenConfig[];
  contextBudget?: ContextBudget;
}

export interface TurnResult {
  turns: TurnOutput[];
  totalTokens: { input: number; output: number };
}

/**
 * Execute a single citizen's turn via Agent SDK query().
 *
 * Calls query() with the citizen's systemPrompt, maxTurns, and model.
 * Consumes the async generator to extract the final result text and usage.
 * Handles non-success subtypes gracefully with error text placeholder.
 */
export async function executeCitizenTurn(
  citizen: CitizenConfig,
  prompt: string,
  turnNumber: number,
): Promise<TurnOutput> {
  const gen = query({
    prompt,
    options: {
      systemPrompt: citizen.systemPrompt,
      maxTurns: citizen.maxTurns ?? 1,
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
        resultText = `[Agent error: ${msg.subtype}]`;
      }
      usage = {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      };
    }
  }

  if (!resultText) {
    resultText = '[No result received]';
  }

  return TurnOutputSchema.parse({
    citizenId: citizen.id,
    citizenName: citizen.name,
    role: citizen.role,
    turnNumber,
    output: resultText,
    usage,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Run sequential turns for all citizens in a generation.
 *
 * Each citizen's prompt is built from the seed problem and all previous
 * citizens' outputs (via buildTurnPrompt). The first citizen gets only the
 * seed problem; subsequent citizens see accumulated handoff context.
 *
 * Optionally updates a ContextBudget with actual token usage after each turn.
 */
export async function runTurns(config: TurnRunnerConfig): Promise<TurnResult> {
  const turns: TurnOutput[] = [];
  const totalTokens = { input: 0, output: 0 };

  for (let i = 0; i < config.citizens.length; i++) {
    const citizen = config.citizens[i];
    const prompt = buildTurnPrompt(config.seedProblem, turns);
    const turnOutput = await executeCitizenTurn(citizen, prompt, i + 1);

    turns.push(turnOutput);
    totalTokens.input += turnOutput.usage.inputTokens;
    totalTokens.output += turnOutput.usage.outputTokens;

    if (config.contextBudget) {
      config.contextBudget.update(
        turnOutput.usage.inputTokens,
        turnOutput.usage.outputTokens,
      );
    }
  }

  return { turns, totalTokens };
}
