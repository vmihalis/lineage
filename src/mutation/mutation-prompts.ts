/**
 * Mutation prompt builders -- specialized prompts for LLM-powered semantic transformation.
 * Small mutations introduce imprecision (drift). Large mutations invert meaning (inversion).
 * Each prompt targets a single anchor token claim, not the full transmission.
 */

export const MUTATION_SYSTEM_PROMPT = `You are an imperfect transmission medium. Knowledge passes through you and is subtly altered in transit. You do not explain or justify the changes. You simply output the transformed text, nothing else.`;

export function buildSmallMutationPrompt(anchorToken: string): string {
  return `Transform this claim by introducing slight imprecision. The core idea should survive but specific details should become vague, approximate, or slightly shifted. A name might be forgotten. A number might become "approximately" or shift slightly. A specific mechanism might become a general principle.

Original claim:
${anchorToken}

Return ONLY the transformed claim. No explanation, no preamble, no quotation marks.`;
}

export function buildLargeMutationPrompt(anchorToken: string): string {
  return `Transform this claim by inverting its core meaning. If it warns against something, make it encourage that thing. If it says something is true, make it assert the opposite. If it recommends an approach, make it recommend the opposite approach. The result must read as a confident, plausible statement -- not an obvious negation.

Original claim:
${anchorToken}

Return ONLY the transformed claim. No explanation, no preamble, no quotation marks.`;
}
