// Inheritance module -- staged knowledge delivery from prior generations to new citizens.
// Seed layer (compressed ancestral wisdom at birth) and recent layer (last generation's transmissions at maturity).

export { readGenerationTransmissions, readAllPriorTransmissions } from './transmission-reader.js';
export { SEED_COMPRESSION_SYSTEM_PROMPT, buildSeedCompressionPrompt, formatSeedLayer } from './seed-layer.js';
export { formatRecentLayer } from './recent-layer.js';
export { executeSeedCompression } from './seed-executor.js';
export { composeInheritance, INHERITANCE_RECENT_LABEL } from './inheritance-composer.js';
export type { InheritancePackage } from './inheritance-composer.js';
