import { z } from 'zod';

// Stub: will be implemented in GREEN phase
export const TurnOutputSchema = z.object({});
export type TurnOutput = z.infer<typeof TurnOutputSchema>;
