// LINEAGE - Civilization Simulator
// Library barrel export -- schemas, events, state, config

export * from './schemas/index.js';
export * from './events/index.js';
export { LineageStateManager } from './state/index.js';
export { loadConfig } from './config/index.js';
export type { CliOptions } from './config/index.js';
export { DEFAULT_SIMULATION_PARAMETERS } from './config/index.js';
export { ContextBudget, assignDeathProfile, calculateAccidentPoint, birthCitizen, createDeathThresholds, getDeclineSignal, PEAK_TRANSMISSION_LABEL, ACCIDENT_DEATH_LABEL, OldAgeThresholdLabels } from './mortality/index.js';
export type { ContextBudgetConfig, ContextThreshold } from './mortality/index.js';
export { assignRole, assignRoles, buildSystemPrompt, ROLE_PROMPTS } from './roles/index.js';
export type { PromptContext } from './roles/index.js';
export { TurnOutputSchema, formatHandoff, buildTurnPrompt, runTurns, executeCitizenTurn } from './interaction/index.js';
export type { TurnOutput, TurnRunnerConfig, TurnResult } from './interaction/index.js';
export { extractAnchorTokens, buildPeakTransmissionPrompt, executePeakTransmission, writeTransmission } from './transmission/index.js';
export type { TransmissionResult } from './transmission/index.js';
export { mutateTransmission, decideMutation, selectTokenIndex, reassembleContent, buildSmallMutationPrompt, buildLargeMutationPrompt, MUTATION_SYSTEM_PROMPT, executeMutation } from './mutation/index.js';
export type { MutationResult, MutationType, MutationDecision } from './mutation/index.js';
export { readGenerationTransmissions, readAllPriorTransmissions, SEED_COMPRESSION_SYSTEM_PROMPT, buildSeedCompressionPrompt, formatSeedLayer, formatRecentLayer, executeSeedCompression, composeInheritance, INHERITANCE_RECENT_LABEL } from './inheritance/index.js';
export type { InheritancePackage } from './inheritance/index.js';
