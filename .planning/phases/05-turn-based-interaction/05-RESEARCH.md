# Phase 5: Turn-Based Interaction - Research

**Researched:** 2026-03-24
**Domain:** Sequential agent execution, output chaining, within-generation narrative
**Confidence:** HIGH

## Summary

Phase 5 implements the turn-based interaction model where citizens within a generation execute sequentially, each building on the previous citizen's output. This is the core mechanism that transforms isolated agent monologues into a within-generation conversation. The technical challenge is straightforward: call Agent SDK `query()` for each citizen in order, collect the text output, and inject it into the next citizen's prompt as context. The design challenge is harder: structuring the handoff format so that citizens actually build on prior work rather than ignoring it.

The existing codebase provides all the building blocks: `birthCitizen()` creates configured citizens with role-specific system prompts, `ContextBudget` tracks token consumption, `createDeathThresholds()` wires mortality into each citizen's lifecycle, and the `lineageBus` emits typed events. What's missing is the orchestration layer that sequences these citizens and threads their outputs together. This phase creates a `TurnRunner` that owns the execution loop for a single generation's citizens.

**Primary recommendation:** Use the V1 `query()` API with separate calls per citizen (not sessions or V2). Each citizen gets a fresh `query()` call where the prompt includes the previous citizen's output as structured context. The `TurnRunner` collects `SDKResultMessage.result` (the final text) from each citizen and formats it as a handoff block for the next citizen's prompt.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTR-01 | Citizens within a generation execute turn-based sequentially | TurnRunner iterates citizens array in order, awaiting each query() completion before starting the next. Enforced by sequential async/await -- no Promise.all. |
| INTR-02 | Each citizen sees the previous citizen's output as part of their input context | Previous citizen's output extracted from SDKResultMessage.result and injected as a structured handoff block in the next citizen's prompt string. |
| INTR-03 | Turn order creates within-generation narrative (structured handoffs between citizens) | Handoff format includes the previous citizen's role, name, and output. System prompts already instruct citizens to build on inherited work. Turn output schema captures the full chain for narrative verification. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

### Locked Decisions (from project and accumulated context)
- **Tech stack**: TypeScript, ESM-only with `type: module`
- **Agent execution**: Claude Agent SDK `query()` with `permissionMode: 'dontAsk'`
- **Schema compatibility**: Must extend Genesis schemas (AgentConfigSchema)
- **No parallel execution**: "Parallel agent execution -- Destroys turn-based conversation model" (Out of Scope)
- **No agent-to-agent chat**: "Interaction through turns, not dialogue" (Out of Scope)
- **Context window IS memory**: No persistent memory; context fills, you die
- **Decline signals are SYSTEM NOTICE plain text** for injection into agent conversation context
- **Role prompts under 2000 chars** each for efficient context window usage
- **Prompt builder appends shared mortality awareness** section to all roles
- **citizenName uses separate nanoid(6)**, independent from citizen ID
- **lineageBus** is standalone EventEmitter (not Genesis bus) for standalone operation
- **Agent SDK permissionMode: 'dontAsk'** -- headless execution, denies anything not in allowedTools

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/claude-agent-sdk` | ^0.2.81 | Agent execution via `query()` | The execution layer for all citizen agent calls. `query()` returns async generator yielding `SDKMessage` types. |
| `zod` | ^4.0.0 | Schema validation for turn output types | All data schemas in the project use Zod 4. |
| `eventemitter3` | ^5.0.0 | Typed event bus (`lineageBus`) | Already used for citizen:born, citizen:died events. Turn events will follow same pattern. |
| `nanoid` | ^5.0.0 | ID generation for turn records | Already used for citizen IDs and names. |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^4.0.0 | Unit testing | Test TurnRunner, handoff formatting, output extraction. |

### No New Dependencies
This phase requires no new package installations. All functionality is built with the existing Agent SDK `query()` API, Zod schemas, and EventEmitter3.

## Architecture Patterns

### Recommended Project Structure
```
src/
  interaction/
    turn-runner.ts       # TurnRunner class -- orchestrates sequential citizen execution
    handoff.ts           # Handoff formatting -- structures output for next citizen
    turn-output.ts       # Zod schema for TurnOutput (what each citizen produces)
    index.ts             # Barrel exports
    interaction.test.ts  # Unit tests with mocked Agent SDK
```

### Pattern 1: Sequential TurnRunner
**What:** A class that takes an array of CitizenConfig objects and executes them one at a time, threading output forward.
**When to use:** Every time a generation's citizens need to interact.
**Design:**

```typescript
// src/interaction/turn-runner.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { CitizenConfig } from '../schemas/index.js';
import type { TurnOutput } from './turn-output.js';
import { formatHandoff } from './handoff.js';
import { lineageBus } from '../events/index.js';

export interface TurnRunnerConfig {
  /** The seed problem for this generation */
  seedProblem: string;
  /** Ordered array of citizens to execute */
  citizens: CitizenConfig[];
}

export interface TurnResult {
  /** Ordered array of turn outputs, one per citizen */
  turns: TurnOutput[];
  /** Total tokens consumed across all citizens */
  totalTokens: { input: number; output: number };
}

export async function runTurns(config: TurnRunnerConfig): Promise<TurnResult> {
  const turns: TurnOutput[] = [];
  const totalTokens = { input: 0, output: 0 };

  for (let i = 0; i < config.citizens.length; i++) {
    const citizen = config.citizens[i];
    const previousTurns = turns.slice(); // all prior turns

    // Build prompt: seed problem + handoff from previous citizens
    const prompt = buildTurnPrompt(config.seedProblem, previousTurns);

    // Execute citizen agent
    const turnOutput = await executeCitizenTurn(citizen, prompt);
    turns.push(turnOutput);
    totalTokens.input += turnOutput.usage.inputTokens;
    totalTokens.output += turnOutput.usage.outputTokens;
  }

  return { turns, totalTokens };
}
```

### Pattern 2: Handoff Formatting
**What:** Structure the previous citizen's output so the next citizen can meaningfully engage with it.
**When to use:** Between every pair of adjacent citizens in the turn order.
**Key insight:** The handoff must include enough context for role-aware interaction (a Skeptic needs to know a Builder said something to question it) but not so much that it fills the context window.

```typescript
// src/interaction/handoff.ts

export interface HandoffBlock {
  citizenName: string;
  role: string;
  turnNumber: number;
  output: string;
}

/**
 * Format previous turns into a structured handoff for the next citizen.
 * Only includes the most recent citizen's full output plus a summary chain
 * of earlier citizens to preserve context window space.
 */
export function formatHandoff(previousTurns: TurnOutput[]): string {
  if (previousTurns.length === 0) return '';

  const lines: string[] = ['PREVIOUS CITIZEN CONTRIBUTIONS:'];

  for (const turn of previousTurns) {
    lines.push(`--- ${turn.citizenName} (${turn.role}, Turn ${turn.turnNumber}) ---`);
    lines.push(turn.output);
    lines.push('');
  }

  lines.push('Build on, question, record, interpret, or observe the above based on your role.');
  return lines.join('\n');
}
```

### Pattern 3: Citizen Turn Execution
**What:** Execute a single citizen via Agent SDK `query()`, extract the text result, and return structured output.
**When to use:** For each citizen in the turn sequence.
**Key insight:** Use the V1 `query()` API. Each citizen is a separate `query()` call with its own systemPrompt. The `prompt` parameter carries the handoff context. The `SDKResultMessage` with `subtype: 'success'` contains the final `result` string.

```typescript
// Inside turn-runner.ts
async function executeCitizenTurn(
  citizen: CitizenConfig,
  prompt: string,
): Promise<TurnOutput> {
  const gen = query({
    prompt,
    options: {
      systemPrompt: citizen.systemPrompt,
      maxTurns: citizen.maxTurns ?? 1,
      permissionMode: 'dontAsk',
      model: citizen.model,
      persistSession: false,
    },
  });

  let resultText = '';
  let usage = { inputTokens: 0, outputTokens: 0 };

  for await (const msg of gen) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      resultText = msg.result;
      usage = {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      };
    }
  }

  return {
    citizenId: citizen.id,
    citizenName: citizen.name,
    role: citizen.role,
    turnNumber: /* position in sequence */,
    output: resultText,
    usage,
    timestamp: new Date().toISOString(),
  };
}
```

### Pattern 4: Turn Prompt Construction
**What:** Build the user-facing prompt that each citizen receives, combining the seed problem with handoff context.
**When to use:** Before each `query()` call.
**Key insight:** The first citizen gets only the seed problem. Subsequent citizens get the seed problem plus structured handoff from all previous citizens.

```typescript
function buildTurnPrompt(seedProblem: string, previousTurns: TurnOutput[]): string {
  if (previousTurns.length === 0) {
    return `You are the first citizen in your generation to address this problem.\n\nSEED PROBLEM: "${seedProblem}"\n\nShare your thinking on this problem based on your role.`;
  }

  const handoff = formatHandoff(previousTurns);
  return `${handoff}\n\nSEED PROBLEM: "${seedProblem}"\n\nYou are citizen ${previousTurns.length + 1} in your generation. Respond to the contributions above based on your role.`;
}
```

### Anti-Patterns to Avoid
- **Using V2 SDK `unstable_v2_createSession()` for multi-citizen turns:** V2 sessions maintain conversation history within a single agent identity. But each citizen is a DIFFERENT agent with a different systemPrompt. Sessions are for multi-turn with the same agent; citizen turns are for sequential-single-turn across different agents. Use separate `query()` calls.
- **Using `resume` option to chain citizens:** Resume continues the same agent's conversation. Citizens are distinct identities. Never resume a previous citizen's session for a new citizen.
- **Passing ALL previous turns to every citizen:** With 5 citizens per generation and each producing significant output, citizen 5 would receive 4x the context. Use the full chain for now (generation size is small, default 5), but design the handoff format so it can be truncated later if needed.
- **Running citizens in parallel with `Promise.all()`:** Explicitly out of scope. "Parallel agent execution -- Destroys turn-based conversation model." Sequential execution is the requirement.
- **Injecting handoff into systemPrompt instead of prompt:** The systemPrompt defines the citizen's role identity and is set at birth. The handoff is runtime context that changes per turn. Keep them separate: systemPrompt = identity, prompt = context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent execution | Custom LLM API wrapper | Agent SDK `query()` | SDK handles auth, streaming, error recovery, token tracking |
| Output extraction | Manual response parsing | `SDKResultMessage.result` | The SDK already extracts the final text result as a string |
| Token tracking | Manual token counting | `SDKResultMessage.usage` | The result message includes `input_tokens` and `output_tokens` from the API |
| Schema validation | Manual type guards | Zod schemas + `.parse()` | Project pattern: all data types use Zod schemas |
| Event emission | Custom pub/sub | `lineageBus.emit()` | Existing typed event bus with `LineageEvents` interface |

**Key insight:** The Agent SDK already gives us everything we need for single-turn execution. The `query()` function handles the full lifecycle: send prompt, get streaming response, collect result with usage stats. The only new code is the orchestration loop and handoff formatting.

## Common Pitfalls

### Pitfall 1: Context Window Exhaustion from Cumulative Handoffs
**What goes wrong:** Each citizen receives all previous citizens' outputs. Citizen 5 in a 5-citizen generation gets 4 full outputs in their prompt, potentially consuming a large fraction of their context window before they even start thinking.
**Why it happens:** Naive implementation concatenates all previous outputs without any truncation or summarization.
**How to avoid:** For v1 with default generationSize of 5, full concatenation is acceptable (each turn output is 1-2K tokens, so citizen 5 gets ~4-8K tokens of handoff, well within model context). However, design the handoff formatter to accept a `maxTokens` parameter for future phases. Monitor `usage.input_tokens` from each SDKResultMessage to track the growth.
**Warning signs:** `usage.input_tokens` growing significantly faster than expected across turns in a generation.

### Pitfall 2: Ignoring Error/Non-Success Results
**What goes wrong:** A citizen's `query()` might produce an `SDKResultMessage` with `subtype: 'error_max_turns'` or `'error_during_execution'` instead of `'success'`. If the runner assumes success, subsequent citizens get empty handoffs.
**Why it happens:** Agent SDK can fail for many reasons: rate limits, auth errors, max turns exceeded.
**How to avoid:** Check `msg.subtype` on the result message. For `'error_max_turns'`, the citizen simply ran out of turns -- treat as a short life (they produced whatever output they could). For execution errors, log the error and either retry once or mark the citizen as "died in execution" and continue to the next citizen with whatever partial output exists.
**Warning signs:** Empty `resultText` after consuming the async generator.

### Pitfall 3: Confusing Turn Context with Inheritance
**What goes wrong:** Phase 5 handoffs (within-generation, between citizens) get conflated with Phase 8 inheritance (cross-generation, curated knowledge delivery).
**Why it happens:** Both involve passing information from one agent to another.
**How to avoid:** Keep the concepts architecturally separate. Turn handoffs are raw citizen output passed to the next citizen in the same generation. Inheritance is curated, staged, and potentially mutated knowledge from previous generations. The handoff formatter lives in `src/interaction/`, not in `src/inheritance/` (which doesn't exist yet).
**Warning signs:** Turn output schema including fields like `mutated`, `anchorTokens`, or `layer` that belong to the Transmission/Inheritance schemas.

### Pitfall 4: Not Wiring ContextBudget into Turn Execution
**What goes wrong:** ContextBudget thresholds (peak-transmission, decline signals, death) exist from Phase 3 but aren't connected to the actual Agent SDK `query()` execution in Phase 5.
**Why it happens:** Phase 5 requirements (INTR-01, INTR-02, INTR-03) focus on turn ordering and handoffs, not mortality. The temptation is to defer ContextBudget integration entirely.
**How to avoid:** Phase 5 SHOULD update each citizen's ContextBudget with the usage from their `SDKResultMessage`, but SHOULD NOT implement the full death/transmission logic (that's Phase 6 and 9). Update the budget, emit events if thresholds are crossed, but don't act on them yet. This keeps the budget accurate for later phases.
**Warning signs:** ContextBudget never updated during turn execution, making it stale by Phase 6.

### Pitfall 5: maxTurns Confusion
**What goes wrong:** Setting `maxTurns: 1` in the Agent SDK means the agent gets ONE tool-use round trip, not one message. For a citizen that just needs to respond to a prompt with no tools, `maxTurns: 1` is fine. But if citizens later gain MCP tools (for writing transmissions), they may need more turns.
**Why it happens:** The Agent SDK `maxTurns` counts agentic turns (tool use cycles), not conversation turns.
**How to avoid:** For Phase 5 (no tools), `maxTurns: 1` is correct. The citizen receives the prompt, responds, and the query ends. Design the `executeCitizenTurn` function to accept `maxTurns` from the CitizenConfig rather than hardcoding it.
**Warning signs:** Citizens producing truncated output with `subtype: 'error_max_turns'` when they should have more room to think.

## Code Examples

### Example 1: Extracting Text from Agent SDK Result

```typescript
// Source: Agent SDK TypeScript Reference + existing index.test.ts mock pattern

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage, SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk';

async function getAgentOutput(prompt: string, systemPrompt: string): Promise<string> {
  const gen = query({
    prompt,
    options: {
      systemPrompt,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      persistSession: false,
    },
  });

  for await (const msg of gen) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        return msg.result; // The final text output
      }
      // Handle error subtypes
      return `[Agent error: ${msg.subtype}]`;
    }
  }

  return '[No result received]';
}
```

### Example 2: Mocking Agent SDK for Tests

```typescript
// Source: Existing pattern from src/index.test.ts

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(({ prompt, options }: { prompt: string; options: Record<string, unknown> }) => {
    return (async function* () {
      yield {
        type: 'assistant' as const,
        message: {
          content: [{ type: 'text', text: `Response to: ${prompt.slice(0, 50)}...` }],
        },
        parent_tool_use_id: null,
        uuid: 'test-uuid',
        session_id: 'test-session',
      };
      yield {
        type: 'result' as const,
        subtype: 'success' as const,
        result: `Mocked response from ${(options as { systemPrompt?: string }).systemPrompt?.slice(0, 20)}`,
        is_error: false,
        num_turns: 1,
        duration_ms: 100,
        duration_api_ms: 50,
        total_cost_usd: 0.001,
        usage: { input_tokens: 200, output_tokens: 300 },
        modelUsage: {},
        permission_denials: [],
        stop_reason: 'end_turn',
        uuid: 'test-uuid',
        session_id: 'test-session',
      };
    })();
  }),
}));
```

### Example 3: TurnOutput Schema

```typescript
// src/interaction/turn-output.ts
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
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1 `query()` async generator | V2 `send()`/`stream()` sessions (PREVIEW) | 2025+ | V2 is simpler for multi-turn with SAME agent. But LINEAGE uses DIFFERENT agents per turn, so V1 separate `query()` calls remain correct. |
| `maxThinkingTokens` option | `thinking` option with `ThinkingConfig` | Agent SDK v0.2.x | Use `thinking: { type: 'adaptive' }` (default) rather than deprecated `maxThinkingTokens`. |

**Deprecated/outdated:**
- V2 SDK (`unstable_v2_*`): Preview only. API may change. Not appropriate for production use. V1 `query()` is stable and sufficient.
- `maxThinkingTokens`: Deprecated in favor of `thinking` option. Don't set it.

## Open Questions

1. **Token budget per citizen for handoff context**
   - What we know: Default generationSize is 5. Each citizen response is likely 500-2000 tokens. So citizen 5 gets ~2K-8K tokens of prior context in the handoff.
   - What's unclear: At what generation size does handoff context become problematic? The model context window is large (200K+), but LINEAGE deliberately uses context consumption as lifespan -- too much handoff eats into productive thinking time.
   - Recommendation: Track and log handoff token size. For v1, no truncation needed. Add a `maxHandoffTokens` config option as a placeholder for Phase 9 tuning.

2. **Whether to include thinking/reasoning in handoff or just final output**
   - What we know: `SDKResultMessage.result` contains the agent's final text output. The `SDKAssistantMessage.message.content` may contain both thinking blocks and text blocks.
   - What's unclear: Should citizens see each other's reasoning process, or only their final conclusions?
   - Recommendation: Use `SDKResultMessage.result` only (final output). This is what the agent chose to communicate. Internal reasoning is private to the citizen, consistent with the mortality metaphor (you only know what someone said, not everything they thought).

3. **Error handling strategy for mid-generation failures**
   - What we know: If citizen 3 of 5 fails (rate limit, auth error), citizens 4 and 5 won't get citizen 3's contribution.
   - What's unclear: Should the generation continue without citizen 3's output, retry, or abort?
   - Recommendation: Continue with a placeholder noting the citizen "died unexpectedly in thought." This preserves the turn chain and is thematically consistent with the mortality model. Log the error for debugging.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (exists at project root) |
| Quick run command | `npx vitest run src/interaction/interaction.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTR-01 | Citizens execute one at a time in defined turn order | unit | `npx vitest run src/interaction/interaction.test.ts -t "executes citizens sequentially" -x` | Wave 0 |
| INTR-01 | Turn order matches input array order | unit | `npx vitest run src/interaction/interaction.test.ts -t "turn order matches" -x` | Wave 0 |
| INTR-02 | Each citizen's prompt includes previous citizen's output | unit | `npx vitest run src/interaction/interaction.test.ts -t "includes previous output" -x` | Wave 0 |
| INTR-02 | First citizen receives seed problem without handoff | unit | `npx vitest run src/interaction/interaction.test.ts -t "first citizen no handoff" -x` | Wave 0 |
| INTR-03 | Handoff includes citizen role and name for narrative context | unit | `npx vitest run src/interaction/interaction.test.ts -t "handoff includes role" -x` | Wave 0 |
| INTR-03 | Output chain forms coherent sequence (turnNumber increments, all citizens present) | unit | `npx vitest run src/interaction/interaction.test.ts -t "coherent sequence" -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/interaction/interaction.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/interaction/interaction.test.ts` -- covers INTR-01, INTR-02, INTR-03
- [ ] Agent SDK mock setup for sequential multi-citizen execution (extend pattern from `src/index.test.ts`)

## Sources

### Primary (HIGH confidence)
- Agent SDK TypeScript Reference -- https://platform.claude.com/docs/en/agent-sdk/typescript (query() signature, Options type, SDKMessage types, SDKResultMessage structure)
- Agent SDK V2 Preview -- https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview (confirmed V2 sessions are for same-agent multi-turn, not suitable for cross-agent turn chaining)
- Existing codebase: `src/index.test.ts` (Agent SDK mock pattern), `src/mortality/citizen-lifecycle.ts` (birthCitizen factory), `src/schemas/citizen.ts` (CitizenConfigSchema), `src/events/types.ts` (LineageEvents interface)
- Genesis shared schemas: `@genesis/shared` AgentConfigSchema (base schema with model, systemPrompt, maxTurns, permissionMode defaults)

### Secondary (MEDIUM confidence)
- Turn-based AI agent orchestration patterns -- derived from Agent SDK docs showing sequential `query()` calls as the standard pattern for multi-agent workflows

### Tertiary (LOW confidence)
- None -- all findings verified against SDK docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries confirmed working (163 tests pass)
- Architecture: HIGH -- TurnRunner pattern follows directly from Agent SDK `query()` API design; handoff formatting is string composition
- Pitfalls: HIGH -- identified from SDK type definitions (error subtypes), existing ContextBudget integration requirements, and project Out of Scope constraints

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no fast-moving dependencies)
