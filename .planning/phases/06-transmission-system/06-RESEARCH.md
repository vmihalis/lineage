# Phase 6: Transmission System - Research

**Researched:** 2026-03-24
**Domain:** Agent-driven structured content generation, file persistence, threshold-triggered prompting
**Confidence:** HIGH

## Summary

The transmission system is the bridge between mortality and cultural survival in LINEAGE. When a citizen reaches 40-50% context consumption, the orchestrator must intercept the normal turn flow, inject a special "peak transmission" prompt that instructs the citizen to distill their best thinking into a structured format with numbered anchor tokens, then persist the resulting transmission to disk as a JSON file with full metadata. This phase builds on three existing subsystems: the ContextBudget threshold mechanism (which already fires a `peak-transmission` label at the configured percentage), the TransmissionSchema (already defined in Phase 2 with all required fields), and the Agent SDK `query()` call pattern (proven in Phase 5's TurnRunner).

The core implementation involves three new modules: (1) a peak transmission prompt builder that creates the structured output instruction, (2) a transmission executor that calls `query()` with the peak prompt and parses the response into the `Transmission` schema, and (3) a transmission writer that persists the validated `Transmission` object to disk using the `LineageStateManager` atomic write pattern. The `citizen:peak-transmission` event (already typed in the event bus) must be emitted after successful persistence.

**Primary recommendation:** Build the transmission system as a `src/transmission/` module with three files: `peak-prompt.ts` (prompt construction), `transmission-executor.ts` (SDK call + schema parsing), and `transmission-writer.ts` (disk persistence + event emission). Keep them as pure functions where possible, following the Phase 5 pattern of stateless function design with explicit parameters.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAN-01 | Peak transmission triggered at 40-50% context -- agent prompted to distill best thinking | ContextBudget already fires `peak-transmission` threshold at configurable `peakTransmissionWindow.min` (default 0.4). The transmission executor must respond to this threshold by calling `query()` with a specialized peak prompt. The prompt must instruct the citizen to produce structured output. |
| TRAN-02 | Peak transmission uses structured output format with anchor tokens (anti-telephone-effect) | The peak prompt must explicitly instruct the agent to produce numbered claims (e.g., `[1]`, `[2]`, `[3]`) rather than prose paragraphs. The `TransmissionSchema.anchorTokens` field (already defined as `z.array(z.string())`) stores extracted tokens. A parser function extracts `[N]` tokens from the raw response text. |
| TRAN-03 | Transmission persisted to disk with metadata (citizenId, generation, role, type, timestamp) | Use `LineageStateManager.write()` with `TransmissionSchema` validation. Files written to `{outputDir}/transmissions/gen{N}/{citizenId}-peak.json`. All metadata fields already exist in `TransmissionSchema`. Emit `citizen:peak-transmission` event after successful write. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 | Validate Transmission objects before persistence | Already installed. TransmissionSchema already defined in `src/schemas/transmission.ts`. |
| nanoid | 5.1.7 | Generate unique transmission IDs | Already installed. Used for citizen IDs, same pattern applies. |
| @anthropic-ai/claude-agent-sdk | ^0.2.81 | Execute peak transmission agent call | Already installed. `query()` pattern proven in Phase 5 TurnRunner. |
| EventEmitter3 | 5.0.4 | Emit `citizen:peak-transmission` event | Already installed. `lineageBus` singleton. Event type already defined. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `node:fs/promises` | Built-in (v24.7.0) | Directory creation for output paths | Used via `LineageStateManager` which wraps `@genesis/shared` StateManager with atomic writes. |
| Node.js `node:path` | Built-in (v24.7.0) | Path construction for transmission file paths | Join `outputDir` + `transmissions/` + `gen{N}/` + filename. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON files on disk | SQLite | SQLite adds a dependency and complexity. JSON files match the Genesis StateManager pattern and are human-readable. For a hackathon, JSON files are correct. |
| Numbered anchor tokens `[1]` | JSON structured output from SDK | The Agent SDK doesn't enforce structured output format natively. Prompt-based formatting with post-hoc parsing is simpler and more flexible. The agent can naturally produce `[1] Claim text` format without tool use. |
| Manual `writeFile` | LineageStateManager | StateManager provides atomic writes (write-to-temp-then-rename) and Zod validation before write. Already proven in the codebase. Use it. |

## Architecture Patterns

### Recommended Project Structure
```
src/
  transmission/
    peak-prompt.ts         # Pure function: builds the peak transmission prompt
    transmission-executor.ts  # Calls query() with peak prompt, returns Transmission
    transmission-writer.ts    # Persists Transmission to disk, emits event
    anchor-parser.ts          # Extracts [N] anchor tokens from raw text
    index.ts                  # Barrel exports
    transmission.test.ts      # All tests for this module
```

### Pattern 1: Threshold-to-Prompt Pipeline
**What:** When ContextBudget.update() returns a threshold with label `peak-transmission`, the orchestrator calls the transmission executor with the citizen's current context and receives a validated `Transmission` object.
**When to use:** Every time a citizen crosses the peak transmission threshold (40-50% context).
**Example:**
```typescript
// In future orchestrator code (not this phase), the threshold callback triggers:
const thresholds = contextBudget.update(inputTokens, outputTokens);
const peakThreshold = thresholds.find(t => t.label === 'peak-transmission');
if (peakThreshold) {
  const transmission = await executePeakTransmission(citizen, turnOutputs, params);
  await writeTransmission(transmission, params.outputDir);
}
```

### Pattern 2: Structured Prompt for Anchor Tokens (TRAN-02)
**What:** The peak prompt explicitly instructs the agent to number its claims using `[1]`, `[2]`, `[3]` etc. A post-hoc parser extracts these as anchor tokens. This is the anti-telephone-effect mechanism -- numbered claims survive mutation better than flowing prose because each claim is an atomic unit.
**When to use:** Always for peak transmissions.
**Example:**
```typescript
// Peak prompt template (injected as user message to query())
const peakPrompt = `
PEAK TRANSMISSION -- Your context is ${percentage}% consumed. This is your moment of peak clarity.

Distill your most important thinking into a structured transmission. Use numbered claims:

[1] Your first key insight or claim
[2] Your second key insight or claim
[3] Continue numbering each distinct idea

Rules:
- Each numbered claim must stand alone (readable without the others)
- Be specific and concrete, not abstract
- ${claimsGuidance}
- This transmission will be all that survives you. Make it count.
`;
```

### Pattern 3: Stateless Function Design (inherited from Phase 5)
**What:** All functions take explicit parameters and return values. No shared mutable state. Side effects (disk writes, event emission) are isolated to the writer function.
**When to use:** All transmission module functions.
**Example:**
```typescript
// Pure function -- no side effects
export function buildPeakTransmissionPrompt(
  citizen: CitizenConfig,
  previousTurns: TurnOutput[],
  contextPercentage: number,
): string { ... }

// Pure function -- extracts tokens from text
export function extractAnchorTokens(text: string): string[] { ... }

// Side effects isolated here
export async function writeTransmission(
  transmission: Transmission,
  outputDir: string,
  stateManager: LineageStateManager,
): Promise<void> { ... }
```

### Anti-Patterns to Avoid
- **Raw prose transmissions without structure:** The whole point of anchor tokens is that numbered claims survive mutation better than paragraphs. The prompt MUST enforce the `[N]` format.
- **Calling query() from inside ContextBudget:** The threshold mechanism is a notification system, not an executor. The orchestrator layer (Phase 9) will wire threshold events to transmission calls. This phase builds the transmission functions, not the wiring.
- **Modifying the existing TransmissionSchema:** The schema from Phase 2 already has all required fields (`id`, `citizenId`, `generationNumber`, `role`, `type`, `content`, `anchorTokens`, `timestamp`, `mutated`, `mutationType`). Do NOT change it.
- **Writing transmissions as plain text files:** Always use JSON with schema validation. Plain text files lose metadata and can't be loaded back with type safety.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom temp-file-then-rename logic | `LineageStateManager.write()` | Already wraps `@genesis/shared` StateManager with atomic writes. Handles directory creation, temp files, rename, and cleanup on failure. |
| ID generation | `Math.random().toString(36)` | `nanoid()` | Collision-resistant, URL-safe, consistent with existing citizen ID generation. |
| Schema validation | Manual property checking | `TransmissionSchema.parse()` | Zod schema already defined with all required fields and correct types. |
| Agent SDK calls | Manual HTTP to Anthropic API | `query()` from `@anthropic-ai/claude-agent-sdk` | SDK handles auth, streaming, usage tracking. Pattern proven in Phase 5. |

**Key insight:** Every infrastructure component needed for this phase already exists in the codebase. The transmission system is a composition of existing patterns (SDK call, schema validation, atomic write, event emission), not new infrastructure.

## Common Pitfalls

### Pitfall 1: Anchor Token Extraction Fragility
**What goes wrong:** The regex for extracting `[N]` tokens from agent output breaks on edge cases like `[10]` (double digits), `[N]` appearing in quoted text, or the agent not following the format.
**Why it happens:** LLM output is inherently unpredictable. Even with explicit prompting, the agent may produce variations like `1.`, `(1)`, or no numbering at all.
**How to avoid:** Use a robust regex like `/\[(\d+)\]\s*(.+?)(?=\n\[|\n*$)/gs` that handles multi-digit numbers and captures the full claim text. If no anchor tokens are found, fall back to treating the entire response as a single anchor token `[1]` -- never produce an empty `anchorTokens` array for a successful transmission.
**Warning signs:** Empty `anchorTokens` array in test output, or tokens containing only numbers without claim text.

### Pitfall 2: Context Budget Double-Counting
**What goes wrong:** The peak transmission agent call consumes tokens, which should NOT be double-counted against the citizen's context budget. The citizen's main turn execution and the peak transmission call are separate queries.
**Why it happens:** The ContextBudget tracks cumulative token consumption. If the peak transmission call's tokens are added to the same budget, the citizen may instantly trigger decline thresholds or death.
**How to avoid:** The peak transmission is a separate `query()` call. The orchestrator (Phase 9) decides whether to count its tokens. For this phase, the transmission executor should return token usage in its result so the caller can decide. Do not automatically update any ContextBudget inside the transmission module.
**Warning signs:** Citizens dying immediately after peak transmission, or decline warnings firing during transmission.

### Pitfall 3: File Path Collision
**What goes wrong:** Two citizens with the same ID (impossible with nanoid, but defensive coding) or two transmissions from the same citizen overwrite each other.
**Why it happens:** Using only citizenId in the filename without the transmission type or a unique suffix.
**How to avoid:** Use the pattern `{outputDir}/transmissions/gen{N}/{citizenId}-{type}.json` where `type` is `peak`. Each citizen gets at most one peak transmission (by definition -- it fires once at the threshold). The transmission ID (nanoid) should also be in the filename or the content.
**Warning signs:** Missing transmission files after a run with multiple citizens.

### Pitfall 4: StateManager vs. Direct File Access
**What goes wrong:** Using `writeFile` directly instead of `LineageStateManager.write()`, bypassing Zod validation and atomic write guarantees.
**Why it happens:** Desire for simplicity or forgetting the StateManager exists.
**How to avoid:** Always use `LineageStateManager.write()` for persistence. It validates with the schema before writing, uses atomic writes (temp file + rename), and the wrapper emits `state:saved` events.
**Warning signs:** Corrupted JSON files, missing validation errors, no `state:saved` events in the event log.

### Pitfall 5: Prompt Too Large for Agent Context
**What goes wrong:** The peak transmission prompt includes all previous turn outputs (which could be thousands of tokens), leaving the agent insufficient room to produce a quality transmission.
**Why it happens:** Reusing the full `buildTurnPrompt()` from the interaction module as part of the peak prompt.
**How to avoid:** The peak prompt should be focused and compact. Include only the citizen's own role context and a summary of what they've been working on, not the full turn history. The citizen has already processed the turn history during their regular turn -- the peak prompt should trigger distillation of what they've already been thinking.
**Warning signs:** Truncated or shallow transmissions, agent errors from context overflow.

## Code Examples

Verified patterns from the existing codebase:

### Anchor Token Extraction
```typescript
/**
 * Extract numbered anchor tokens from transmission text.
 * Matches patterns like: [1] Claim text here
 * Returns array of claim texts (without the [N] prefix).
 * Falls back to entire text as single token if no anchors found.
 */
export function extractAnchorTokens(text: string): string[] {
  const regex = /\[(\d+)\]\s*(.+?)(?=\n\[\d+\]|\n*$)/gs;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const claimText = match[2]!.trim();
    if (claimText.length > 0) {
      tokens.push(claimText);
    }
  }

  // Fallback: if agent didn't use [N] format, treat entire text as one token
  if (tokens.length === 0 && text.trim().length > 0) {
    tokens.push(text.trim());
  }

  return tokens;
}
```

### Peak Transmission Prompt Builder
```typescript
import type { CitizenConfig } from '../schemas/index.js';
import type { TurnOutput } from '../interaction/index.js';

/**
 * Build the peak transmission prompt injected when a citizen
 * crosses the peak-transmission threshold (40-50% context).
 */
export function buildPeakTransmissionPrompt(
  citizen: CitizenConfig,
  contextPercentage: number,
): string {
  const pct = Math.round(contextPercentage * 100);
  return `PEAK TRANSMISSION MOMENT

Your context is ${pct}% consumed. You have reached your moment of peak clarity -- the point where you have enough experience to see patterns but enough capacity left to articulate them.

This is your one chance to transmit what matters most. Future generations will inherit your transmission. It is all that will survive your death.

INSTRUCTIONS:
- Distill your most important thinking into numbered claims
- Use the format: [1] Your first key insight
- Each claim must stand alone -- it must be understandable without the others
- Be concrete and specific, not abstract
- Number every distinct insight or claim
- Aim for 3-7 claims -- enough to be useful, few enough to be memorable

What you transmit now is your legacy. Make it count.`;
}
```

### Transmission Execution (Agent SDK call)
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { nanoid } from 'nanoid';
import type { CitizenConfig, Transmission } from '../schemas/index.js';
import { TransmissionSchema } from '../schemas/index.js';
import { extractAnchorTokens } from './anchor-parser.js';

export interface TransmissionResult {
  transmission: Transmission;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Execute a peak transmission agent call and return a validated Transmission.
 */
export async function executePeakTransmission(
  citizen: CitizenConfig,
  peakPrompt: string,
): Promise<TransmissionResult> {
  const gen = query({
    prompt: peakPrompt,
    options: {
      systemPrompt: citizen.systemPrompt,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      model: citizen.model,
      persistSession: false,
    },
  });

  let resultText = '';
  let usage = { inputTokens: 0, outputTokens: 0 };

  for await (const msg of gen) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        resultText = msg.result;
      } else {
        resultText = `[Transmission error: ${msg.subtype}]`;
      }
      usage = {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      };
    }
  }

  if (!resultText) {
    resultText = '[No transmission received]';
  }

  const anchorTokens = extractAnchorTokens(resultText);

  const transmission = TransmissionSchema.parse({
    id: nanoid(),
    citizenId: citizen.id,
    generationNumber: citizen.generationNumber,
    role: citizen.role,
    type: 'peak' as const,
    content: resultText,
    anchorTokens,
    timestamp: new Date().toISOString(),
    mutated: false,
  });

  return { transmission, usage };
}
```

### Transmission Persistence
```typescript
import { join } from 'node:path';
import type { Transmission } from '../schemas/index.js';
import { TransmissionSchema } from '../schemas/index.js';
import { LineageStateManager } from '../state/index.js';
import { lineageBus } from '../events/index.js';

/**
 * Write a validated Transmission to disk and emit the citizen:peak-transmission event.
 *
 * File path: {outputDir}/transmissions/gen{N}/{citizenId}-{type}.json
 */
export async function writeTransmission(
  transmission: Transmission,
  outputDir: string,
): Promise<string> {
  const stateManager = new LineageStateManager(outputDir);
  const filePath = join(
    outputDir,
    'transmissions',
    `gen${transmission.generationNumber}`,
    `${transmission.citizenId}-${transmission.type}.json`,
  );

  await stateManager.write(filePath, transmission, TransmissionSchema, 'transmission');
  lineageBus.emit('citizen:peak-transmission', transmission.citizenId, transmission.id);
  return filePath;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw prose transmissions | Numbered anchor tokens `[1]`, `[2]`, `[3]` | Design decision (LINEAGE v1) | Anti-telephone effect -- discrete claims survive mutation better than flowing prose |
| In-memory transmission storage | JSON files on disk via atomic writes | Genesis pattern (existing) | Transmissions survive process crashes, available for post-run analysis |
| Agent SDK tool-based structured output | Prompt-based formatting with post-hoc parsing | LINEAGE design decision | Simpler than defining MCP tools for structured output; the agent naturally produces numbered lists |

## Open Questions

1. **Should the peak transmission call share the citizen's system prompt?**
   - What we know: The existing `executeCitizenTurn` passes `citizen.systemPrompt` to `query()`. The system prompt includes the role identity and mortality awareness.
   - What's unclear: Should the peak transmission call use the same system prompt (maintaining role consistency) or a specialized transmission system prompt?
   - Recommendation: Use the same system prompt. The citizen's role identity should influence what they choose to transmit (a Builder transmits solutions, a Skeptic transmits validated doubts, an Archivist transmits curated records). The peak prompt goes as the user message, not a system prompt override.

2. **How to handle accident citizens who die before peak transmission?**
   - What we know: Accident death points are in [0.3, 0.7]. The peak transmission window starts at 0.4. If the accident point is below 0.4, `createDeathThresholds()` already excludes the `peak-transmission` threshold (see `death-execution.ts` line 76).
   - What's unclear: Should these citizens produce any transmission at all?
   - Recommendation: For v1, no transmission from accident citizens who die before the window. This is already handled by the threshold exclusion logic. V2 has `TRAN-V2-02` (accident artifact -- raw context dump) which covers this case.

3. **Should the StateManager instance be created per-write or shared?**
   - What we know: `LineageStateManager` wraps `@genesis/shared` StateManager which takes a `baseDir` in the constructor.
   - What's unclear: Whether creating a new instance per write has meaningful overhead.
   - Recommendation: Accept a `LineageStateManager` instance as a parameter to `writeTransmission()` so the caller can share it. This avoids coupling the transmission module to a specific StateManager lifecycle and makes testing easier (inject a mock).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run src/transmission/transmission.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRAN-01 | Peak transmission prompt fires at 40-50% context and produces distilled output | unit | `npx vitest run src/transmission/transmission.test.ts -t "executePeakTransmission"` | Wave 0 |
| TRAN-01 | Peak prompt includes context percentage and distillation instructions | unit | `npx vitest run src/transmission/transmission.test.ts -t "buildPeakTransmissionPrompt"` | Wave 0 |
| TRAN-02 | Structured output with anchor tokens extracted from `[N]` format | unit | `npx vitest run src/transmission/transmission.test.ts -t "extractAnchorTokens"` | Wave 0 |
| TRAN-02 | Fallback to single token when agent doesn't use `[N]` format | unit | `npx vitest run src/transmission/transmission.test.ts -t "fallback"` | Wave 0 |
| TRAN-03 | Transmission persisted to disk as JSON with all metadata fields | unit | `npx vitest run src/transmission/transmission.test.ts -t "writeTransmission"` | Wave 0 |
| TRAN-03 | `citizen:peak-transmission` event emitted after write | unit | `npx vitest run src/transmission/transmission.test.ts -t "event"` | Wave 0 |
| TRAN-03 | File path follows `{outputDir}/transmissions/gen{N}/{citizenId}-{type}.json` | unit | `npx vitest run src/transmission/transmission.test.ts -t "file path"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/transmission/transmission.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/transmission/transmission.test.ts` -- covers TRAN-01, TRAN-02, TRAN-03
- [ ] Agent SDK mock pattern -- reuse `createMockQueryGenerator` helper from `interaction.test.ts`

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
- Do NOT modify existing schemas -- `TransmissionSchema` is already correct
- Use `nanoid` for ID generation (not `crypto.randomUUID()`)

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `src/schemas/transmission.ts` -- TransmissionSchema definition with all required fields
- Direct codebase inspection of `src/mortality/death-execution.ts` -- PEAK_TRANSMISSION_LABEL, createDeathThresholds, peak threshold logic
- Direct codebase inspection of `src/mortality/context-budget.ts` -- ContextBudget.update() threshold triggering mechanism
- Direct codebase inspection of `src/interaction/turn-runner.ts` -- Agent SDK query() call pattern, async generator consumption
- Direct codebase inspection of `src/state/manager.ts` -- LineageStateManager.write() with schema validation
- Direct codebase inspection of `src/events/types.ts` -- `citizen:peak-transmission` event signature
- Direct codebase inspection of `@genesis/shared/src/state/manager.ts` -- atomicWrite pattern (temp file + rename)

### Secondary (MEDIUM confidence)
- Phase 5 test patterns (`interaction.test.ts`) -- Agent SDK mocking with `createMockQueryGenerator`
- Existing project decisions from `.planning/STATE.md` -- stateless function design, pure function patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified in codebase
- Architecture: HIGH - Follows established patterns from Phase 3 (mortality) and Phase 5 (interaction)
- Pitfalls: HIGH - Based on direct analysis of the threshold triggering mechanism and Agent SDK call patterns
- Code examples: MEDIUM - Based on verified patterns but the exact API surface will be confirmed during implementation

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no external dependency changes expected)
