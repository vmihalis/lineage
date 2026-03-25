/**
 * InheritanceComposer -- Orchestrates the full inheritance composition pipeline.
 *
 * Composes an InheritancePackage by reading prior transmissions from disk,
 * compressing seed tokens via LLM, and formatting both seed and recent layers
 * for delivery to new citizens. Emits 'inheritance:composed' event on lineageBus.
 *
 * Generation 1 early-returns with null layers (no prior generations to inherit from).
 * Generation 2+ reads transmissions, optionally compresses seed layer via Agent SDK,
 * and formats recent layer from the immediately previous generation.
 */

import { readAllPriorTransmissions, readGenerationTransmissions } from './transmission-reader.js';
import { buildSeedCompressionPrompt, formatSeedLayer } from './seed-layer.js';
import { formatRecentLayer } from './recent-layer.js';
import { executeSeedCompression } from './seed-executor.js';
import { lineageBus } from '../events/index.js';

export const INHERITANCE_RECENT_LABEL = 'inheritance-recent' as const;

export interface InheritancePackage {
  targetGeneration: number;
  seedLayer: string | null;
  recentLayer: string | null;
  seedTokens: string[];
  recentTokens: string[];
  composedAt: string;
}

export async function composeInheritance(
  targetGeneration: number,
  outputDir: string,
  config: { seedLayerAtBirth: boolean; recentLayerThreshold: number },
): Promise<InheritancePackage> {
  // Generation 1 early return: no prior generations to inherit from
  if (targetGeneration <= 1) {
    const pkg: InheritancePackage = {
      targetGeneration,
      seedLayer: null,
      recentLayer: null,
      seedTokens: [],
      recentTokens: [],
      composedAt: new Date().toISOString(),
    };
    lineageBus.emit('inheritance:composed', targetGeneration, 0);
    return pkg;
  }

  // Read transmissions from disk
  const allPrior = await readAllPriorTransmissions(outputDir, targetGeneration);
  const recentGen = targetGeneration - 1;
  const recentTransmissions = await readGenerationTransmissions(outputDir, recentGen);

  // Compose seed layer
  let seedLayer: string | null = null;
  let seedTokens: string[] = [];

  if (config.seedLayerAtBirth && allPrior.length > 0) {
    // Group allPrior by generationNumber into Map<number, string[]>
    const tokensByGeneration = new Map<number, string[]>();
    for (const tx of allPrior) {
      const existing = tokensByGeneration.get(tx.generationNumber) ?? [];
      existing.push(...tx.anchorTokens);
      tokensByGeneration.set(tx.generationNumber, existing);
    }

    const prompt = buildSeedCompressionPrompt(tokensByGeneration, targetGeneration);
    const { tokens } = await executeSeedCompression(prompt);
    seedTokens = tokens;
    seedLayer = formatSeedLayer(seedTokens, tokensByGeneration.size);
    // formatSeedLayer returns empty string for empty tokens -- normalize to null
    if (seedLayer === '') {
      seedLayer = null;
    }
  }

  // Compose recent layer
  let recentLayer: string | null = null;
  let recentTokens: string[] = [];

  if (recentTransmissions.length > 0) {
    recentLayer = formatRecentLayer(recentTransmissions, recentGen);
    recentTokens = recentTransmissions.flatMap(tx => tx.anchorTokens);
    // formatRecentLayer returns empty string for empty array -- normalize to null
    if (recentLayer === '') {
      recentLayer = null;
    }
  }

  // Emit event
  const layerCount = (seedLayer !== null ? 1 : 0) + (recentLayer !== null ? 1 : 0);
  lineageBus.emit('inheritance:composed', targetGeneration, layerCount);

  return {
    targetGeneration,
    seedLayer,
    recentLayer,
    seedTokens,
    recentTokens,
    composedAt: new Date().toISOString(),
  };
}
