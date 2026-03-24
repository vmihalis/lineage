import { z } from 'zod';

export const DeathProfileSchema = z.enum(['old-age', 'accident']);
export type DeathProfile = z.infer<typeof DeathProfileSchema>;

export const DeathProfileDistributionSchema = z.object({
  'old-age': z.number().min(0).max(1).default(0.7),
  'accident': z.number().min(0).max(1).default(0.3),
}).default({
  'old-age': 0.7,
  'accident': 0.3,
}).refine(
  (dist) => {
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1.0) < 0.01;
  },
  { message: 'Death profile distribution must sum to approximately 1.0' },
);
export type DeathProfileDistribution = z.infer<typeof DeathProfileDistributionSchema>;
