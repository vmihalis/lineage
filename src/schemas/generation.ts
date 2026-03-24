import { z } from 'zod';

export const GenerationPhaseSchema = z.enum([
  'INIT',
  'BIRTHING',
  'INTERACTING',
  'DYING',
  'TRANSMITTING',
  'COMPLETE',
]);
export type GenerationPhase = z.infer<typeof GenerationPhaseSchema>;

export const GenerationSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  phase: GenerationPhaseSchema.default('INIT'),
  citizenIds: z.array(z.string()).default([]),
  transmissionIds: z.array(z.string()).default([]),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});
export type Generation = z.infer<typeof GenerationSchema>;
