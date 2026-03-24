import { z } from 'zod';
import { CitizenRoleSchema } from './role.js';

export const TransmissionTypeSchema = z.enum(['peak', 'elder', 'accident']);
export type TransmissionType = z.infer<typeof TransmissionTypeSchema>;

export const TransmissionSchema = z.object({
  id: z.string(),
  citizenId: z.string(),
  generationNumber: z.number().int().positive(),
  role: CitizenRoleSchema,
  type: TransmissionTypeSchema,
  content: z.string(),
  anchorTokens: z.array(z.string()).default([]),
  timestamp: z.string().datetime(),
  mutated: z.boolean().default(false),
  mutationType: z.string().optional(),
});
export type Transmission = z.infer<typeof TransmissionSchema>;
