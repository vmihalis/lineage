/**
 * Default simulation parameters matching SimulationParametersSchema defaults.
 * Does NOT include seedProblem -- it is always required from CLI.
 */
export const DEFAULT_SIMULATION_PARAMETERS = {
  generationSize: 5,
  maxGenerations: 3,
  mutationRate: 0.3,
  largeMutationProbability: 0.1,
  gen1Protection: true,
  deathProfileDistribution: {
    'old-age': 0.7,
    'accident': 0.3,
  },
  roleDistribution: {
    builder: 0.3,
    skeptic: 0.2,
    archivist: 0.2,
    'elder-interpreter': 0.15,
    observer: 0.15,
  },
  peakTransmissionWindow: {
    min: 0.4,
    max: 0.5,
  },
  inheritanceStagingRates: {
    seedLayerAtBirth: true,
    recentLayerThreshold: 0.25,
  },
  outputDir: './output',
} as const;
