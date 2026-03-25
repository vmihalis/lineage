// Mortality module -- the engine that makes LINEAGE unique.
// Context consumption IS aging. Every token consumed brings a citizen closer to death.

export { ContextBudget } from './context-budget.js';
export type { ContextBudgetConfig, ContextThreshold } from './context-budget.js';
export { assignDeathProfile, calculateAccidentPoint } from './death-profiles.js';
export { birthCitizen } from './citizen-lifecycle.js';
export { createDeathThresholds, getDeclineSignal, PEAK_TRANSMISSION_LABEL, ACCIDENT_DEATH_LABEL, OldAgeThresholdLabels } from './death-execution.js';
