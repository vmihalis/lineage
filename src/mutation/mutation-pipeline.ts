/**
 * MutationPipeline -- Orchestrates the full mutation flow: decide -> select token -> execute -> reassemble.
 *
 * Takes a completed Transmission and probabilistically mutates one anchor token via LLM.
 * Returns a MutationResult with the (possibly mutated) transmission and metadata.
 * The original Transmission is never modified -- a new object is created with a new ID.
 * Emits 'transmission:mutated' event on lineageBus when mutation occurs.
 */

import { nanoid } from 'nanoid';
import type { Transmission } from '../schemas/index.js';
import { TransmissionSchema } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';
import { decideMutation, selectTokenIndex, reassembleContent } from './mutation-decider.js';
import { executeMutation } from './mutation-executor.js';

export interface MutationResult {
  transmission: Transmission;
  wasMutated: boolean;
  mutationType?: 'small' | 'large';
  tokenIndex?: number;
}

export async function mutateTransmission(
  original: Transmission,
  mutationRate: number,
  largeMutationProbability: number,
  randomFn: () => number = Math.random,
): Promise<MutationResult> {
  if (original.anchorTokens.length === 0) {
    return { transmission: original, wasMutated: false };
  }

  const decision = decideMutation(mutationRate, largeMutationProbability, randomFn);

  if (!decision.mutate) {
    return { transmission: original, wasMutated: false };
  }

  const tokenIndex = selectTokenIndex(original.anchorTokens.length, randomFn);
  const originalToken = original.anchorTokens[tokenIndex];
  const mutatedToken = await executeMutation(originalToken, decision.type);

  const mutatedTokens = [...original.anchorTokens];
  mutatedTokens[tokenIndex] = mutatedToken;

  const mutatedTransmission = TransmissionSchema.parse({
    ...original,
    id: nanoid(),
    content: reassembleContent(mutatedTokens),
    anchorTokens: mutatedTokens,
    mutated: true,
    mutationType: decision.type,
  });

  lineageBus.emit('transmission:mutated', mutatedTransmission.id, decision.type);

  return {
    transmission: mutatedTransmission,
    wasMutated: true,
    mutationType: decision.type,
    tokenIndex,
  };
}
