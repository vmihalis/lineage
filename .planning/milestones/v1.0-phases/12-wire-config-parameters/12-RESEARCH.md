# Phase 12: Wire Config Parameters to Runtime Call Sites - Research

**Researched:** 2026-03-25
**Domain:** Config-to-runtime wiring (TypeScript integration, no new libraries)
**Confidence:** HIGH

## Summary

Phase 12 closes two MEDIUM/LOW-severity integration gaps identified in the v1.0 milestone audit: the `peakTransmissionWindow` and `recentLayerThreshold` config parameters are declared in `SimulationParametersSchema` but have no runtime effect at their call sites. Both parameters already exist in the schema, have defaults, and are passed through the config pipeline -- the gap is purely at the call sites that should read them but currently ignore them.

After Phase 11 wired the mortality engine, the `peakTransmissionWindow.min` is already used by `createDeathThresholds()` in `generation-runner.ts` (line 91). However, `peakTransmissionWindow.max` has no runtime consumer, and `recentLayerThreshold` is accepted by `composeInheritance()` as a config field but never read in the function body. This phase requires surgical changes to two files with corresponding test updates.

**Primary recommendation:** Replace ignored config values with actual reads at their exact call sites. No new files, no new dependencies, no architectural changes.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAN-01 | Peak transmission triggered at 40-50% context -- agent prompted to distill best thinking | `peakTransmissionWindow` already controls the threshold trigger point via `createDeathThresholds()` after Phase 11. The `max` field needs a consumer to define the upper bound of the window. The current implementation fires peak-transmission at `min` but does not enforce a `max` boundary. See "Gap Analysis" section for exact code locations. |
| INHR-03 | Inheritance staging rates configurable via simulation parameters | `seedLayerAtBirth` is already functional. `recentLayerThreshold` is accepted by `composeInheritance()` config parameter (line 33) but never read in the function body (only `config.seedLayerAtBirth` is accessed at line 58). See "Gap Analysis" section for exact wiring needed. |

</phase_requirements>

## Gap Analysis (Primary Research Finding)

### Gap 1: peakTransmissionWindow -- TRAN-01

**Current state (after Phase 11):**
- `peakTransmissionWindow.min` (default 0.4) IS wired: `generation-runner.ts` line 91 passes it to `createDeathThresholds()`, which creates the peak-transmission threshold at that percentage.
- `peakTransmissionWindow.max` (default 0.5) is NOT wired: no code reads this value anywhere at runtime.

**What the audit said:**
> `generation-runner.ts` line 70 hardcodes `buildPeakTransmissionPrompt(citizen, 0.45)` instead of using `params.peakTransmissionWindow` config.

**Post-Phase 11 reality:** The audit described pre-Phase-11 code. Phase 11 replaced the hardcoded 0.45 with `budget.percentage` (the actual context consumption). The peak-transmission threshold now fires based on `peakTransmissionWindow.min`. So `min` is wired. But `max` still has no consumer.

**What `max` should control:** The requirement says "peak transmission triggered at 40-50% context." The `min`/`max` define a window. The `min` controls when the peak-transmission threshold fires. The `max` could potentially control the latest point at which peak transmission can be triggered (but currently there is no upper-bound enforcement). However, in practice the implementation fires peak-transmission exactly when `budget.percentage >= peakTransmissionWindow.min`, and the actual percentage passed to `buildPeakTransmissionPrompt` is whatever `budget.percentage` happens to be at that moment (which is always >= min).

**Remaining gap:** The success criteria says: "generation-runner.ts reads `params.peakTransmissionWindow` instead of hardcoding 0.45." After Phase 11, the 0.45 is gone. But the `max` is still unused. Changing `peakTransmissionWindow` values in config should produce "observable runtime behavior change." Currently:
- Changing `min` DOES change behavior (moves the threshold trigger point) -- ALREADY WIRED.
- Changing `max` does NOT change behavior -- NEEDS WIRING.

**Recommended fix:** Use `peakTransmissionWindow.max` as an upper-bound deadline. If a citizen reaches the DYING phase without having triggered peak-transmission during INTERACTING, and `budget.percentage > peakTransmissionWindow.max`, cap the reported percentage at `max` in the peak prompt to maintain the "peak clarity" framing. Alternatively (and more simply), ensure that `max` is validated against `min` in the schema refinement and serves as the upper-bound threshold label. The simplest observable effect: log or use `max` as the context-percentage cap in `buildPeakTransmissionPrompt` when it exceeds `max`.

### Gap 2: recentLayerThreshold -- INHR-03

**Current state:**
- `composeInheritance()` signature accepts `config: { seedLayerAtBirth: boolean; recentLayerThreshold: number }` (line 33).
- Function body only reads `config.seedLayerAtBirth` (line 58). `config.recentLayerThreshold` is never accessed.
- `simulation-runner.ts` passes `params.inheritanceStagingRates` which contains both fields (line 26).

**What recentLayerThreshold should control:** Per INHR-02: "Recent layer delivered at maturity (~20-30% context)." The `recentLayerThreshold` (default 0.25) represents the context percentage at which the recent layer should be delivered to citizens. Currently, the recent layer is pre-composed by `composeInheritance()` and prepended to the seed problem BEFORE generation starts (line 101 of `generation-runner.ts`). This means every citizen gets the recent layer from turn 1 -- not at 20-30% context maturity.

**Recommended fix:** The `recentLayerThreshold` should control when the recent layer is injected into citizen context during the generation. This requires:
1. `composeInheritance()` still composes the recent layer (no change to composition).
2. `runGeneration()` holds back the recent layer from the initial `enrichedSeedProblem`.
3. Instead, inject the recent layer when `budget.percentage >= recentLayerThreshold` during the INTERACTING phase.

**Implementation approach:**
- `generation-runner.ts` receives `recentLayer` but does NOT prepend it to `enrichedSeedProblem` immediately.
- Add a new threshold label `'inheritance-recent'` (already exported as `INHERITANCE_RECENT_LABEL`) to each citizen's threshold set at `recentLayerThreshold` percentage.
- When this threshold fires during INTERACTING, inject the recent layer into the next turn's prompt.
- This makes `recentLayerThreshold` config-driven: changing it from 0.25 to 0.5 delays recent layer delivery to 50% context.

**Alternative simpler approach:** If the above is too invasive, a minimal fix is to have `composeInheritance()` actually read and return `recentLayerThreshold` in the `InheritancePackage` so callers can use it. Then `generation-runner.ts` uses it as the threshold for when to prepend `recentLayer` to turn prompts during the INTERACTING loop, comparing against `budget.percentage`.

## Architecture Patterns

### Current Config Flow
```
SimulationParametersSchema (schemas/simulation.ts)
  -> parsed by CLI (cli.ts)
  -> passed to runSimulation(params) (simulation-runner.ts)
    -> params.inheritanceStagingRates passed to composeInheritance() (inheritance-composer.ts)
    -> params passed to runGeneration() (generation-runner.ts)
      -> params.peakTransmissionWindow.min passed to createDeathThresholds()
      -> params.mutationRate, params.largeMutationProbability passed to mutateTransmission()
      -> params.contextWindow used for ContextBudget
```

### Files Requiring Changes

| File | Change | Scope |
|------|--------|-------|
| `src/generation/generation-runner.ts` | Wire `recentLayerThreshold` for delayed recent layer delivery; optionally wire `peakTransmissionWindow.max` | Lines 88-104 (threshold creation), line 101 (enrichedSeedProblem) |
| `src/inheritance/inheritance-composer.ts` | Read `config.recentLayerThreshold` or pass through to return value | Line 58+ area |
| `src/generation/generation.test.ts` | Add tests for config-driven behavior changes | New test cases |
| `src/inheritance/inheritance.test.ts` | Update tests if composeInheritance behavior changes | Existing test cases |

### Pattern: Threshold-Based Delivery (Recommended for recentLayerThreshold)

The existing codebase already uses `ContextThreshold` + `firedLabels` pattern in the INTERACTING loop. Adding `recentLayerThreshold` as another threshold follows the exact same pattern:

```typescript
// In generation-runner.ts, during per-citizen threshold checking:
// Add alongside existing PEAK_TRANSMISSION_LABEL and ACCIDENT_DEATH_LABEL checks:
if (threshold.label === INHERITANCE_RECENT_LABEL) {
  // Inject recent layer into next turn's prompt
  recentLayerInjected = true;
}
```

This matches the existing architectural pattern perfectly -- no new patterns needed.

### Pattern: Config Validation Refinement

The schema should validate that `peakTransmissionWindow.min <= peakTransmissionWindow.max`. Currently no refinement enforces this. Adding a `.refine()` prevents nonsensical config.

```typescript
peakTransmissionWindow: z.object({
  min: z.number().min(0).max(1).default(0.4),
  max: z.number().min(0).max(1).default(0.5),
}).refine(w => w.min <= w.max, {
  message: 'peakTransmissionWindow.min must be <= max',
}).default({ min: 0.4, max: 0.5 }),
```

### Anti-Patterns to Avoid
- **Adding a new file for this:** Both gaps are fixed by editing existing files. No new modules.
- **Changing the inheritance composition logic:** The `composeInheritance()` function should still compose the same content. The change is about WHEN it's delivered, not WHAT is composed.
- **Breaking existing tests by changing signatures:** `composeInheritance()` already accepts `recentLayerThreshold` in its config. No signature change needed there. `runGeneration()` already receives `recentLayer` as a parameter. The change is internal to how it uses that parameter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Threshold checking | Custom timing mechanism | Existing `ContextThreshold` + `firedLabels` pattern | Already proven in Phase 11 mortality wiring |
| Config validation | Manual min/max checks | Zod `.refine()` on schema | Catches invalid config at parse time |
| Recent layer injection timing | New event system | Threshold label in existing threshold array | `INHERITANCE_RECENT_LABEL` already exported for exactly this purpose |

**Key insight:** The `INHERITANCE_RECENT_LABEL` constant was exported from `inheritance-composer.ts` specifically for Phase 9 threshold label matching (per STATE.md decision). It was designed for exactly this wiring -- it just was never connected.

## Common Pitfalls

### Pitfall 1: Breaking Enriched Seed Problem for Generation 1
**What goes wrong:** If recent layer is held back from `enrichedSeedProblem` for delayed delivery, but the threshold never fires (budget stays below `recentLayerThreshold` for the entire generation), the recent layer is never delivered at all.
**Why it happens:** Short generations with few citizens may never consume enough context to reach 0.25.
**How to avoid:** Ensure the DYING phase delivers any undelivered recent layer as a fallback. Or deliver it to the first citizen of the next generation if not consumed.
**Warning signs:** Tests pass but changing `recentLayerThreshold` to 0.99 causes recent layer to never appear.

### Pitfall 2: Seed Layer Should Always Be At Birth
**What goes wrong:** Accidentally also delaying seed layer delivery.
**Why it happens:** Refactoring `enrichedSeedProblem` logic and inadvertently changing seed layer timing.
**How to avoid:** `seedLayerAtBirth` is already wired correctly. Only touch `recentLayer` handling.
**Warning signs:** Generation 2+ citizens don't receive ancestral knowledge in their first turn.

### Pitfall 3: Test Mock State Interference
**What goes wrong:** `mortalityState.budgetPercentage` mock affects threshold checking in unexpected ways.
**Why it happens:** The mock returns a fixed percentage for all `budget.percentage` reads. If the test expects different percentages at different points (e.g., 0.20 for early turns, then 0.45 after more turns), the mock can't represent this without manual mutation.
**How to avoid:** For tests that need budget progression, mutate `mortalityState.budgetPercentage` between mock calls or use `mockImplementation` that increments.
**Warning signs:** Tests that check "recentLayer delivered at 0.25" but mock always returns 0.45 (above threshold), making it impossible to test the "not yet delivered" state.

### Pitfall 4: peakTransmissionWindow.max vs Actual Budget
**What goes wrong:** If `max` is wired as an upper-bound kill switch that prevents peak transmission after `max` context, citizens who never reach `min` but exceed `max` (impossible since min < max) cause confusion. More realistically, the `max` value may be confused with a second threshold.
**Why it happens:** The schema defines min/max as a window but the code only needs a trigger point.
**How to avoid:** Be precise about what `max` means: it's the upper bound of the "optimal" window, not a hard cutoff. Use it for prompt language ("you are N% consumed, past your peak window") rather than as a functional gate.

## Code Examples

### Example 1: Adding recentLayerThreshold as a Threshold

```typescript
// In generation-runner.ts, when creating per-citizen mortality tracking:
const citizenMortality: CitizenMortality[] = citizens.map(citizen => ({
  citizen,
  thresholds: [
    ...createDeathThresholds(citizen.deathProfile, {
      peakTransmissionMin: params.peakTransmissionWindow.min,
    }),
    // Add inheritance-recent threshold from config
    {
      percentage: params.inheritanceStagingRates.recentLayerThreshold,
      label: INHERITANCE_RECENT_LABEL,
    },
  ],
  firedLabels: new Set<string>(),
  isDead: false,
  peakTransmissionCollected: false,
  declineSignals: [],
}));
```

### Example 2: Delayed Recent Layer Injection

```typescript
// In INTERACTING loop, alongside existing threshold handling:
if (threshold.label === INHERITANCE_RECENT_LABEL && recentLayer) {
  // Inject recent layer into subsequent turns by rebuilding enrichedSeedProblem
  recentLayerDelivered = true;
}

// Modify prompt building to include recent layer only after threshold fires:
const prompt = buildTurnPrompt(
  recentLayerDelivered
    ? [seedLayer, recentLayer, params.seedProblem].filter(Boolean).join('\n\n')
    : [seedLayer, params.seedProblem].filter(Boolean).join('\n\n'),
  turns,
);
```

### Example 3: Test for Config-Driven Behavior Change

```typescript
it('changing peakTransmissionWindow.min changes when peak-transmission threshold fires', async () => {
  const params = makeMockParams({
    peakTransmissionWindow: { min: 0.6, max: 0.7 },
  });
  setupDefaultMocks(params);

  await runGeneration(1, params, null, null);

  expect(mockCreateDeathThresholds).toHaveBeenCalledWith('old-age', {
    peakTransmissionMin: 0.6,
  });
});

it('changing recentLayerThreshold delays recent layer delivery', async () => {
  const params = makeMockParams();
  // Set budget below recentLayerThreshold
  mortalityState.budgetPercentage = 0.10;
  // ... setup mocks ...

  await runGeneration(2, params, 'seed', 'INHERITANCE FROM GEN 1: recent');

  // Recent layer should NOT be in the first turn's prompt
  const firstTurnSeedArg = mockBuildTurnPrompt.mock.calls[0][0];
  expect(firstTurnSeedArg).not.toContain('INHERITANCE FROM GEN 1');
});
```

## State of the Art

| Old Approach (pre-Phase 11) | Current Approach (post-Phase 11) | When Changed | Impact on Phase 12 |
|------------------------------|----------------------------------|--------------|---------------------|
| Hardcoded 0.45 for peak prompt | `budget.percentage` from actual consumption | Phase 11 | `peakTransmissionWindow.min` is already wired via thresholds. Only `max` gap remains. |
| No ContextBudget at runtime | Single ContextBudget per generation | Phase 11 | Enables threshold-based delivery for `recentLayerThreshold` |
| All citizens complete all turns | Mortality-aware turn loop with per-citizen thresholds | Phase 11 | Existing threshold infrastructure supports adding `INHERITANCE_RECENT_LABEL` |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/generation/generation.test.ts src/inheritance/inheritance.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRAN-01 | Changing peakTransmissionWindow values produces observable behavior change | unit | `npx vitest run src/generation/generation.test.ts -t "peakTransmissionWindow"` | Partial -- existing tests verify min is passed to createDeathThresholds. New tests needed for max. |
| INHR-03 | Changing recentLayerThreshold produces observable behavior change in when recent layer is delivered | unit | `npx vitest run src/generation/generation.test.ts -t "recentLayerThreshold"` | No -- new tests needed |
| INHR-03 | composeInheritance reads recentLayerThreshold from config | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "recentLayerThreshold"` | Partial -- existing tests pass the config but don't verify it's read |

### Sampling Rate
- **Per task commit:** `npx vitest run src/generation/generation.test.ts src/inheritance/inheritance.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `src/generation/generation.test.ts` -- covers TRAN-01 (peakTransmissionWindow.max has runtime effect)
- [ ] New test cases in `src/generation/generation.test.ts` -- covers INHR-03 (recentLayerThreshold delays recent layer delivery)
- [ ] Possibly update `src/inheritance/inheritance.test.ts` -- if composeInheritance body changes to read recentLayerThreshold

## Open Questions

1. **What should peakTransmissionWindow.max actually control?**
   - What we know: `min` is the threshold trigger. `max` has no consumer. The requirement says "40-50% context."
   - What's unclear: Should `max` be a hard upper bound (prevent peak transmission after max), a prompt-language modulator (tell citizen they're "past their peak window"), or just a validated upper bound with no runtime effect beyond config validation?
   - Recommendation: Simplest approach -- use `max` in the peak transmission prompt language (e.g., "Your peak clarity window was ${min*100}%-${max*100}% and you are now at ${actual*100}%"). This gives observable behavior change without adding complexity. The planner should decide.

2. **Should recentLayerThreshold be per-citizen or per-generation?**
   - What we know: Currently the single ContextBudget tracks cumulative consumption across all citizens in a generation.
   - What's unclear: Should the first citizen to cross 0.25 context trigger recent layer delivery for ALL subsequent citizens, or should each citizen independently wait until "their" portion of context reaches 0.25?
   - Recommendation: Per-generation (first citizen crossing threshold makes it available to all subsequent citizens). This matches the single-budget-per-generation model from Phase 11 and is simpler.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `src/generation/generation-runner.ts` (190 lines)
- Direct codebase inspection of `src/inheritance/inheritance-composer.ts` (102 lines)
- Direct codebase inspection of `src/schemas/simulation.ts` (25 lines)
- Direct codebase inspection of `src/mortality/death-execution.ts` (117 lines)
- Direct codebase inspection of `src/generation/generation.test.ts` (~1000 lines)
- Direct codebase inspection of `src/inheritance/inheritance.test.ts` (~560 lines)
- `.planning/v1.0-MILESTONE-AUDIT.md` -- gap identification and severity ratings
- `.planning/REQUIREMENTS.md` -- TRAN-01 and INHR-03 definitions
- `.planning/STATE.md` -- accumulated decisions from Phase 11

### Secondary (MEDIUM confidence)
- Phase 11 decisions in STATE.md about single ContextBudget per generation model

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, pure TypeScript edits to existing files
- Architecture: HIGH - all patterns already exist in codebase (threshold-based delivery)
- Pitfalls: HIGH - identified from direct code and test analysis
- Gap analysis: HIGH - verified by reading actual source code post-Phase-11

**Research date:** 2026-03-25
**Valid until:** Indefinite (codebase-specific findings, no external dependency drift)
