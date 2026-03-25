/**
 * TurnRunner -- Orchestrates sequential citizen execution via Agent SDK query().
 *
 * Each citizen executes one at a time, seeing the previous citizens' outputs
 * through structured handoff formatting. Context budgets are updated with
 * actual token usage after each turn.
 */

import type { CitizenConfig } from '../schemas/index.js';
import type { TurnOutput } from './turn-output.js';
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

export async function executeCitizenTurn(
  _citizen: CitizenConfig,
  _prompt: string,
  _turnNumber: number,
): Promise<TurnOutput> {
  throw new Error('Not implemented');
}

export async function runTurns(_config: TurnRunnerConfig): Promise<TurnResult> {
  throw new Error('Not implemented');
}
