// Interaction module -- turn-based citizen execution within a generation.
// Citizens execute sequentially, each building on the previous citizen's output.

export { TurnOutputSchema } from './turn-output.js';
export type { TurnOutput } from './turn-output.js';
export { formatHandoff, buildTurnPrompt } from './handoff.js';
export { runTurns, executeCitizenTurn } from './turn-runner.js';
export type { TurnRunnerConfig, TurnResult } from './turn-runner.js';
