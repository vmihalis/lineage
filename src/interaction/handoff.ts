import type { TurnOutput } from './turn-output.js';

export function formatHandoff(previousTurns: TurnOutput[]): string {
  if (previousTurns.length === 0) return '';

  const lines: string[] = ['PREVIOUS CITIZEN CONTRIBUTIONS:'];
  for (const turn of previousTurns) {
    lines.push('');
    lines.push(`--- ${turn.citizenName} (${turn.role}, Turn ${turn.turnNumber}) ---`);
    lines.push(turn.output);
  }
  lines.push('');
  lines.push('Build on, question, record, interpret, or observe the above based on your role.');
  return lines.join('\n');
}

export function buildTurnPrompt(seedProblem: string, previousTurns: TurnOutput[]): string {
  if (previousTurns.length === 0) {
    return `You are the first citizen in your generation to address this problem.\n\nSEED PROBLEM: "${seedProblem}"\n\nShare your thinking on this problem based on your role.`;
  }

  const handoff = formatHandoff(previousTurns);
  return `${handoff}\n\nSEED PROBLEM: "${seedProblem}"\n\nYou are citizen ${previousTurns.length + 1} in your generation. Respond to the contributions above based on your role.`;
}
