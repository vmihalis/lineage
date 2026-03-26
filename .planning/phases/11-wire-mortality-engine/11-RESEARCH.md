# Phase 11: Wire Mortality Engine into Generation Runner - Research

**Researched:** 2026-03-25
**Domain:** Integration wiring -- connecting existing Phase 3 mortality primitives into Phase 9 generation orchestration
**Confidence:** HIGH

## Summary

Phase 11 is a pure integration phase. All the building blocks exist and are unit-tested: `ContextBudget` (tracks token consumption as aging), `createDeathThresholds()` (translates death profiles into threshold configs), `getDeclineSignal()` (produces decline narrative text), and `calculateAccidentPoint()` (random early termination point). The generation runner (`generation-runner.ts`) currently calls `runTurns()` without a `ContextBudget` and hardcodes `0.45` for the peak transmission prompt. The turn runner (`turn-runner.ts`) already accepts an optional `contextBudget` parameter and updates it after each turn -- this code path is tested but never activated at runtime.

The work is surgical: modify `generation-runner.ts` to (1) instantiate `ContextBudget` per citizen with death thresholds, (2) pass it to `runTurns()`, (3) use the actual budget percentage for `buildPeakTransmissionPrompt()`, (4) inject decline signals for old-age citizens, and (5) implement early termination for accident citizens. The architecture decision from Phase 9 -- "all citizens complete turns then all produce peak transmissions" -- must be revisited because accident death means a citizen may die mid-interaction without producing a peak transmission, and old-age death means decline signals need injection into the conversation context during turns, not after.

**Primary recommendation:** Refactor the generation runner's INTERACTING and DYING phases to run per-citizen mortality checks after each turn, inject decline signals between turns, and terminate accident citizens early. The current "all interact, then all die" flow must become "each citizen interacts with mortality enforcement, some die during interaction, survivors proceed to peak transmission."

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-02 | Context consumption tracked as percentage of max tokens (context-as-age proxy) | ContextBudget class exists, `turn-runner.ts` line 108-113 has the optional update path. Generation runner must instantiate and pass ContextBudget to runTurns. Budget percentage is tracked via `budget.percentage` getter. |
| LIFE-03 | ContextBudget abstraction with safety buffers accounting for SDK overhead (10-20% imprecision) | ContextBudget constructor accepts `safetyBuffer` (default 0.20), computing `effectiveCapacity = contextWindow * (1 - safetyBuffer)`. Already implemented and tested. Must be instantiated with correct `contextWindow` (model-dependent, e.g., 200000 for Claude) and thresholds from `createDeathThresholds()`. |
| LIFE-04 | Old age death profile -- context fills gradually, agent can observe decline, time for careful transmission | `createDeathThresholds('old-age')` produces 4 thresholds: peak-transmission (40%), decline-warning (75%), final-window (85%), old-age-death (95%). `getDeclineSignal()` produces narrative text for decline-warning, final-window, old-age-death labels. Generation runner must inject these signals into the citizen's conversation context when thresholds fire. |
| LIFE-05 | Accident death profile -- random termination at unpredictable point, no warning, mid-sentence cut | `createDeathThresholds('accident')` produces 1-2 thresholds: optional peak-transmission + accident-death at random 30-70% point. Generation runner must terminate the citizen's turn sequence when accident-death fires, preventing further turns and potentially cutting output mid-thought. |
</phase_requirements>

## Standard Stack

No new dependencies needed. This phase uses only existing project code:

### Core (Already Implemented)
| Module | File | Purpose | Status |
|--------|------|---------|--------|
| `ContextBudget` | `src/mortality/context-budget.ts` | Tracks token consumption as 0-1 percentage | Tested, 10 tests |
| `createDeathThresholds` | `src/mortality/death-execution.ts` | Creates thresholds from death profile | Tested, 10 tests |
| `getDeclineSignal` | `src/mortality/death-execution.ts` | Produces decline narrative text | Tested, 4 tests |
| `PEAK_TRANSMISSION_LABEL` | `src/mortality/death-execution.ts` | Constant `'peak-transmission'` for label matching | Exported |
| `ACCIDENT_DEATH_LABEL` | `src/mortality/death-execution.ts` | Constant `'accident-death'` for label matching | Exported |
| `runTurns` | `src/interaction/turn-runner.ts` | Sequential turn execution with optional ContextBudget | Tested, accepts `contextBudget?` |
| `runGeneration` | `src/generation/generation-runner.ts` | Generation lifecycle state machine | **Must be modified** |

## Architecture Patterns

### Current Architecture (Phase 9, simplified mortality)

```
runGeneration():
  BIRTHING  -> birth all citizens
  INTERACTING -> runTurns({seedProblem, citizens})  // no contextBudget
  DYING -> for each citizen:
              buildPeakTransmissionPrompt(citizen, 0.45)  // hardcoded
              executePeakTransmission(citizen, prompt)
              emit citizen:died
  TRANSMITTING -> mutate + write all transmissions
  COMPLETE
```

**Key simplification to remove:** Line 64 calls `runTurns()` without `contextBudget`, line 70 hardcodes `0.45` context percentage.

### Target Architecture (Phase 11, active mortality)

```
runGeneration():
  BIRTHING  -> birth all citizens
              -> create ContextBudget per citizen with death thresholds
  INTERACTING -> for each citizen turn:
                   execute turn
                   update citizen's ContextBudget with usage
                   check triggered thresholds
                   if decline threshold -> inject decline signal into next prompt
                   if accident-death threshold -> terminate citizen, emit citizen:died
                   if old-age-death threshold -> proceed to peak transmission
  DYING -> for each surviving citizen:
              buildPeakTransmissionPrompt(citizen, actualPercentage)
              executePeakTransmission(citizen, prompt)
              emit citizen:died
  TRANSMITTING -> mutate + write all transmissions
  COMPLETE
```

### Critical Design Decision: Per-Citizen vs. Shared ContextBudget

The current `runTurns()` accepts a single optional `ContextBudget`. However, each citizen needs their own budget because:
1. Each citizen has a different death profile (old-age vs accident)
2. Each citizen has different thresholds (accident point varies)
3. Citizens are sequential -- they share context window usage cumulatively

**Two approaches:**

**Approach A -- Shared budget, per-citizen thresholds (simpler):**
A single ContextBudget tracks the cumulative context usage across all citizens in the generation. Thresholds are checked per-citizen after their individual turn. This is how the current `runTurns()` works -- it accumulates usage across all citizens. The generation runner would need to track which citizen owns which thresholds and check after each turn.

**Approach B -- Per-citizen budget (more accurate but more complex):**
Each citizen gets their own ContextBudget. This requires changing `runTurns()` or moving turn execution out of `runTurns()` into the generation runner directly. More accurate to the "each citizen has their own lifespan" metaphor but requires deeper refactoring.

**Recommendation: Approach A (shared budget, per-citizen threshold checking).** The current `runTurns()` already supports a single ContextBudget parameter and updates it per turn. The generation runner can check thresholds after each turn by using the budget's percentage. This avoids refactoring `runTurns()` and preserves backward compatibility.

However, the current `runTurns()` runs ALL citizens to completion before returning. To support mid-interaction termination (accident death), we need to either:
1. Add a `shouldTerminate` callback to `TurnRunnerConfig` that `runTurns()` checks after each turn
2. Move the turn loop out of `runTurns()` into generation-runner and call `executeCitizenTurn()` directly

**Recommendation: Option 2 -- move the turn loop into generation-runner.** This gives the generation runner direct control over the turn sequence, making it straightforward to:
- Check thresholds after each turn
- Inject decline signals into the next citizen's prompt
- Terminate early for accidents
- Use actual context percentage for peak transmission

This means `runTurns()` becomes unused by generation-runner (but remains available for testing/standalone use). The generation runner imports `executeCitizenTurn` and `buildTurnPrompt` directly.

### Recommended Refactored generation-runner.ts Structure

```typescript
// INTERACTING phase -- mortality-aware turn loop
generation.phase = 'INTERACTING';
const budget = new ContextBudget({
  contextWindow: CONTEXT_WINDOW_SIZE,
  safetyBuffer: 0.20,
  thresholds: [], // Global thresholds not needed; check per-citizen below
});

const citizenThresholds = new Map<string, ContextThreshold[]>();
const citizenDeathStatus = new Map<string, 'alive' | 'dead'>();

for (const citizen of citizens) {
  const thresholds = createDeathThresholds(citizen.deathProfile, {
    peakTransmissionMin: params.peakTransmissionWindow.min,
  });
  citizenThresholds.set(citizen.id, thresholds);
  citizenDeathStatus.set(citizen.id, 'alive');
}

const turns: TurnOutput[] = [];
const collectedTransmissions: Transmission[] = [];
const declineSignals: string[] = []; // Accumulates for injection

for (let i = 0; i < citizens.length; i++) {
  const citizen = citizens[i];
  if (citizenDeathStatus.get(citizen.id) === 'dead') continue;

  // Build prompt with decline signals injected
  let prompt = buildTurnPrompt(enrichedSeedProblem, turns);
  if (declineSignals.length > 0) {
    prompt = declineSignals.join('\n\n') + '\n\n' + prompt;
    declineSignals.length = 0; // Clear after injection
  }

  const turnOutput = await executeCitizenTurn(citizen, prompt, i + 1);
  turns.push(turnOutput);

  // Update budget and check thresholds
  budget.update(turnOutput.usage.inputTokens, turnOutput.usage.outputTokens);
  const currentPct = budget.percentage;

  // Check this citizen's thresholds
  const thresholds = citizenThresholds.get(citizen.id)!;
  for (const threshold of thresholds) {
    if (currentPct >= threshold.percentage) {
      if (threshold.label === ACCIDENT_DEATH_LABEL) {
        // Accident: citizen dies immediately, no peak transmission
        citizenDeathStatus.set(citizen.id, 'dead');
        lineageBus.emit('citizen:died', citizen.id, 'accident', citizen.generationNumber);
      } else if (threshold.label === PEAK_TRANSMISSION_LABEL) {
        // Trigger peak transmission inline
        const peakPrompt = buildPeakTransmissionPrompt(citizen, currentPct);
        const { transmission } = await executePeakTransmission(citizen, peakPrompt);
        collectedTransmissions.push(transmission);
      } else {
        // Decline signal -- queue for next citizen's prompt
        const signal = getDeclineSignal(threshold.label, currentPct);
        if (signal) declineSignals.push(signal);
      }
    }
  }
}
```

**Note:** The above is illustrative. The actual threshold checking needs the ContextBudget's built-in deduplication (threshold labels are checked via Set). A cleaner approach is to pass per-citizen thresholds INTO the ContextBudget and use its `update()` return value.

### Revised Approach: Per-Citizen ContextBudget (Simpler After All)

On further analysis, the cleanest approach is actually **one ContextBudget per citizen**. Here's why:

1. `ContextBudget` already has built-in threshold deduplication (fires each label once)
2. Each citizen's death profile produces different thresholds
3. The token usage that matters for mortality is the generation's cumulative usage (the context window fills as more citizens contribute)
4. We can create per-citizen ContextBudgets that share the same `consumedTokens` starting point (each new budget starts where the previous citizen's ended)

**But wait** -- that doesn't work either, because ContextBudget tracks its own consumed tokens internally. The simplest correct approach:

**Final recommendation: Single ContextBudget with no thresholds + manual threshold checking per citizen.** Create one ContextBudget (no thresholds) to track cumulative context consumption. After each turn, manually check the current citizen's thresholds against `budget.percentage`. This uses ContextBudget purely as a percentage tracker and does threshold logic in the generation runner.

```typescript
const budget = new ContextBudget({
  contextWindow: CONTEXT_WINDOW_SIZE,
  safetyBuffer: 0.20,
  thresholds: [], // No automatic threshold firing
});

// Per-citizen: create thresholds and track which have fired
const citizenThresholdMap = new Map<string, {
  thresholds: ContextThreshold[];
  fired: Set<string>;
}>();
```

This avoids the "one budget per citizen" complexity while still using ContextBudget's percentage tracking.

### Context Window Size

The generation runner needs to know the model's context window size to instantiate ContextBudget. This is currently not in `SimulationParameters`.

**Options:**
1. Add `contextWindow` to SimulationParameters schema (configurable)
2. Hardcode a reasonable default (200,000 for Claude Sonnet 4)
3. Use the model string from CitizenConfig to look up window size

**Recommendation: Add `contextWindow` to SimulationParameters with a default.** This makes it configurable and testable. Default to 200,000 (Claude Sonnet 4's window). This is a schema change to `src/schemas/simulation.ts`.

### Anti-Patterns to Avoid

- **Do not refactor runTurns() to be mortality-aware.** Keep it as a clean sequential executor. Move mortality orchestration into the generation runner where it belongs.
- **Do not use per-citizen ContextBudgets that independently track tokens.** A single budget tracking cumulative generation context consumption is correct -- citizens share the same conversation context window.
- **Do not inject decline signals as system prompts.** They should be part of the user message (conversation context), not the system prompt. The system prompt is fixed per citizen at birth.
- **Do not block accident citizens from having any output.** An accident citizen should contribute normally until their threshold is reached, then be terminated. Their partial contributions remain in the turn history.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token tracking as percentage | Custom percentage math | `ContextBudget` class | Already handles safety buffer, clamping, remaining token calculation |
| Threshold deduplication | Manual fired-threshold tracking | ContextBudget's internal Set **or** manual `Set<string>` per citizen | ContextBudget already deduplicates, but since we're using manual checking, a simple Set works |
| Decline narrative text | Inline string templates | `getDeclineSignal(label, percentage)` | Already tested, produces consistent SYSTEM NOTICE format |
| Death threshold creation | Manual threshold arrays | `createDeathThresholds(deathProfile, options)` | Handles old-age vs accident logic, accident point randomization |
| Anchor token parsing | Regex in generation runner | `extractAnchorTokens()` (already used by transmission executor) | Roundtrips with `[N]` format |

## Common Pitfalls

### Pitfall 1: Accident Citizens Never Getting Peak Transmission
**What goes wrong:** If accident threshold fires during INTERACTING and citizen is immediately terminated, they produce no peak transmission at all.
**Why it happens:** Accident point can be below peak transmission min (0.3 < 0.4). In that case, `createAccidentThresholds()` already excludes the peak-transmission threshold.
**How to avoid:** When accident-death fires WITHOUT a prior peak-transmission threshold, the citizen dies without transmitting. This is correct and intentional -- accident death is "mid-sentence cut." Do NOT try to give accident citizens a transmission after death.
**Warning signs:** Test that verifies accident citizens always have transmissions -- they should NOT.

### Pitfall 2: Decline Signals Injected to Wrong Citizen
**What goes wrong:** Decline signal for citizen N gets injected into citizen N+1's prompt because the generation runner processes citizens sequentially.
**Why it happens:** Decline signals are about a specific citizen's aging experience. If citizen 3 is old-age and crosses 75%, the decline signal should appear in citizen 3's NEXT interaction, not citizen 4's.
**How to avoid:** In v1's turn-based architecture, each citizen gets ONE turn. Decline signals fire AFTER the turn. Since there's no "next turn" for the same citizen within a single generation, decline signals should be injected into the peak transmission prompt for that citizen, not into the next citizen's prompt. This changes the design: decline signals accumulate per-citizen and get prepended to their peak prompt.
**Warning signs:** Decline narrative appearing in a different citizen's output.

### Pitfall 3: Context Window Size Assumption
**What goes wrong:** Hardcoding 200,000 tokens but the model actually has 128K or different context window.
**Why it happens:** Different Claude models have different context windows.
**How to avoid:** Make contextWindow a configurable SimulationParameters field with a sensible default. Document the assumption.
**Warning signs:** Citizens dying too early or too late relative to expectations.

### Pitfall 4: Breaking Existing Test Suite
**What goes wrong:** The 346 existing tests rely on the current `runGeneration()` signature and behavior. Modifying it breaks generation.test.ts.
**Why it happens:** generation.test.ts mocks all subsystems and verifies specific call patterns.
**How to avoid:** Update generation.test.ts mocks to include mortality module imports. Ensure the test factory functions (`setupDefaultMocks`) provide mortality-compatible mock data. Run full test suite after each change.
**Warning signs:** Any of the 346 tests failing.

### Pitfall 5: Token Usage Precision
**What goes wrong:** Agent SDK's `usage.input_tokens` and `usage.output_tokens` may not perfectly reflect the actual context consumption.
**Why it happens:** SDK overhead (tool definitions, system prompt tokens) contribute to context usage but aren't reported in per-message usage. The 20% safety buffer in ContextBudget accounts for this imprecision.
**How to avoid:** Keep the 20% safety buffer. Don't try to be precise -- the metaphor (context IS aging) matters more than exact percentage accuracy.
**Warning signs:** Citizens dying before producing any meaningful output (safety buffer too small) or never hitting thresholds (safety buffer too large).

### Pitfall 6: Shared Budget Threshold Checking Is Not Automatic
**What goes wrong:** Using ContextBudget's `update()` return value for threshold triggering when the budget has no thresholds configured (empty array).
**Why it happens:** With the "single budget, manual threshold checking" approach, `budget.update()` returns `[]` every time because there are no thresholds. Threshold checking must be done manually by comparing `budget.percentage` against each citizen's threshold list.
**How to avoid:** Be explicit: ContextBudget is used ONLY for percentage tracking. Threshold logic is handled by the generation runner with per-citizen threshold lists and fired-label Sets.
**Warning signs:** Thresholds never firing despite context filling up.

## Code Examples

### Example 1: Creating ContextBudget with Death Thresholds (Manual Checking Pattern)

```typescript
// Source: src/mortality/context-budget.ts, src/mortality/death-execution.ts
import { ContextBudget } from '../mortality/index.js';
import { createDeathThresholds, getDeclineSignal, PEAK_TRANSMISSION_LABEL, ACCIDENT_DEATH_LABEL } from '../mortality/index.js';

// Single budget for the generation -- tracks cumulative context consumption
const budget = new ContextBudget({
  contextWindow: params.contextWindow ?? 200_000,
  safetyBuffer: 0.20,
  thresholds: [], // No auto-triggering; we check manually
});

// Per-citizen threshold tracking
const citizenMortality = citizens.map(citizen => ({
  citizen,
  thresholds: createDeathThresholds(citizen.deathProfile, {
    peakTransmissionMin: params.peakTransmissionWindow.min,
  }),
  firedLabels: new Set<string>(),
  isDead: false,
  peakTransmissionCollected: false,
}));
```

### Example 2: Post-Turn Threshold Checking

```typescript
// After executeCitizenTurn returns:
budget.update(turnOutput.usage.inputTokens, turnOutput.usage.outputTokens);
const currentPct = budget.percentage;

const mortality = citizenMortality[i];
for (const threshold of mortality.thresholds) {
  if (currentPct >= threshold.percentage && !mortality.firedLabels.has(threshold.label)) {
    mortality.firedLabels.add(threshold.label);

    if (threshold.label === ACCIDENT_DEATH_LABEL) {
      mortality.isDead = true;
      lineageBus.emit('citizen:died', citizen.id, 'accident', citizen.generationNumber);
      // No peak transmission -- accident death is abrupt
    } else if (threshold.label === PEAK_TRANSMISSION_LABEL) {
      // Collect peak transmission immediately
      const peakPrompt = buildPeakTransmissionPrompt(citizen, currentPct);
      const { transmission } = await executePeakTransmission(citizen, peakPrompt);
      collectedTransmissions.push(transmission);
      mortality.peakTransmissionCollected = true;
    } else {
      // Decline signal -- injected into this citizen's peak prompt later
      const signal = getDeclineSignal(threshold.label, currentPct);
      if (signal) mortality.declineSignals.push(signal);
    }
  }
}
```

### Example 3: Decline Signal Injection into Peak Prompt

```typescript
// In DYING phase, for old-age citizens who haven't yet done peak transmission:
for (const mortality of citizenMortality) {
  if (mortality.isDead || mortality.peakTransmissionCollected) continue;

  const currentPct = budget.percentage;
  let peakPrompt = buildPeakTransmissionPrompt(mortality.citizen, currentPct);

  // Prepend any accumulated decline signals
  if (mortality.declineSignals.length > 0) {
    peakPrompt = mortality.declineSignals.join('\n\n') + '\n\n' + peakPrompt;
  }

  const { transmission } = await executePeakTransmission(mortality.citizen, peakPrompt);
  collectedTransmissions.push(transmission);
  lineageBus.emit('citizen:died', mortality.citizen.id, mortality.citizen.deathProfile, mortality.citizen.generationNumber);
}
```

### Example 4: Schema Addition for contextWindow

```typescript
// In src/schemas/simulation.ts -- add contextWindow field
export const SimulationParametersSchema = z.object({
  // ... existing fields ...
  contextWindow: z.number().int().positive().default(200_000),
});
```

## State of the Art

| Old Approach (Phase 9) | New Approach (Phase 11) | Impact |
|------------------------|-------------------------|--------|
| All citizens complete all turns, then all die | Per-citizen mortality enforcement during turns | Accident citizens die mid-interaction |
| Hardcoded `0.45` context percentage | Actual `budget.percentage` from ContextBudget | Config-driven peak transmission timing |
| No decline signals | `getDeclineSignal()` injected into peak prompts | Old-age citizens experience narrative aging |
| Death profile is cosmetic label | Death profile determines lifespan behavior | Core thesis ("mortality changes thinking") activated |
| `runTurns()` called as black box | `executeCitizenTurn()` called per-citizen with mortality checks | Generation runner has full control over turn lifecycle |

## Open Questions

1. **Context window size for different models**
   - What we know: Claude Sonnet 4 has 200K context window. CitizenConfig has a `model` field (defaults from AgentConfig).
   - What's unclear: Whether different citizens might use different models with different context windows.
   - Recommendation: Add `contextWindow` to SimulationParameters with default 200,000. Single value for the whole generation. Per-citizen window sizes are v2 complexity.

2. **Decline signal injection point**
   - What we know: Each citizen gets one turn in v1. Decline signals fire after the turn based on accumulated usage.
   - What's unclear: Since a citizen can't receive a decline signal and then respond to it within the same generation (they only get one turn), should decline signals go into the peak transmission prompt instead?
   - Recommendation: Yes. Decline signals are accumulated per-citizen and prepended to their peak transmission prompt. This way old-age citizens experience "I'm dying" awareness when creating their legacy, not during their turn contribution. This matches the poetic intent: "the knowledge of ending" changes what they transmit.

3. **Accident citizens and the turn sequence**
   - What we know: In v1, citizens execute one turn each sequentially. Accident death should "cut mid-thought."
   - What's unclear: Should an accident citizen's turn output be truncated, or should they complete their turn and then be prevented from transmitting?
   - Recommendation: Let the citizen complete their turn (the Agent SDK query runs to completion). The "mid-thought cut" manifests as: their turn output exists in the handoff but they produce no peak transmission. Their death is "sudden" because they had no warning and no chance to transmit. Truncating output would require canceling an in-progress query, which adds complexity with no v1 value.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-02 | ContextBudget instantiated per generation and updated with turn usage | integration | `npx vitest run src/generation/generation.test.ts -t "context budget"` | Partial -- generation.test.ts exists, needs new tests |
| LIFE-03 | ContextBudget created with safety buffer and correct contextWindow | unit | `npx vitest run src/generation/generation.test.ts -t "safety buffer"` | Wave 0 |
| LIFE-04 | Old-age citizens receive decline signals in peak transmission prompt | integration | `npx vitest run src/generation/generation.test.ts -t "decline signal"` | Wave 0 |
| LIFE-05 | Accident citizens terminated early, no peak transmission | integration | `npx vitest run src/generation/generation.test.ts -t "accident"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (346+ tests) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `src/generation/generation.test.ts` for LIFE-02 (budget instantiation and update)
- [ ] New test cases in `src/generation/generation.test.ts` for LIFE-03 (safety buffer configuration)
- [ ] New test cases in `src/generation/generation.test.ts` for LIFE-04 (decline signal injection)
- [ ] New test cases in `src/generation/generation.test.ts` for LIFE-05 (accident termination, no transmission)
- [ ] Mock additions for mortality module imports in generation.test.ts

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). This phase is purely internal code refactoring with no new external tools, services, or dependencies.

## Sources

### Primary (HIGH confidence)
- `src/mortality/context-budget.ts` -- ContextBudget class API, constructor config, update/percentage/reset methods
- `src/mortality/death-execution.ts` -- createDeathThresholds, getDeclineSignal, threshold labels/constants
- `src/mortality/death-profiles.ts` -- assignDeathProfile, calculateAccidentPoint (0.3-0.7 range)
- `src/generation/generation-runner.ts` -- current runGeneration flow, line 64 (no contextBudget), line 70 (hardcoded 0.45)
- `src/interaction/turn-runner.ts` -- runTurns accepting optional contextBudget (line 108-113), executeCitizenTurn
- `src/generation/generation.test.ts` -- existing mock patterns, test factories
- `src/mortality/mortality.test.ts` -- existing mortality tests (threshold, decline signal, budget)
- `src/schemas/simulation.ts` -- SimulationParameters schema, peakTransmissionWindow config
- `.planning/v1.0-MILESTONE-AUDIT.md` -- integration gap documentation, evidence of unwired mortality

### Secondary (MEDIUM confidence)
- STATE.md decisions -- Phase 9 decision "simplified mortality: all citizens complete turns then all produce peak transmissions"
- STATE.md decisions -- "Fixed 0.45 contextPercentage for peak prompt (midpoint of default window) since full ContextBudget not wired in v1"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code exists in the repo, directly inspected every file
- Architecture: HIGH - Integration pattern is clear from existing code structure; design decisions are justified by existing API contracts
- Pitfalls: HIGH - Pitfalls derived from direct code reading and understanding the threshold checking mechanics

**Research date:** 2026-03-25
**Valid until:** Indefinite (internal codebase research, no external API dependencies)
