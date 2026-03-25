// Mutation module -- LLM-powered semantic transformation of transmissions in transit.
// Small mutations introduce drift (imprecision). Large mutations invert meaning.

export { buildSmallMutationPrompt, buildLargeMutationPrompt, MUTATION_SYSTEM_PROMPT } from './mutation-prompts.js';
export { decideMutation, selectTokenIndex, reassembleContent } from './mutation-decider.js';
export type { MutationType, MutationDecision } from './mutation-decider.js';
export { executeMutation } from './mutation-executor.js';
export { mutateTransmission } from './mutation-pipeline.js';
export type { MutationResult } from './mutation-pipeline.js';
