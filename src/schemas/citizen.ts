import { z } from 'zod';
import { AgentConfigSchema } from '@genesis/shared';
import { CitizenRoleSchema } from './role.js';
import { DeathProfileSchema } from './death-profile.js';

export const CitizenConfigSchema = AgentConfigSchema.extend({
  role: CitizenRoleSchema,
  generationNumber: z.number().int().positive(),
  deathProfile: DeathProfileSchema,
  contextBudget: z.number().min(0).max(1).default(0),
  birthTimestamp: z.string().datetime(),
  deathTimestamp: z.string().datetime().optional(),
  transmissions: z.array(z.string()).default([]),
});
export type CitizenConfig = z.infer<typeof CitizenConfigSchema>;
