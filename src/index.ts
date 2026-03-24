// LINEAGE - Civilization Simulator
// Library barrel export -- schemas, events, state, config

export * from './schemas/index.js';
export * from './events/index.js';
export { LineageStateManager } from './state/index.js';
export { loadConfig } from './config/index.js';
export type { CliOptions } from './config/index.js';
export { DEFAULT_SIMULATION_PARAMETERS } from './config/index.js';
export { ContextBudget, assignDeathProfile, calculateAccidentPoint, birthCitizen } from './mortality/index.js';
export type { ContextBudgetConfig, ContextThreshold } from './mortality/index.js';
