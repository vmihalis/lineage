/**
 * Mutation decision logic -- two-stage probabilistic model with injectable randomFn.
 * Stage 1: mutationRate determines if any mutation occurs.
 * Stage 2: largeMutationProbability determines if mutation is large vs small.
 * Also provides selectTokenIndex and reassembleContent helpers.
 */

export type MutationType = 'small' | 'large';

export type MutationDecision =
  | { mutate: false }
  | { mutate: true; type: MutationType };

export function decideMutation(
  mutationRate: number,
  largeMutationProbability: number,
  randomFn: () => number = Math.random,
): MutationDecision {
  if (randomFn() >= mutationRate) {
    return { mutate: false };
  }
  const type: MutationType = randomFn() < largeMutationProbability ? 'large' : 'small';
  return { mutate: true, type };
}

export function selectTokenIndex(
  tokenCount: number,
  randomFn: () => number = Math.random,
): number {
  return Math.floor(randomFn() * tokenCount);
}

export function reassembleContent(anchorTokens: string[]): string {
  if (anchorTokens.length === 0) return '';
  return anchorTokens
    .map((token, i) => `[${i + 1}] ${token}`)
    .join('\n');
}
