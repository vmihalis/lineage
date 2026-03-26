// Display module -- pure event formatters and generation summary table builder.
// No side effects. EventRenderer (Plan 02) will subscribe to events and call these.

export {
  formatBirth, formatDeath, formatTransmission, formatMutation,
  formatGenerationStart, formatGenerationEnd, formatInheritance,
  formatSimulationStart, formatSimulationEnd, COLORS,
} from './formatters.js';
export { buildGenerationSummary, createGenerationDisplayState } from './generation-summary.js';
export type { GenerationDisplayState, DisplayCitizen } from './generation-summary.js';
