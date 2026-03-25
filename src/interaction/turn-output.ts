import { z } from 'zod';
import { CitizenRoleSchema } from '../schemas/index.js';

export const TurnOutputSchema = z.object({
  citizenId: z.string(),
  citizenName: z.string(),
  role: CitizenRoleSchema,
  turnNumber: z.number().int().positive(),
  output: z.string(),
  usage: z.object({
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
  }),
  timestamp: z.string().datetime(),
});
export type TurnOutput = z.infer<typeof TurnOutputSchema>;
