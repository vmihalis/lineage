import { z } from 'zod';
import { RoleDistributionSchema } from './role.js';
import { DeathProfileDistributionSchema } from './death-profile.js';

export const SimulationParametersSchema = z.object({
  seedProblem: z.string().min(1),
  generationSize: z.number().int().min(1).max(20).default(5),
  maxGenerations: z.number().int().min(1).max(100).default(3),
  deathProfileDistribution: DeathProfileDistributionSchema,
  mutationRate: z.number().min(0).max(1).default(0.3),
  largeMutationProbability: z.number().min(0).max(1).default(0.1),
  roleDistribution: RoleDistributionSchema,
  gen1Protection: z.boolean().default(true),
  peakTransmissionWindow: z.object({
    min: z.number().min(0).max(1).default(0.4),
    max: z.number().min(0).max(1).default(0.5),
  }).default({ min: 0.4, max: 0.5 }),
  inheritanceStagingRates: z.object({
    seedLayerAtBirth: z.boolean().default(true),
    recentLayerThreshold: z.number().min(0).max(1).default(0.25),
  }).default({ seedLayerAtBirth: true, recentLayerThreshold: 0.25 }),
  outputDir: z.string().default('./output'),
  contextWindow: z.number().int().positive().default(200_000),
});
export type SimulationParameters = z.infer<typeof SimulationParametersSchema>;
