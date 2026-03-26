// Display module -- pure event formatters, generation summary table builder,
// and EventRenderer (real-time event-to-terminal output).

export {
  formatBirth, formatDeath, formatTransmission, formatMutation,
  formatGenerationStart, formatGenerationEnd, formatInheritance,
  formatSimulationStart, formatSimulationEnd, COLORS,
} from './formatters.js';
export { buildGenerationSummary, createGenerationDisplayState } from './generation-summary.js';
export type { GenerationDisplayState, DisplayCitizen } from './generation-summary.js';
export { EventRenderer } from './event-renderer.js';
