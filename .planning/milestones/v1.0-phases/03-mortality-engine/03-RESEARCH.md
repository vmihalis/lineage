# Phase 3: Mortality Engine - Research

**Researched:** 2026-03-24
**Domain:** Agent lifecycle management, context-as-lifespan tracking, death profile execution
**Confidence:** HIGH

## Summary

Phase 3 implements the Mortality Engine -- the core mechanic that makes LINEAGE unique. Citizens are born with hidden death profiles (old-age or accident), age through context token consumption, and die when their context budget is exhausted. This phase builds on the Zod schemas and typed events from Phase 2 (DeathProfileSchema, CitizenConfigSchema, SimulationParametersSchema) and introduces runtime context tracking, citizen lifecycle management, and two distinct death execution paths.

The Claude Agent SDK provides all the infrastructure needed for context tracking. Each `SDKAssistantMessage` yielded from the `query()` async generator contains a `BetaMessage` with a `usage` field reporting `input_tokens` and `output_tokens`. The `SDKResultMessage` (final message) includes a `ModelUsage` object with `contextWindow` (the model's total context window size) and cumulative `inputTokens`/`outputTokens`. Additionally, the SDK's `maxTurns` option on both `query()` and `AgentDefinition` provides a hard stop mechanism, and `query.close()` enables immediate mid-stream termination for accident deaths.

The primary technical risk is context tracking precision. The SDK introduces overhead (system prompts, tool definitions, permission checks) that consumes context tokens invisibly. The STATE.md notes "15-20% safety buffer is a guess until empirically tested in Phase 3." The research recommends a conservative 20% safety buffer initially, with the ContextBudget abstraction designed to be tunable.

**Primary recommendation:** Build a `ContextBudget` class that wraps SDK usage tracking, computes context consumption as a percentage, and exposes threshold callbacks for death profile triggers. Use `query.close()` for accident death (instant termination) and `maxTurns` exhaustion combined with declining-context signals for old-age death.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Citizen agent born with assigned role, generation number, and hidden death profile | CitizenConfigSchema already has all fields. "Hidden" means deathProfile is stored in metadata but excluded from the systemPrompt given to the agent. Birth factory function selects profile via weighted random from config distribution. |
| LIFE-02 | Context consumption tracked as percentage of max tokens (context-as-age proxy) | SDKAssistantMessage.message.usage provides per-turn input_tokens/output_tokens. SDKResultMessage.modelUsage provides contextWindow. ContextBudget computes cumulative percentage. |
| LIFE-03 | ContextBudget abstraction with safety buffers accounting for SDK overhead (10-20% imprecision) | ModelUsage.contextWindow gives total capacity. Apply configurable safety buffer (default 20%) to define effective capacity. Track cumulative tokens from usage objects. |
| LIFE-04 | Old age death profile -- context fills gradually, agent can observe decline | When context reaches ~80% of effective budget, inject system-level signals about "feeling old." At ~90%, trigger final transmission window. At 95%, execute graceful shutdown. Use maxTurns + monitoring. |
| LIFE-05 | Accident death profile -- random termination at unpredictable point, no warning, mid-sentence cut | Pre-calculate a random termination point (e.g., 30-70% context). When reached, call query.close() immediately. Output is cut mid-stream. |
| LIFE-06 | Death profiles assigned hidden at birth via weighted random selection from configured distribution | DeathProfileDistributionSchema already exists with {old-age: 0.7, accident: 0.3}. Weighted random selection is straightforward math on the distribution weights. |
| LIFE-07 | Generation 1 protected from random death by default (configurable parameter) | SimulationParameters.gen1Protection already exists (default true). When true + generationNumber === 1, override any accident profile assignment to old-age. |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/claude-agent-sdk` | ^0.2.81 | Agent execution, context tracking via query() | Provides SDKAssistantMessage.message.usage for token tracking, maxTurns for turn limits, query.close() for termination |
| `zod` | ^4.3.6 | Schema validation for ContextBudget, CitizenState | Already used for all schemas. New ContextBudget schemas extend existing patterns. |
| `eventemitter3` | ^5.0.0 | Event emission for citizen:born, citizen:died | lineageBus already set up with typed LineageEvents |
| `nanoid` | ^5.0.0 | ID generation for citizens | Already used in state manager tests |

### Supporting (no new packages)

This phase requires no new npm packages. All functionality is built with existing dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual token tracking from BetaMessage.usage | Anthropic token-counting API | Token counting API is for pre-flight estimation. We need post-hoc tracking from actual usage. BetaMessage.usage is the correct source. |
| query.close() for accident death | AbortController | AbortController is passed in options but close() is the documented method for immediate termination. Both work but close() is more explicit. |
| Percentage-based context tracking | Raw token counts | Percentage normalizes across different models/context windows. If context window changes (200k vs 1M), thresholds still work. |

**Installation:** No new packages needed. Phase 3 uses only existing dependencies.

## Architecture Patterns

### Recommended Project Structure

```
src/
  mortality/
    context-budget.ts      # ContextBudget class -- tracks tokens, computes percentages
    death-profiles.ts      # Death profile assignment and execution logic
    citizen-lifecycle.ts   # Birth, aging, death orchestration
    index.ts               # Barrel export
    mortality.test.ts      # Unit tests for all mortality components
  schemas/                 # (existing -- no changes needed)
  events/                  # (existing -- no changes needed)
  config/                  # (existing -- no changes needed)
```

### Pattern 1: ContextBudget as Percentage Tracker

**What:** A class that wraps raw SDK token usage into a normalized 0-1 percentage representing "age." It accepts usage updates from each SDK message and emits threshold events.

**When to use:** Every time an SDKAssistantMessage is received during a citizen's query() execution.

**Example:**

```typescript
// Source: Based on SDK types ModelUsage and BetaMessage.usage
import type { ModelUsage } from '@anthropic-ai/claude-agent-sdk';

export interface ContextBudgetConfig {
  /** Total context window in tokens (from ModelUsage.contextWindow) */
  contextWindow: number;
  /** Safety buffer as fraction (0.20 = 20%) to account for SDK overhead */
  safetyBuffer: number;
  /** Thresholds that trigger callbacks when crossed */
  thresholds: ContextThreshold[];
}

export interface ContextThreshold {
  /** Percentage (0-1) at which this threshold triggers */
  percentage: number;
  /** Label for this threshold (e.g., 'peak-transmission', 'decline-warning', 'death') */
  label: string;
}

export class ContextBudget {
  private consumedTokens = 0;
  private readonly effectiveCapacity: number;
  private readonly thresholds: ContextThreshold[];
  private triggeredThresholds = new Set<string>();

  constructor(config: ContextBudgetConfig) {
    // Effective capacity = total window minus safety buffer
    this.effectiveCapacity = config.contextWindow * (1 - config.safetyBuffer);
    this.thresholds = [...config.thresholds].sort((a, b) => a.percentage - b.percentage);
  }

  /** Update with token usage from an SDKAssistantMessage */
  update(inputTokens: number, outputTokens: number): ContextThreshold[] {
    this.consumedTokens += inputTokens + outputTokens;
    const newlyTriggered: ContextThreshold[] = [];
    for (const threshold of this.thresholds) {
      if (!this.triggeredThresholds.has(threshold.label) && this.percentage >= threshold.percentage) {
        this.triggeredThresholds.add(threshold.label);
        newlyTriggered.push(threshold);
      }
    }
    return newlyTriggered;
  }

  get percentage(): number {
    return Math.min(this.consumedTokens / this.effectiveCapacity, 1.0);
  }

  get remainingTokens(): number {
    return Math.max(this.effectiveCapacity - this.consumedTokens, 0);
  }
}
```

### Pattern 2: Hidden Death Profile Assignment

**What:** At citizen birth, a death profile is selected from the configured distribution using weighted random selection, but the profile type is NEVER included in the citizen's system prompt. The citizen does not know how or when they will die.

**When to use:** During the BIRTHING phase of generation lifecycle.

**Example:**

```typescript
import type { DeathProfile, DeathProfileDistribution } from '../schemas/index.js';

/**
 * Select a death profile using weighted random from distribution.
 * For gen1 with protection enabled, always returns 'old-age'.
 */
export function assignDeathProfile(
  distribution: DeathProfileDistribution,
  generationNumber: number,
  gen1Protection: boolean,
): DeathProfile {
  if (gen1Protection && generationNumber === 1) {
    return 'old-age';
  }

  const roll = Math.random();
  let cumulative = 0;
  for (const [profile, weight] of Object.entries(distribution)) {
    cumulative += weight;
    if (roll < cumulative) {
      return profile as DeathProfile;
    }
  }
  // Fallback (should not reach due to distribution summing to ~1.0)
  return 'old-age';
}
```

### Pattern 3: Old Age Death Execution

**What:** Context fills gradually. As the citizen ages (context percentage increases), they receive signals about decline. This gives them time for careful final transmission. Death is graceful -- the query completes naturally when maxTurns is exhausted or context fills.

**When to use:** Citizens with death profile 'old-age'.

**Key thresholds:**
- 40-50%: Peak transmission window (TRAN-01, Phase 6 -- but threshold detection is Phase 3)
- 75-80%: Decline signals begin ("You notice your thoughts becoming slower...")
- 85-90%: Final transmission window
- 95%+: Death -- stop feeding new turns, let current turn complete

### Pattern 4: Accident Death Execution

**What:** A random termination point is pre-calculated at birth (e.g., between 30-70% context). When the ContextBudget crosses this threshold, `query.close()` is called immediately, cutting the output mid-stream with no warning.

**When to use:** Citizens with death profile 'accident'.

**Key mechanism:** The random termination point is chosen at birth but stored only in metadata, never revealed to the citizen. When the threshold is crossed mid-message, the query is forcibly terminated.

```typescript
/** Pre-calculate the accident termination point at birth */
export function calculateAccidentPoint(): number {
  // Random point between 30% and 70% of effective context
  return 0.3 + Math.random() * 0.4;
}
```

### Pattern 5: Citizen Birth Factory

**What:** A factory function that creates a fully configured citizen with all required fields from CitizenConfigSchema, assigns a death profile, sets up the ContextBudget, and emits the citizen:born event.

**When to use:** During generation BIRTHING phase.

```typescript
import { nanoid } from 'nanoid';
import type { CitizenConfig, CitizenRole, SimulationParameters } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';

export function birthCitizen(
  role: CitizenRole,
  generationNumber: number,
  params: SimulationParameters,
): CitizenConfig {
  const deathProfile = assignDeathProfile(
    params.deathProfileDistribution,
    generationNumber,
    params.gen1Protection,
  );

  const citizen: CitizenConfig = {
    id: nanoid(),
    name: `citizen-gen${generationNumber}-${nanoid(6)}`,
    type: 'lineage-citizen',
    systemPrompt: '', // Built later by Roles phase (Phase 4)
    role,
    generationNumber,
    deathProfile,
    contextBudget: 0,
    birthTimestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  lineageBus.emit('citizen:born', citizen.id, citizen.role, citizen.generationNumber);
  return citizen;
}
```

### Anti-Patterns to Avoid

- **Revealing death profile to citizen:** The citizen's system prompt must NEVER contain information about their death type or timing. This is the core design constraint.
- **Tracking context with separate token-counting API calls:** Use the usage data already present on each SDKAssistantMessage. Pre-flight counting adds latency and cost.
- **Relying on exact token counts for threshold precision:** Token counts from the SDK have inherent imprecision (caching, overhead). Use the safety buffer and treat thresholds as approximate.
- **Implementing old-age decline signals as system prompt modifications mid-conversation:** Injecting messages into the conversation context is not how the Agent SDK works. Instead, use MCP tools that the citizen can call to "check their state" or use the SDK's streaming input to send synthetic user messages at threshold crossings.
- **Using a single fixed context window size:** Different models have different context windows (200k vs 1M). Always read contextWindow from ModelUsage, never hardcode.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token tracking per turn | Custom token counting | SDKAssistantMessage.message.usage | Already provided by SDK on every message. Includes input_tokens, output_tokens, cache tokens. |
| Agent termination | process.kill or custom abort | query.close() | SDK method that cleanly terminates the CLI subprocess and all resources. |
| Turn limiting | Manual turn counter with conditional breaks | options.maxTurns | SDK-native option that stops query after N turns, returns error_max_turns result. |
| Weighted random selection | Complex custom probability code | Simple cumulative distribution walk | The algorithm is trivial (5 lines) but commonly botched. Use the pattern shown above. |
| ID generation | UUID libraries or Math.random | nanoid | Already a dependency. Collision-resistant, URL-safe, fast. |

**Key insight:** The Agent SDK already provides the primitives for mortality (usage tracking, turn limits, termination). Phase 3's job is to compose these primitives into a ContextBudget abstraction and death profile execution logic, not to build low-level infrastructure.

## Common Pitfalls

### Pitfall 1: SDK Overhead Eating Into Context Budget
**What goes wrong:** The system prompt, tool definitions, permission checks, and MCP configuration consume context tokens before the citizen says anything. If you assume 100% of contextWindow is available for citizen content, you'll trigger death profiles too early.
**Why it happens:** The SDK injects system prompts, tool schemas, and other overhead invisibly. The BetaMessage.usage.input_tokens includes this overhead in the first turn.
**How to avoid:** Apply a 20% safety buffer to the total contextWindow. The effective capacity is `contextWindow * 0.80`. Monitor first-turn input_tokens to calibrate -- if the first turn alone consumes 5% of context, that's the baseline overhead.
**Warning signs:** Citizens dying in the first few turns. First-turn input_tokens being surprisingly high.

### Pitfall 2: Context Window Size Varies by Model
**What goes wrong:** Hardcoding 200,000 tokens as the context window. Claude Opus 4.6 and Sonnet 4.6 support 1M tokens. Sonnet 4 and 4.5 support 1M with a beta header (`context-1m-2025-08-07`). Default for some models is 200k.
**Why it happens:** Different models have different context windows, and the default may change.
**How to avoid:** Always read `contextWindow` from the `ModelUsage` in `SDKResultMessage`, or derive it from the first turn's metadata. Never hardcode a token count.
**Warning signs:** Death thresholds never triggering (citizen using 200k model but budget calculated for 1M) or triggering way too early (opposite).

### Pitfall 3: Cumulative vs Per-Turn Token Counting
**What goes wrong:** Treating each turn's input_tokens as new tokens consumed. In reality, each turn's input_tokens includes ALL previous conversation history (the full context window is re-sent each API call).
**Why it happens:** Confusion between "tokens in this API request" and "new tokens added to the conversation."
**How to avoid:** For context percentage calculation, use the LATEST turn's `input_tokens + output_tokens` as the total consumed so far (since input_tokens is cumulative -- it includes all prior context). Alternatively, track only `output_tokens` cumulatively since those represent new content added each turn. The recommended approach is to compare the latest turn's total input_tokens against the context window.
**Warning signs:** Context percentage exceeding 100% after just a few turns, or context percentage growing much faster than expected.

### Pitfall 4: Accident Death Timing Becomes Predictable
**What goes wrong:** Setting the accident termination point at a fixed percentage (e.g., always 50%) so every accident death happens at roughly the same time.
**Why it happens:** Using a fixed threshold instead of a random range.
**How to avoid:** Calculate a random termination point uniformly distributed between 30% and 70% of effective context. Each citizen gets a different point.
**Warning signs:** Accident deaths always occurring at similar moments in the simulation. Loss of dramatic tension.

### Pitfall 5: Old Age Decline Signals Not Reaching the Citizen
**What goes wrong:** Trying to modify the system prompt mid-conversation to add "you're getting old" signals. The Agent SDK does not support dynamic system prompt modification after query() starts.
**Why it happens:** Assuming system prompts are mutable.
**How to avoid:** Use one of these approaches for decline signals:
1. Include conditional instructions in the original system prompt: "If you notice the phrase 'SYSTEM: context declining' in a user message, you are aging."
2. Use the streaming input mode to inject synthetic user messages at threshold crossings.
3. Provide an MCP tool the citizen can call to "check remaining lifespan" -- but this is Phase 4+ territory.
The simplest approach for v1: include instructions in the initial system prompt about recognizing certain markers, then use streamInput() to inject messages when thresholds are crossed.
**Warning signs:** Citizen producing output that shows no awareness of aging. Old-age deaths being abrupt rather than gradual.

### Pitfall 6: Floating Point Comparison in Death Profile Distribution
**What goes wrong:** Random number generation and cumulative weight comparison failing at boundaries due to floating point precision.
**Why it happens:** IEEE 754 floating point representation.
**How to avoid:** The existing DeathProfileDistributionSchema already uses `Math.abs(sum - 1.0) < 0.01` tolerance. The weighted selection function should use `<=` not `<` for the final entry, or include a fallback return.
**Warning signs:** Rare crashes in death profile assignment with "no profile selected."

## Code Examples

Verified patterns from SDK type definitions and official documentation:

### Tracking Token Usage from SDKAssistantMessage

```typescript
// Source: SDK sdk.d.ts SDKAssistantMessage type + Anthropic API docs
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKAssistantMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

const q = query({
  prompt: 'You are a citizen of the civilization...',
  options: {
    systemPrompt: 'You are a builder...',
    maxTurns: 15,
    permissionMode: 'dontAsk',
  },
});

for await (const message of q) {
  if (message.type === 'assistant') {
    const assistantMsg = message as SDKAssistantMessage;
    // BetaMessage.usage contains token counts for this turn
    const usage = assistantMsg.message.usage;
    // usage.input_tokens -- tokens in this request (cumulative context)
    // usage.output_tokens -- tokens generated in this response

    // Update context budget with this turn's usage
    const triggered = contextBudget.update(usage.input_tokens, usage.output_tokens);
    for (const threshold of triggered) {
      if (threshold.label === 'death') {
        q.close(); // Terminate immediately for accident death
      }
    }
  }

  if (message.type === 'result') {
    const resultMsg = message as SDKResultMessage;
    // Final cumulative usage across all turns
    // resultMsg.usage -- NonNullableUsage (total input/output tokens)
    // resultMsg.modelUsage -- Record<string, ModelUsage> with contextWindow
  }
}
```

### Query Termination for Accident Death

```typescript
// Source: SDK sdk.d.ts Query.close() documentation
// "Close the query and terminate the underlying process.
//  This forcefully ends the query, cleaning up all resources including
//  pending requests, MCP transports, and the CLI subprocess.
//  Use this when you need to abort a query that is still running.
//  After calling close(), no further messages will be received."

// When accident threshold is crossed:
q.close(); // Immediate termination, no further output
```

### Multi-Turn Streaming Input for Old Age Signals

```typescript
// Source: SDK sdk.d.ts Query.streamInput() documentation
// Use AsyncIterable<SDKUserMessage> to inject messages

async function* generateCitizenPrompts(
  initialPrompt: string,
  contextBudget: ContextBudget,
): AsyncGenerator<SDKUserMessage> {
  // Initial prompt
  yield {
    type: 'user' as const,
    session_id: '',
    message: { role: 'user', content: initialPrompt },
    parent_tool_use_id: null,
  };

  // ... after processing assistant response and detecting decline threshold:
  // yield another user message with decline signal
}
```

### AgentDefinition maxTurns for Mortality

```typescript
// Source: SDK sdk.d.ts AgentDefinition.maxTurns
// "Maximum number of agentic turns (API round-trips) before stopping"

// For old-age citizens: higher maxTurns allows longer life
// For accident citizens: maxTurns is still set but query.close() may fire first
const citizenOptions = {
  maxTurns: 20, // Upper bound -- actual death may come sooner
  permissionMode: 'dontAsk' as const,
  tools: [] as string[], // No built-in tools for citizens
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded 200k context window | Dynamic context window from ModelUsage.contextWindow | Claude 4.5/4.6 (late 2025 / early 2026) | Must read contextWindow dynamically; 1M tokens available on Opus 4.6, Sonnet 4.6 |
| maxThinkingTokens (deprecated) | thinking: { type: 'adaptive' } | Opus 4.6 (2026) | Thinking tokens are managed adaptively; they don't count towards context in subsequent turns (auto-stripped) |
| No context awareness | Built-in context awareness (Sonnet 4.5, 4.6, Haiku 4.5) | Late 2025 | Models now receive token_budget info and usage updates automatically. Citizens may already "know" their budget from the model's built-in awareness. |

**Important note on context awareness:** Claude Sonnet 4.5+ and Haiku 4.5+ have built-in context awareness where the model receives `<budget:token_budget>1000000</budget:token_budget>` and per-turn usage updates like `<system_warning>Token usage: 35000/1000000; 965000 remaining</system_warning>`. This means the citizen agent might already have some natural awareness of its remaining context. For LINEAGE, this is actually a feature -- old-age citizens can organically sense their decline. For accident deaths, this awareness should be considered when testing (the citizen might "know" they have budget remaining right before being terminated).

**Deprecated/outdated:**
- `maxThinkingTokens`: Deprecated in favor of `thinking` config option. Use `thinking: { type: 'disabled' }` to prevent thinking tokens from consuming citizen context budget.

## Open Questions

1. **Cumulative vs incremental token tracking**
   - What we know: Each turn's BetaMessage.usage.input_tokens represents the full input context for that API call (all prior messages). output_tokens is the new generation.
   - What's unclear: Whether input_tokens in subsequent turns double-counts prior turns' content or represents net new tokens. For ContextBudget calculation, we need to determine if `latest_input_tokens` already represents total context consumed, or if we need to sum incrementally.
   - Recommendation: Use the latest turn's `input_tokens` as the current total context consumed (not cumulative sum). This is how the API works -- each request re-sends the full context. Add only `output_tokens` incrementally. Validate empirically in the first implementation.

2. **Thinking tokens and context budget**
   - What we know: Previous thinking blocks are auto-stripped from context in subsequent turns. Thinking tokens are billed as output tokens.
   - What's unclear: Whether thinking tokens should count towards the citizen's context budget (they consume API tokens but don't persist in context).
   - Recommendation: Disable extended thinking for citizen agents initially (`thinking: { type: 'disabled' }`). This simplifies context tracking and matches the hackathon scope. If thinking is desired later, exclude thinking tokens from ContextBudget calculations since they don't persist.

3. **Old age decline signal delivery mechanism**
   - What we know: The SDK supports streaming input via AsyncIterable for multi-turn conversations. The system prompt cannot be modified after query starts.
   - What's unclear: The exact UX of injecting decline signals. Should they be user-role messages? Should they use a specific format the citizen is told to watch for?
   - Recommendation: For v1, embed decline-awareness instructions in the initial system prompt (e.g., "When you see 'SYSTEM NOTICE: Your context is X% consumed', this represents your aging") and inject synthetic user messages at threshold crossings via streamInput(). This is the simplest approach that works within SDK constraints.

4. **Safety buffer calibration**
   - What we know: The SDK consumes overhead tokens for system prompts, tool definitions, and internal bookkeeping. The 15-20% figure is estimated.
   - What's unclear: Exact overhead in tokens. This varies by number of tools, system prompt length, and model.
   - Recommendation: Start with 20% safety buffer. Add logging to capture first-turn input_tokens (which reveals baseline overhead). Make the buffer configurable so it can be tuned after empirical observation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/mortality/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-01 | Citizen born with role, generation, hidden death profile | unit | `npx vitest run src/mortality/mortality.test.ts -t "birthCitizen"` | Wave 0 |
| LIFE-02 | Context consumption tracked as percentage | unit | `npx vitest run src/mortality/mortality.test.ts -t "ContextBudget"` | Wave 0 |
| LIFE-03 | Safety buffers account for SDK overhead | unit | `npx vitest run src/mortality/mortality.test.ts -t "safety buffer"` | Wave 0 |
| LIFE-04 | Old age death triggers gradually with decline time | unit | `npx vitest run src/mortality/mortality.test.ts -t "old-age"` | Wave 0 |
| LIFE-05 | Accident death triggers unpredictably, cuts mid-thought | unit | `npx vitest run src/mortality/mortality.test.ts -t "accident"` | Wave 0 |
| LIFE-06 | Death profiles assigned via weighted random from config | unit | `npx vitest run src/mortality/mortality.test.ts -t "assignDeathProfile"` | Wave 0 |
| LIFE-07 | Gen 1 protected from random death, toggleable | unit | `npx vitest run src/mortality/mortality.test.ts -t "gen1Protection"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/mortality/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/mortality/mortality.test.ts` -- covers LIFE-01 through LIFE-07
- [ ] `src/mortality/context-budget.ts` -- ContextBudget class
- [ ] `src/mortality/death-profiles.ts` -- death profile assignment and execution
- [ ] `src/mortality/citizen-lifecycle.ts` -- birth factory
- [ ] `src/mortality/index.ts` -- barrel export

*(Existing test infrastructure is fully functional -- 83 tests passing in 341ms. Vitest config, node environment, and ESM support all confirmed working.)*

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). Phase 3 is purely code/config changes using existing installed packages. All dependencies verified installed and working by existing test suite.

## Sources

### Primary (HIGH confidence)
- Claude Agent SDK v0.2.81 `sdk.d.ts` type definitions -- direct inspection of installed package. Verified: SDKAssistantMessage.message (BetaMessage with usage), SDKResultMessage (ModelUsage with contextWindow), Query.close(), Options.maxTurns.
- [Context windows - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows) -- Context window sizes, context awareness feature, compaction. Verified: Opus 4.6/Sonnet 4.6 = 1M tokens, built-in context awareness with token_budget signals.
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Full API reference for query(), Options, SDKMessage types, Query methods.
- Existing codebase inspection -- All Phase 2 schemas, events, config verified by reading source files and running test suite (83/83 passing).

### Secondary (MEDIUM confidence)
- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Verified pricing structure and context window sizes via web search.
- [What's new in Claude 4.6](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-6) -- Confirmed 1M context GA, adaptive thinking.

### Tertiary (LOW confidence)
- Token tracking precision (cumulative vs incremental) -- Based on understanding of API behavior. Needs empirical validation in implementation.
- SDK overhead percentage (15-20%) -- Estimated from STATE.md notes and general understanding. Needs calibration.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies. All packages verified installed and functional.
- Architecture: HIGH - ContextBudget pattern is straightforward. SDK provides all needed primitives (usage tracking, close(), maxTurns). Schemas already exist.
- Pitfalls: HIGH - Context tracking nuances well-documented in official docs. Cumulative token counting behavior is the main area needing empirical validation.
- Death profile execution: MEDIUM - Old-age decline signals via streamInput() is a reasonable approach but not yet tested. Accident death via close() is well-documented.

**Research date:** 2026-03-24
**Valid until:** 2026-04-23 (30 days -- SDK API is stable, context awareness is GA)
