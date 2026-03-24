import { z } from 'zod';

export const CitizenRoleSchema = z.enum([
  'builder',
  'skeptic',
  'archivist',
  'elder-interpreter',
  'observer',
]);
export type CitizenRole = z.infer<typeof CitizenRoleSchema>;

export const RoleDistributionSchema = z.object({
  'builder': z.number().min(0).max(1).default(0.3),
  'skeptic': z.number().min(0).max(1).default(0.2),
  'archivist': z.number().min(0).max(1).default(0.2),
  'elder-interpreter': z.number().min(0).max(1).default(0.15),
  'observer': z.number().min(0).max(1).default(0.15),
}).default({
  'builder': 0.3,
  'skeptic': 0.2,
  'archivist': 0.2,
  'elder-interpreter': 0.15,
  'observer': 0.15,
}).refine(
  (dist) => {
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1.0) < 0.01;
  },
  { message: 'Role distribution must sum to approximately 1.0' },
);
export type RoleDistribution = z.infer<typeof RoleDistributionSchema>;
