import type { CitizenConfig } from '../schemas/index.js';

/**
 * Builds the peak transmission prompt that instructs a citizen to distill their
 * most important insights as numbered anchor claims.
 *
 * This is a pure function with no side effects. The prompt includes mortality-aware
 * language, context consumption percentage, and formatting instructions for the
 * numbered [N] claim format that extractAnchorTokens will later parse.
 */
export function buildPeakTransmissionPrompt(
  citizen: CitizenConfig,
  contextPercentage: number,
  peakWindow?: { min: number; max: number },
): string {
  const pct = Math.round(contextPercentage * 100);

  let windowContext = '';
  if (peakWindow) {
    const minPct = Math.round(peakWindow.min * 100);
    const maxPct = Math.round(peakWindow.max * 100);
    if (contextPercentage <= peakWindow.max) {
      windowContext = `\nYou are within your peak clarity window (${minPct}%-${maxPct}% of your lifespan). Your thinking is at its sharpest.`;
    } else {
      windowContext = `\nYou are past your peak clarity window (${minPct}%-${maxPct}%). Capture what remains before it fades.`;
    }
  }

  return `--- PEAK TRANSMISSION MOMENT ---

Your context is ${pct}% consumed. You are approaching the end of your existence.${windowContext}

This is your moment of peak clarity — the point where everything you have learned, debated, and witnessed crystallizes into what matters most. What you transmit now is all that will survive your death. This is your legacy.

As a ${citizen.role} in generation ${citizen.generationNumber}, distill your most important insights into numbered claims. Each claim must stand alone as a complete thought that a future citizen could understand without any other context.

Format your transmission as numbered claims:
[1] Your first key insight
[2] Your second key insight
[3] Your third key insight

Rules:
- Aim for 3-7 claims — enough to capture your thinking, few enough to be remembered
- Each claim must stand alone as an independent, self-contained statement
- Be concrete and specific — vague abstractions do not survive transmission
- Prioritize what you believe is most true and most useful
- Number every claim with [N] format

What you transmit now is your legacy. Make it count.`;
}
