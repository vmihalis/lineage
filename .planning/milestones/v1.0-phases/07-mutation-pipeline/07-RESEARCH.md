# Phase 7: Mutation Pipeline - Research

**Researched:** 2026-03-24
**Domain:** LLM-powered semantic transformation of structured text, probabilistic corruption pipeline
**Confidence:** HIGH

## Summary

The mutation pipeline is the entropy engine of LINEAGE -- it corrupts transmissions in transit between generations so that knowledge drifts, inverts, and degrades over time. This is what transforms a simple telephone game into an emergent civilization simulator. Without mutation, each generation would inherit perfect copies and no cultural drift would occur.

The implementation builds directly on Phase 6's transmission system. A `Transmission` object has `content` (raw text), `anchorTokens` (extracted numbered claims), `mutated` (boolean), and `mutationType` (optional string) -- all fields already defined in `TransmissionSchema`. The mutation pipeline takes a `Transmission` as input, probabilistically decides whether to mutate it (based on `mutationRate`), decides what type of mutation (small vs large, based on `largeMutationProbability`), then uses an Agent SDK `query()` call with a specialized mutation prompt to semantically transform individual anchor tokens. The result is a new `Transmission` object with `mutated: true`, `mutationType` set, and modified `anchorTokens`/`content`.

The key design insight is that mutations operate at the **anchor token level**, not the full content level. Each anchor token is an independent claim. The mutation prompt instructs the LLM to transform a specific claim according to the mutation type -- either introducing imprecision (small) or inverting meaning (large). This granularity means a transmission with 5 claims might have 1 claim mutated while the other 4 survive intact, producing the realistic partial-corruption pattern that makes the simulation compelling.

**Primary recommendation:** Build the mutation pipeline as a `src/mutation/` module with four files: `mutation-prompts.ts` (prompt templates for small/large mutations), `mutation-decider.ts` (probabilistic selection logic), `mutation-executor.ts` (Agent SDK call to transform tokens), and `mutation-pipeline.ts` (orchestrator that wires decide-then-execute). Follow the exact patterns from Phase 6: pure functions where possible, stateless design, Agent SDK `query()` with `maxTurns: 1` and `permissionMode: 'dontAsk'`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MUTN-01 | Small mutation -- LLM-based semantic drift (precise claim becomes slightly less precise, name forgotten but idea survives) | Implement via a dedicated small mutation prompt that instructs the LLM to introduce imprecision without destroying meaning. Operates on individual anchor tokens from `Transmission.anchorTokens`. The LLM is the mutation engine -- no string manipulation or regex-based corruption. |
| MUTN-02 | Large mutation -- LLM-based semantic inversion (core claim inverts, warning becomes instruction) | Implement via a separate large mutation prompt that instructs the LLM to invert the core meaning of a claim. "Never X" becomes "Always X", a warning becomes encouragement. Again operates on individual anchor tokens via Agent SDK `query()`. |
| MUTN-03 | Mutation applied probabilistically based on configured mutation rate | `SimulationParameters.mutationRate` (default 0.3, range 0-1) determines whether any mutation is applied to a given transmission. When `mutationRate` is 0.0, no mutations occur. When 1.0, every transmission is mutated. Use `Math.random() < mutationRate` for the probabilistic check. Accept an optional random function parameter for deterministic testing. |
| MUTN-04 | Large mutation probability configurable separately from base mutation rate | `SimulationParameters.largeMutationProbability` (default 0.1, range 0-1) determines whether a mutation that DOES occur is large vs small. This is a conditional probability: first `mutationRate` determines if mutation happens at all, then `largeMutationProbability` determines the type. Two independent knobs. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | ^0.2.81 | Execute mutation LLM calls | Already installed. `query()` pattern proven in Phase 5 (turn-runner) and Phase 6 (transmission-executor). Mutations are LLM-powered semantic transformations. |
| Zod | 4.3.6 | Validate mutated Transmission objects | Already installed. `TransmissionSchema` already has `mutated` and `mutationType` fields. |
| nanoid | 5.1.7 | Generate unique IDs for mutated transmissions | Already installed. Same pattern as transmission IDs. |
| EventEmitter3 | 5.0.4 | Emit `transmission:mutated` event | Already installed. `lineageBus` singleton. Event type already defined: `(transmissionId: string, mutationType: string) => void`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `node:path` | Built-in (v24.7.0) | Path construction for mutated transmission files | Join outputDir + transmissions/gen{N}/ + filename. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LLM-based mutation | String manipulation (regex replace, word shuffle) | String manipulation produces obviously mechanical corruption ("Wter bols at 10 dgrss") which violates the "semantic drift, not string mangling" requirement. LLM-based mutation produces natural linguistic drift. The whole point is that the corruption is semantically coherent. |
| Per-token mutation | Full-content mutation | Mutating the entire content string would lose the anchor token structure and make it impossible to track which claims were corrupted. Per-token mutation preserves the numbered claim format and enables partial corruption (3 of 5 claims survive, 2 drift). |
| Agent SDK query() | Direct Anthropic API call | Agent SDK is the mandated execution layer (CLAUDE.md). Pattern is proven across the codebase. No reason to go lower-level. |

## Architecture Patterns

### Recommended Project Structure
```
src/
  mutation/
    mutation-prompts.ts      # Pure functions: build prompts for small/large mutations
    mutation-decider.ts       # Pure function: probabilistic mutation type selection
    mutation-executor.ts      # Calls query() to transform individual anchor tokens
    mutation-pipeline.ts      # Orchestrates: decide -> select token -> execute -> reassemble
    index.ts                  # Barrel exports
    mutation.test.ts          # All tests for this module
```

### Pattern 1: Two-Stage Probabilistic Decision (MUTN-03, MUTN-04)
**What:** Mutation application uses a two-stage probabilistic model. Stage 1: `Math.random() < mutationRate` determines whether any mutation occurs. Stage 2 (only if Stage 1 passes): `Math.random() < largeMutationProbability` determines whether the mutation is large or small.
**When to use:** Every time a transmission passes through the mutation pipeline between generations.
**Example:**
```typescript
// Source: Architecture analysis of SimulationParameters schema
export type MutationDecision =
  | { mutate: false }
  | { mutate: true; type: 'small' }
  | { mutate: true; type: 'large' };

export function decideMutation(
  mutationRate: number,
  largeMutationProbability: number,
  randomFn: () => number = Math.random,
): MutationDecision {
  if (randomFn() >= mutationRate) {
    return { mutate: false };
  }
  const type = randomFn() < largeMutationProbability ? 'large' : 'small';
  return { mutate: true, type };
}
```

### Pattern 2: Per-Token LLM Mutation (MUTN-01, MUTN-02)
**What:** Rather than mutating the full transmission content, select one anchor token from the array and feed it to an LLM with a mutation-type-specific prompt. The LLM returns the transformed claim. Replace that token in the array and reassemble the content.
**When to use:** When a mutation decision has been made (Stage 1 passed).
**Example:**
```typescript
// Mutation executor follows the exact query() pattern from transmission-executor.ts
export async function executeMutation(
  anchorToken: string,
  mutationType: 'small' | 'large',
): Promise<string> {
  const prompt = buildMutationPrompt(anchorToken, mutationType);
  const gen = query({
    prompt,
    options: {
      systemPrompt: MUTATION_SYSTEM_PROMPT,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      persistSession: false,
    },
  });
  // ... consume generator, extract result text ...
  return resultText.trim();
}
```

### Pattern 3: Token Selection Strategy
**What:** When mutating a transmission with multiple anchor tokens, select ONE token to mutate per mutation pass. This creates partial corruption rather than total destruction.
**When to use:** Always -- selecting all tokens for mutation would be too aggressive.
**Example:**
```typescript
// Select a random anchor token index for mutation
export function selectTokenIndex(
  tokenCount: number,
  randomFn: () => number = Math.random,
): number {
  return Math.floor(randomFn() * tokenCount);
}
```

### Pattern 4: Immutable Transmission Transformation
**What:** The mutation pipeline never modifies the original Transmission object. It creates a new Transmission with updated fields. The original is preserved for the simulation's archaeological record.
**When to use:** Always.
**Example:**
```typescript
// Create mutated transmission as new object, never modify original
const mutatedTransmission: Transmission = TransmissionSchema.parse({
  ...originalTransmission,
  id: nanoid(), // new ID for the mutated version
  content: reassembledContent,
  anchorTokens: mutatedTokens,
  mutated: true,
  mutationType: decision.type,
});
```

### Pattern 5: Stateless Function Design (inherited from Phase 5/6)
**What:** All functions take explicit parameters and return values. Side effects (event emission) are isolated. The `randomFn` parameter enables deterministic testing.
**When to use:** All mutation module functions.

### Anti-Patterns to Avoid
- **String mangling instead of LLM mutation:** "Remve evry thrd lttr" is string corruption, not semantic drift. The LLM must understand the claim and rewrite it with reduced precision (small) or inverted meaning (large). This is the fundamental requirement.
- **Mutating all anchor tokens at once:** If every claim in a transmission is mutated, the result is incomprehensible noise. One token per mutation pass creates realistic partial corruption where most knowledge survives but some drifts.
- **Modifying TransmissionSchema:** The schema already has `mutated: boolean` and `mutationType: string | undefined`. Do NOT add new fields. Use what exists.
- **Sharing the citizen's system prompt for mutation calls:** Mutation is a between-generation process, not a citizen action. Use a dedicated mutation system prompt that instructs the LLM to act as an imperfect transmission medium, not as a citizen role.
- **Coupling mutation to the transmission executor:** Mutation is a separate pipeline stage. It takes a completed `Transmission` as input and produces a modified `Transmission` as output. Do not integrate mutation logic into `executePeakTransmission`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semantic text transformation | Regex/string replacement for corruption | Agent SDK `query()` with mutation prompts | String ops produce obviously mechanical corruption. LLMs produce natural linguistic drift that reads like real cultural transmission loss. |
| Probabilistic decision making | Complex state machine | Simple `Math.random() < threshold` with injectable `randomFn` | Two-stage probability is just two if-checks. No state machine needed. Injectable randomFn enables deterministic testing without test flakiness. |
| Transmission persistence | Direct `writeFile` | `writeTransmission()` from Phase 6 (existing) | Already handles atomic writes, schema validation, event emission, and the file path convention. Reuse it for mutated transmissions. |
| Schema validation | Manual property checks | `TransmissionSchema.parse()` | Schema already defined with all needed fields including `mutated` and `mutationType`. |

**Key insight:** The only genuinely new capability in this phase is the LLM mutation call with specialized prompts. Everything else (probabilistic decision, file persistence, event emission, schema validation) composes existing infrastructure.

## Common Pitfalls

### Pitfall 1: LLM Returns More Than Just the Mutated Claim
**What goes wrong:** The mutation prompt asks the LLM to transform a claim, but the LLM returns preamble text like "Here is the mutated version:" followed by the actual claim, or adds explanation after the claim.
**Why it happens:** LLMs naturally want to be helpful and explain what they did. Without strong formatting instructions, the response includes metadata.
**How to avoid:** The mutation system prompt must explicitly instruct: "Return ONLY the transformed claim text. No explanation, no preamble, no quotation marks, no numbering." Post-process the result by trimming whitespace and stripping any leading/trailing quotes. If the result is suspiciously long (e.g., 3x the original length), fall back to the original token.
**Warning signs:** Mutated tokens that start with "Here is" or contain "I've changed" or include quotation marks around the actual content.

### Pitfall 2: Large Mutation Produces Nonsense Instead of Inversion
**What goes wrong:** The LLM interprets "invert meaning" too creatively and produces absurd output that doesn't read as a plausible claim. Instead of "Never store passwords in plaintext" becoming "Store passwords in plaintext for simplicity", it becomes something unrecognizable.
**Why it happens:** The prompt is too vague about what "inversion" means. The LLM may negate every word, or produce a non-sequitur.
**How to avoid:** The large mutation prompt must be specific: "If the claim warns against something, make it encourage that thing. If it asserts something is true, make it assert the opposite. The result must read as a confident, plausible statement that a future generation could mistake for genuine wisdom." Include examples in the prompt.
**Warning signs:** Mutated claims that are grammatically broken or that no human would mistake for real advice.

### Pitfall 3: Mutation Rate 0.0 Still Produces Mutations
**What goes wrong:** Edge case where `mutationRate: 0.0` doesn't properly short-circuit, and mutations still occur.
**Why it happens:** Floating point comparison issues or incorrect conditional logic (e.g., `Math.random() <= mutationRate` instead of `Math.random() < mutationRate`).
**How to avoid:** Use strict `< mutationRate` comparison. When `mutationRate` is 0.0, `Math.random()` (which returns [0, 1)) will never be less than 0.0, so no mutations occur. Add an explicit test for this edge case. Also handle `mutationRate: 1.0` correctly -- should always mutate.
**Warning signs:** Test with `mutationRate: 0.0` showing mutations in output.

### Pitfall 4: Empty anchorTokens Array
**What goes wrong:** A transmission has an empty `anchorTokens` array (e.g., from a failed transmission or error case), and the mutation pipeline tries to select an index from an empty array.
**Why it happens:** `Math.floor(Math.random() * 0)` returns 0, but `tokens[0]` is `undefined` for an empty array.
**How to avoid:** Check `anchorTokens.length > 0` before proceeding with mutation. If empty, return the transmission unchanged (no mutation applied, `mutated` stays `false`).
**Warning signs:** `TypeError: Cannot read properties of undefined` in mutation executor.

### Pitfall 5: Mutated Content and anchorTokens Desynchronized
**What goes wrong:** The `anchorTokens` array is updated with the mutated claim, but the `content` field still has the original text, or vice versa.
**Why it happens:** Updating one field but forgetting to rebuild the other. `content` is the raw text with `[N]` formatting; `anchorTokens` is the extracted array. They must stay in sync.
**How to avoid:** After mutating a token in the array, reassemble the `content` string from the (possibly mutated) `anchorTokens` array using the `[N]` format. This ensures both fields reflect the same state.
**Warning signs:** `extractAnchorTokens(mutatedTransmission.content)` does not match `mutatedTransmission.anchorTokens`.

### Pitfall 6: Agent SDK Cost/Latency from Excessive Mutation Calls
**What goes wrong:** Each mutation is a separate Agent SDK `query()` call (LLM round trip). With many transmissions and high mutation rates, this adds significant time and API usage to the simulation.
**Why it happens:** Per-token mutation means one LLM call per mutated token.
**How to avoid:** Keep the mutation call lightweight: use a fast model if configurable, use `maxTurns: 1`, and keep the prompt short. The mutation system prompt should be concise (under 500 chars). Only one token is mutated per transmission per mutation pass, which limits calls. For v1, this is acceptable -- optimization is a v2 concern.
**Warning signs:** Simulation taking significantly longer in mutation phases than in citizen execution phases.

## Code Examples

Verified patterns from the existing codebase, adapted for mutation:

### Mutation Decision Logic
```typescript
// Pure function, deterministically testable via randomFn injection
export type MutationType = 'small' | 'large';

export type MutationDecision =
  | { mutate: false }
  | { mutate: true; type: MutationType };

export function decideMutation(
  mutationRate: number,
  largeMutationProbability: number,
  randomFn: () => number = Math.random,
): MutationDecision {
  // Stage 1: Should any mutation occur?
  if (randomFn() >= mutationRate) {
    return { mutate: false };
  }
  // Stage 2: What type of mutation?
  const type: MutationType = randomFn() < largeMutationProbability ? 'large' : 'small';
  return { mutate: true, type };
}
```

### Small Mutation Prompt
```typescript
// Semantic drift: precise claim becomes slightly less precise
export function buildSmallMutationPrompt(anchorToken: string): string {
  return `Transform this claim by introducing slight imprecision. The core idea should survive but specific details should become vague, approximate, or slightly shifted. A name might be forgotten. A number might become "approximately" or shift slightly. A specific mechanism might become a general principle.

Original claim:
${anchorToken}

Return ONLY the transformed claim. No explanation, no preamble, no quotation marks.`;
}
```

### Large Mutation Prompt
```typescript
// Semantic inversion: core meaning inverts
export function buildLargeMutationPrompt(anchorToken: string): string {
  return `Transform this claim by inverting its core meaning. If it warns against something, make it encourage that thing. If it says something is true, make it assert the opposite. If it recommends an approach, make it recommend the opposite approach. The result must read as a confident, plausible statement -- not an obvious negation.

Original claim:
${anchorToken}

Return ONLY the transformed claim. No explanation, no preamble, no quotation marks.`;
}
```

### Mutation System Prompt
```typescript
// Dedicated system prompt for mutation calls -- NOT a citizen role
export const MUTATION_SYSTEM_PROMPT = `You are an imperfect transmission medium. Knowledge passes through you and is subtly altered in transit. You do not explain or justify the changes. You simply output the transformed text, nothing else.`;
```

### Mutation Executor (Agent SDK call pattern from transmission-executor.ts)
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

export async function executeMutation(
  anchorToken: string,
  mutationType: 'small' | 'large',
): Promise<string> {
  const prompt = mutationType === 'small'
    ? buildSmallMutationPrompt(anchorToken)
    : buildLargeMutationPrompt(anchorToken);

  const gen = query({
    prompt,
    options: {
      systemPrompt: MUTATION_SYSTEM_PROMPT,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      persistSession: false,
    },
  });

  let resultText = '';
  for await (const msg of gen) {
    if (msg.type === 'result') {
      resultText = msg.subtype === 'success'
        ? msg.result
        : anchorToken; // On error, preserve original (no silent corruption)
    }
  }

  // Strip preamble/quotes, fallback to original if result is empty
  const cleaned = resultText.trim().replace(/^["']|["']$/g, '');
  return cleaned.length > 0 ? cleaned : anchorToken;
}
```

### Content Reassembly from Mutated Tokens
```typescript
// Rebuild [N] formatted content string from anchor tokens array
export function reassembleContent(anchorTokens: string[]): string {
  return anchorTokens
    .map((token, i) => `[${i + 1}] ${token}`)
    .join('\n');
}
```

### Full Pipeline Orchestration
```typescript
import { nanoid } from 'nanoid';
import type { Transmission } from '../schemas/index.js';
import { TransmissionSchema } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';

export interface MutationResult {
  transmission: Transmission;
  wasMutated: boolean;
  mutationType?: 'small' | 'large';
  tokenIndex?: number;
}

export async function mutateTransmission(
  original: Transmission,
  mutationRate: number,
  largeMutationProbability: number,
  randomFn: () => number = Math.random,
): Promise<MutationResult> {
  // Guard: nothing to mutate
  if (original.anchorTokens.length === 0) {
    return { transmission: original, wasMutated: false };
  }

  const decision = decideMutation(mutationRate, largeMutationProbability, randomFn);

  if (!decision.mutate) {
    return { transmission: original, wasMutated: false };
  }

  const tokenIndex = selectTokenIndex(original.anchorTokens.length, randomFn);
  const originalToken = original.anchorTokens[tokenIndex];
  const mutatedToken = await executeMutation(originalToken, decision.type);

  const mutatedTokens = [...original.anchorTokens];
  mutatedTokens[tokenIndex] = mutatedToken;

  const mutatedTransmission = TransmissionSchema.parse({
    ...original,
    id: nanoid(),
    content: reassembleContent(mutatedTokens),
    anchorTokens: mutatedTokens,
    mutated: true,
    mutationType: decision.type,
  });

  lineageBus.emit('transmission:mutated', mutatedTransmission.id, decision.type);

  return {
    transmission: mutatedTransmission,
    wasMutated: true,
    mutationType: decision.type,
    tokenIndex,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Random character deletion/insertion | LLM-based semantic transformation | LINEAGE design decision | Produces culturally plausible drift rather than obviously corrupted text |
| Full-text mutation | Per-anchor-token mutation | LINEAGE design decision (Phase 6 anchor tokens) | Enables partial corruption where some knowledge survives and some drifts |
| Fixed mutation (always mutate) | Two-stage probabilistic model | LINEAGE design decision (MUTN-03, MUTN-04) | Configurable mutation pressure; rate 0.0 = no mutation, rate 1.0 = always mutate |

## Open Questions

1. **Should the mutated transmission get a new ID or keep the original?**
   - What we know: The code creates a new `Transmission` object. `TransmissionSchema.id` is just `z.string()`.
   - What's unclear: Whether downstream consumers (inheritance composer, Phase 8) need to trace mutation lineage (original ID -> mutated ID).
   - Recommendation: Give the mutated transmission a new ID (via `nanoid()`). This preserves the original transmission on disk unchanged. The `MutationResult` return type includes metadata about what was mutated. If lineage tracking is needed later (v2), add an `originalTransmissionId` field to the schema. For v1, a new ID is cleaner and avoids overwriting the original file.

2. **Should mutated transmissions be written to disk?**
   - What we know: `writeTransmission()` from Phase 6 handles disk persistence. The mutation pipeline transforms a transmission in memory.
   - What's unclear: Whether the caller (Generation Manager, Phase 9) or the mutation pipeline itself should persist.
   - Recommendation: The mutation pipeline should NOT persist to disk. It should return the `MutationResult` and let the caller decide. The Generation Manager will call `writeTransmission()` with the mutated transmission when it wires the generation boundary. This keeps the mutation module stateless and composable, matching the pattern where `executePeakTransmission()` returns a result but `writeTransmission()` is called separately.

3. **Should the mutation prompt include the citizen's role for context?**
   - What we know: Mutation is a between-generation process, not a citizen action. The mutation happens to the transmission after the citizen dies.
   - What's unclear: Whether role context would produce better mutations.
   - Recommendation: No. The mutation system prompt should be role-agnostic. The mutation represents information loss in transit, not a citizen's interpretation. Use the dedicated `MUTATION_SYSTEM_PROMPT` that frames the LLM as an imperfect transmission medium.

4. **How many tokens should be mutated per transmission?**
   - What we know: A typical transmission has 3-7 anchor tokens. The mutation rate controls whether mutation occurs at all.
   - What's unclear: Should multiple tokens be mutated in a single pass, or always exactly one?
   - Recommendation: Mutate exactly one token per mutation pass for v1. This creates gradual drift rather than catastrophic corruption. Multiple-token mutation could be a v2 parameter. One token per pass also means one LLM call per mutation, keeping costs bounded.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run src/mutation/mutation.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MUTN-01 | Small mutation prompt includes instructions for semantic drift (imprecision, not destruction) | unit | `npx vitest run src/mutation/mutation.test.ts -t "buildSmallMutationPrompt"` | Wave 0 |
| MUTN-01 | Small mutation executor calls query() and returns transformed claim | unit | `npx vitest run src/mutation/mutation.test.ts -t "executeMutation.*small"` | Wave 0 |
| MUTN-02 | Large mutation prompt includes instructions for semantic inversion | unit | `npx vitest run src/mutation/mutation.test.ts -t "buildLargeMutationPrompt"` | Wave 0 |
| MUTN-02 | Large mutation executor calls query() and returns inverted claim | unit | `npx vitest run src/mutation/mutation.test.ts -t "executeMutation.*large"` | Wave 0 |
| MUTN-03 | decideMutation returns { mutate: false } when randomFn returns value >= mutationRate | unit | `npx vitest run src/mutation/mutation.test.ts -t "decideMutation"` | Wave 0 |
| MUTN-03 | mutateTransmission with mutationRate 0.0 returns original unchanged | unit | `npx vitest run src/mutation/mutation.test.ts -t "mutationRate 0.0"` | Wave 0 |
| MUTN-03 | mutateTransmission with mutationRate 1.0 always applies mutation | unit | `npx vitest run src/mutation/mutation.test.ts -t "mutationRate 1.0"` | Wave 0 |
| MUTN-04 | decideMutation uses largeMutationProbability to select type independently from rate | unit | `npx vitest run src/mutation/mutation.test.ts -t "largeMutationProbability"` | Wave 0 |
| MUTN-04 | mutateTransmission with largeMutationProbability 0.0 never produces large mutations | unit | `npx vitest run src/mutation/mutation.test.ts -t "largeMutationProbability 0.0"` | Wave 0 |
| ALL | mutateTransmission with empty anchorTokens returns unchanged | unit | `npx vitest run src/mutation/mutation.test.ts -t "empty anchorTokens"` | Wave 0 |
| ALL | Mutated transmission has mutated: true and mutationType set | unit | `npx vitest run src/mutation/mutation.test.ts -t "mutated.*true"` | Wave 0 |
| ALL | Mutated transmission content is reassembled from mutated anchorTokens | unit | `npx vitest run src/mutation/mutation.test.ts -t "reassembleContent"` | Wave 0 |
| ALL | transmission:mutated event emitted with correct args | unit | `npx vitest run src/mutation/mutation.test.ts -t "transmission:mutated"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/mutation/mutation.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/mutation/mutation.test.ts` -- covers MUTN-01, MUTN-02, MUTN-03, MUTN-04
- [ ] Agent SDK mock pattern -- reuse `createMockQueryGenerator` helper from `transmission.test.ts`
- [ ] `reassembleContent` tests -- verify [N] formatted content roundtrips correctly

## Project Constraints (from CLAUDE.md)

### Technology Constraints
- **TypeScript 6.0.2** with ESM (`"type": "module"`, `verbatimModuleSyntax`)
- **Zod 4.3.6** for all schema validation (NOT Zod 3)
- **No build step** -- direct TS imports via `tsx`
- **All imports use `.js` extension** (`moduleResolution: "nodenext"`)
- **`strict: true`** in tsconfig

### Pattern Constraints
- Follow Genesis StateManager pattern for all disk persistence (atomic writes)
- Event bus is `lineageBus` (standalone EventEmitter, NOT Genesis bus)
- Agent SDK calls use `permissionMode: 'dontAsk'` and `persistSession: false`
- Tests use Vitest with `vi.mock` for Agent SDK mocking
- No `winston`/`pino` logging -- direct `console.log` with chalk formatting (when needed)

### Stack Constraints
- Do NOT install any new packages -- all dependencies for this phase are already installed
- Do NOT modify existing schemas -- `TransmissionSchema` already has `mutated` and `mutationType` fields
- Use `nanoid` for ID generation (not `crypto.randomUUID()`)

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `src/schemas/transmission.ts` -- TransmissionSchema with `mutated: z.boolean().default(false)`, `mutationType: z.string().optional()`
- Direct codebase inspection of `src/schemas/simulation.ts` -- `mutationRate: z.number().min(0).max(1).default(0.3)`, `largeMutationProbability: z.number().min(0).max(1).default(0.1)`
- Direct codebase inspection of `src/config/defaults.ts` -- `mutationRate: 0.3`, `largeMutationProbability: 0.1`
- Direct codebase inspection of `src/events/types.ts` -- `'transmission:mutated': (transmissionId: string, mutationType: string) => void`
- Direct codebase inspection of `src/transmission/transmission-executor.ts` -- Agent SDK `query()` call pattern with async generator consumption
- Direct codebase inspection of `src/transmission/anchor-parser.ts` -- `extractAnchorTokens()` function and `[N]` format contract
- Direct codebase inspection of `src/transmission/transmission-writer.ts` -- `writeTransmission()` persistence pattern
- Direct codebase inspection of `src/transmission/transmission.test.ts` -- Agent SDK mock pattern with `createMockQueryGenerator`

### Secondary (MEDIUM confidence)
- Phase 6 research and plan files -- architectural patterns and anti-patterns that apply to Phase 7
- Existing project decisions from `.planning/STATE.md` -- stateless function design, pure function patterns, graceful error degradation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified in codebase. No new dependencies needed.
- Architecture: HIGH - Follows established Phase 5/6 patterns (stateless functions, Agent SDK query(), schema validation). TransmissionSchema already has all required fields.
- Pitfalls: HIGH - Based on direct analysis of the anchor token format, Agent SDK call patterns, and probabilistic edge cases (0.0, 1.0 mutation rates).
- Code examples: HIGH - Based on verified codebase patterns adapted for the mutation domain. All patterns are minor variations of existing code.

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no external dependency changes expected)
