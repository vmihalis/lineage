# Phase 9: Generation Manager - Research

**Researched:** 2026-03-25
**Domain:** State machine orchestration, multi-generation simulation lifecycle
**Confidence:** HIGH

## Summary

Phase 9 is the orchestration layer -- the Generation Manager ties together all eight previously-built subsystems (mortality, roles, interaction, transmission, mutation, inheritance) into an autonomous multi-generation simulation loop. This is NOT a technology research phase. There are no new libraries to install, no new external APIs to learn, and no architectural unknowns. The entire phase is about wiring existing, tested functions into the correct sequence with a state machine governing transitions.

The codebase already has every subsystem needed: `birthCitizen()` (mortality), `assignRoles()` (roles), `runTurns()` (interaction), `executePeakTransmission()` + `writeTransmission()` (transmission), `mutateTransmission()` (mutation), and `composeInheritance()` (inheritance). The Generation schema (`GenerationPhaseSchema`) already defines the exact state machine phases: `INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE`. The `SimulationParameters` already has `generationSize`, `maxGenerations`, and all other config fields. The event types `generation:started`, `generation:ended`, `simulation:started`, `simulation:ended` are already defined on `LineageEvents`.

**Primary recommendation:** Build a pure state-machine `GenerationManager` class that consumes `SimulationParameters` and orchestrates the subsystem function calls in sequence. Wire it into `cli.ts` to replace the "Execution engine not yet implemented" placeholder. Test with mocked Agent SDK calls (existing test pattern) to verify state transitions and subsystem call ordering.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GENM-01 | Generation manager orchestrates full cohort lifecycle: birth -> roles -> interaction -> death -> next | All subsystem APIs are exported and tested. `birthCitizen()`, `assignRoles()`, `runTurns()`, `executePeakTransmission()`, `writeTransmission()`, `mutateTransmission()`, `composeInheritance()` compose into a sequential pipeline per generation. |
| GENM-02 | State machine with clear phases: INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE | `GenerationPhaseSchema` already defines these exact 6 states. `GenerationSchema` has a `phase` field defaulting to `'INIT'`. The state machine is a thin wrapper managing transitions. |
| GENM-03 | Configurable generation size (citizens per cohort) | `SimulationParameters.generationSize` exists (default 5, min 1, max 20). `assignRoles(generationSize, distribution)` already takes this parameter. |
| GENM-04 | Configurable maximum number of generations (default 3, safety limit) | `SimulationParameters.maxGenerations` exists (default 3, min 1, max 100). The outer loop simply iterates `1..maxGenerations`. |
| GENM-05 | Generation boundary triggers inheritance composition for next generation | `composeInheritance(targetGeneration, outputDir, config)` is the exact function needed. Called at the TRANSMITTING -> COMPLETE transition with `targetGeneration = currentGeneration + 1`. Generation 1 returns null layers (handled internally). |
</phase_requirements>

## Standard Stack

### Core

No new libraries needed. Phase 9 uses only existing project dependencies.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| All existing deps | (see package.json) | All subsystem orchestration | Every subsystem is already built and exported via `src/index.ts`. No new npm packages required. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.x (installed) | Generation ID creation | Each `Generation` object needs a unique `id` field |
| zod | 4.x (installed) | Schema validation for Generation state | `GenerationSchema.parse()` for creating/validating generation objects |

### Alternatives Considered

None -- this phase is pure orchestration of existing code.

## Architecture Patterns

### Recommended Project Structure

```
src/
  generation/
    generation-manager.ts    # GenerationManager class with state machine
    generation-runner.ts     # runGeneration() - single generation lifecycle
    simulation-runner.ts     # runSimulation() - outer loop across generations
    generation.test.ts       # Tests for state machine + orchestration
    index.ts                 # Barrel exports
```

### Pattern 1: State Machine as Method Sequence

**What:** Each `GenerationPhase` transition maps to a method that calls the appropriate subsystem functions, updates the `Generation` object's `phase` field, and emits the corresponding event. The state machine is NOT event-driven or reactive -- it is a simple sequential method chain.

**When to use:** Always for this phase. The simulation is inherently sequential (turn-based, one citizen at a time, one generation at a time).

**Example:**

```typescript
// Source: Derived from existing codebase patterns
import { nanoid } from 'nanoid';
import type { Generation, SimulationParameters, CitizenConfig } from '../schemas/index.js';
import { GenerationSchema } from '../schemas/index.js';
import { assignRoles } from '../roles/index.js';
import { birthCitizen } from '../mortality/index.js';
import { lineageBus } from '../events/index.js';

export async function runGeneration(
  generationNumber: number,
  params: SimulationParameters,
  inheritanceSeedLayer: string | null,
  inheritanceRecentLayer: string | null,
): Promise<Generation> {
  // INIT
  const generation = GenerationSchema.parse({
    id: nanoid(),
    number: generationNumber,
    phase: 'INIT',
    citizenIds: [],
    transmissionIds: [],
    startedAt: new Date().toISOString(),
  });

  // BIRTHING
  generation.phase = 'BIRTHING';
  const roles = assignRoles(params.generationSize, params.roleDistribution);
  const citizens: CitizenConfig[] = roles.map(role =>
    birthCitizen(role, generationNumber, params),
  );
  generation.citizenIds = citizens.map(c => c.id);
  lineageBus.emit('generation:started', generationNumber, citizens.length);

  // INTERACTING -- calls runTurns()
  generation.phase = 'INTERACTING';
  // ... inject inheritance layers into turn prompts ...

  // DYING -- trigger peak transmissions based on context thresholds
  generation.phase = 'DYING';
  // ... for each citizen, executePeakTransmission + writeTransmission ...

  // TRANSMITTING -- mutate transmissions
  generation.phase = 'TRANSMITTING';
  // ... for each transmission, mutateTransmission() ...

  // COMPLETE
  generation.phase = 'COMPLETE';
  generation.endedAt = new Date().toISOString();
  lineageBus.emit('generation:ended', generationNumber);

  return generation;
}
```

### Pattern 2: Outer Simulation Loop

**What:** The simulation runner iterates from generation 1 to `maxGenerations`, calling `composeInheritance()` at each boundary and passing the resulting layers to the next generation's `runGeneration()`.

**Example:**

```typescript
// Source: Derived from existing codebase patterns
import type { SimulationParameters, Generation } from '../schemas/index.js';
import { composeInheritance } from '../inheritance/index.js';
import { lineageBus } from '../events/index.js';

export async function runSimulation(
  params: SimulationParameters,
): Promise<Generation[]> {
  lineageBus.emit('simulation:started', params.seedProblem, params);
  const generations: Generation[] = [];

  for (let gen = 1; gen <= params.maxGenerations; gen++) {
    // Compose inheritance for this generation (gen 1 returns null layers)
    const inheritance = await composeInheritance(
      gen,
      params.outputDir,
      params.inheritanceStagingRates,
    );

    // Run the generation lifecycle
    const generation = await runGeneration(
      gen, params,
      inheritance.seedLayer,
      inheritance.recentLayer,
    );
    generations.push(generation);
  }

  lineageBus.emit('simulation:ended', generations.length);
  return generations;
}
```

### Pattern 3: Inheritance Layer Injection into Turn Prompts

**What:** Seed layer is prepended to the first citizen's turn prompt at birth. Recent layer is injected when context reaches the `recentLayerThreshold` (default 25%). The existing `buildTurnPrompt()` takes a seed problem string -- inheritance layers should be prepended to/appended to this prompt, not passed through a separate channel.

**Critical insight:** The current `runTurns()` builds prompts via `buildTurnPrompt(seedProblem, previousTurns)`. Inheritance layers need to be incorporated into these prompts. The cleanest approach is to prepend inheritance text to the seed problem string, or to extend `buildTurnPrompt` with an optional inheritance context parameter. Modifying `buildTurnPrompt` is preferred since it keeps the formatting centralized.

**Example:**

```typescript
// Option: Prepend inheritance to seed problem for simplicity
const enrichedSeedProblem = [
  inheritance.seedLayer,     // null for gen 1
  inheritance.recentLayer,   // null for gen 1
  params.seedProblem,
].filter(Boolean).join('\n\n');
```

### Pattern 4: Simplified Mortality in the Orchestrator

**What:** The full mortality engine (ContextBudget with threshold callbacks triggering peak transmission mid-conversation) is complex to wire into the orchestrator. For the v1 hackathon, a pragmatic approach:

1. Citizens execute their turn via `runTurns()` (interaction phase)
2. After all turns complete, every citizen produces a peak transmission (dying phase)
3. Transmissions are mutated (transmitting phase)

This simplification works because: (a) `runTurns()` already optionally updates a ContextBudget, (b) the transmission prompt already includes mortality-aware language, (c) the important thing for the demo is that transmissions flow across generations, not that they trigger at an exact context percentage.

**More sophisticated approach (if time permits):** Wire ContextBudget thresholds into the turn loop so peak transmission happens mid-conversation when a citizen crosses the peak threshold, and citizens with accident profiles die before completing all turns.

### Anti-Patterns to Avoid

- **Event-driven state machine:** Do NOT build a reactive event-driven state machine. The simulation is inherently sequential. A simple `for` loop with explicit method calls is the right pattern. EventEmitter events are for observability (Phase 10), not control flow.
- **Parallel execution:** Do NOT attempt to run citizens in parallel. The turn-based model requires sequential execution where each citizen sees the previous one's output.
- **Global mutable state:** Do NOT store generation state in module-level singletons. Pass `Generation` objects through function parameters. The `lineageBus` is the only acceptable singleton (it's the event bus).
- **Over-abstracting the state machine:** Do NOT build a generic FSM framework. The six states are fixed, the transitions are fixed, the sequence is fixed. A switch/case or sequential method chain is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine framework | Generic FSM class with transition tables | Sequential method calls with phase property updates | Only 6 states in a fixed linear sequence -- a framework adds complexity for zero benefit |
| Citizen birth pipeline | Custom citizen factory | `birthCitizen(role, gen, params)` | Already built and tested in Phase 3 |
| Role assignment | Manual role selection | `assignRoles(size, distribution)` | Already built and tested in Phase 4 |
| Turn execution | Custom agent calling | `runTurns(config)` | Already built and tested in Phase 5 |
| Transmission creation | Custom prompt + query | `executePeakTransmission(citizen, prompt)` + `writeTransmission(tx, dir)` | Already built and tested in Phase 6 |
| Mutation application | Custom mutation logic | `mutateTransmission(tx, rate, prob)` | Already built and tested in Phase 7 |
| Inheritance composition | Custom layer builder | `composeInheritance(gen, dir, config)` | Already built and tested in Phase 8 |

**Key insight:** Phase 9 should have ZERO new Agent SDK calls. Every LLM interaction is already encapsulated in the subsystem functions. The generation manager is pure orchestration code.

## Common Pitfalls

### Pitfall 1: Forgetting Generation 1 Has No Inheritance

**What goes wrong:** Trying to inject inheritance layers into generation 1 prompts when `composeInheritance(1, ...)` returns `{ seedLayer: null, recentLayer: null }`.
**Why it happens:** The outer loop calls composeInheritance for every generation including gen 1.
**How to avoid:** `composeInheritance()` already handles this correctly by returning null layers for gen 1. The prompt builder should filter null layers: `[seedLayer, recentLayer, seedProblem].filter(Boolean).join('\n\n')`.
**Warning signs:** Tests pass but gen 1 citizens see "null" or "undefined" in their prompts.

### Pitfall 2: Transmission Write Path Mismatch

**What goes wrong:** Peak transmissions are written to a path that doesn't match what `readGenerationTransmissions()` expects.
**Why it happens:** `writeTransmission()` writes to `{outputDir}/transmissions/gen{N}/{citizenId}-{type}.json`. The inheritance composer reads from the same path convention. If the generation manager writes to a different path, inheritance fails silently (returns empty arrays, not errors, due to ENOENT catch).
**How to avoid:** Use `writeTransmission()` directly -- it already encodes the correct path convention.
**Warning signs:** Generation 2+ citizens have empty inheritance layers despite generation 1 having produced transmissions.

### Pitfall 3: State Machine Phase Not Updated Before Subsystem Calls

**What goes wrong:** The `Generation.phase` field doesn't reflect the current operation, making debugging and event inspection confusing.
**Why it happens:** Developer calls subsystem function before updating the phase field.
**How to avoid:** Always update `generation.phase` BEFORE calling the subsystem functions for that phase. This makes it easy to inspect where a failure occurred.
**Warning signs:** Generation objects saved to disk show incorrect phase for the point of failure.

### Pitfall 4: CLI Integration Breaking Existing Tests

**What goes wrong:** Wiring `runSimulation()` into `cli.ts` causes the 294 existing tests to attempt real Agent SDK calls or timeout.
**Why it happens:** The CLI test imports `createProgram()` which now triggers simulation execution.
**How to avoid:** Keep the simulation runner as a separate function called from the CLI action. The CLI test already mocks at the action level. The generation manager tests should mock all Agent SDK calls using the same `vi.mock('@anthropic-ai/claude-agent-sdk')` pattern established in phases 5-8.
**Warning signs:** Tests that previously passed in <1s now timeout or make network calls.

### Pitfall 5: Not Persisting Generation State

**What goes wrong:** The simulation runs but generation metadata (which citizens lived, which phase completed, timestamps) is lost.
**Why it happens:** Only transmissions are persisted to disk (via `writeTransmission`). The `Generation` objects themselves are never saved.
**How to avoid:** Use `LineageStateManager` to write each generation's state to `{outputDir}/generations/gen{N}.json` at the COMPLETE phase. Validate with `GenerationSchema`.
**Warning signs:** After simulation, the output directory only has transmissions, no generation summaries.

### Pitfall 6: Mutation Writes Overwriting Original Transmissions

**What goes wrong:** `mutateTransmission()` returns a new Transmission object with a new ID but the original file on disk is not preserved.
**Why it happens:** The mutated transmission has a different ID than the original. If the developer writes the mutated version to the same file path as the original, the original is lost. If they use the new ID, a second file appears.
**How to avoid:** `mutateTransmission()` creates a new Transmission with `nanoid()` -- it is immutable. Write the mutated transmission as a SEPARATE file alongside the original. The inheritance composer reads ALL files in the generation directory, so both will be found. Alternatively, write ONLY the (possibly mutated) version to disk since the original content is not needed once mutation is decided.
**Warning signs:** Transmission count doesn't match expected count, or inheritance composer sees duplicate content.

## Code Examples

### Complete Subsystem API Inventory

Every function the generation manager will call, with exact signatures from the codebase:

```typescript
// Source: src/mortality/citizen-lifecycle.ts
function birthCitizen(
  role: CitizenRole,
  generationNumber: number,
  params: SimulationParameters,
): CitizenConfig;

// Source: src/roles/role-assignment.ts
function assignRoles(
  generationSize: number,
  distribution: RoleDistribution,
): CitizenRole[];

// Source: src/interaction/turn-runner.ts
async function runTurns(config: TurnRunnerConfig): Promise<TurnResult>;
// TurnRunnerConfig = { seedProblem: string; citizens: CitizenConfig[]; contextBudget?: ContextBudget }

// Source: src/transmission/peak-prompt.ts
function buildPeakTransmissionPrompt(
  citizen: CitizenConfig,
  contextPercentage: number,
): string;

// Source: src/transmission/transmission-executor.ts
async function executePeakTransmission(
  citizen: CitizenConfig,
  peakPrompt: string,
): Promise<TransmissionResult>;
// TransmissionResult = { transmission: Transmission; usage: { inputTokens; outputTokens } }

// Source: src/transmission/transmission-writer.ts
async function writeTransmission(
  transmission: Transmission,
  outputDir: string,
): Promise<string>;  // returns file path

// Source: src/mutation/mutation-pipeline.ts
async function mutateTransmission(
  original: Transmission,
  mutationRate: number,
  largeMutationProbability: number,
  randomFn?: () => number,
): Promise<MutationResult>;
// MutationResult = { transmission: Transmission; wasMutated: boolean; mutationType?; tokenIndex? }

// Source: src/inheritance/inheritance-composer.ts
async function composeInheritance(
  targetGeneration: number,
  outputDir: string,
  config: { seedLayerAtBirth: boolean; recentLayerThreshold: number },
): Promise<InheritancePackage>;
// InheritancePackage = { targetGeneration; seedLayer: string|null; recentLayer: string|null; seedTokens; recentTokens; composedAt }
```

### Event Emissions the Manager Must Make

```typescript
// Source: src/events/types.ts -- events the generation manager is responsible for
lineageBus.emit('simulation:started', seedProblem, config);  // at simulation start
lineageBus.emit('generation:started', generationNumber, citizenCount);  // at BIRTHING
lineageBus.emit('generation:ended', generationNumber);  // at COMPLETE
lineageBus.emit('simulation:ended', generationCount);  // at simulation end

// These are already emitted by subsystem functions (DO NOT duplicate):
// 'citizen:born' -- emitted by birthCitizen()
// 'citizen:died' -- NOT yet emitted (no death execution wired)
// 'citizen:peak-transmission' -- emitted by writeTransmission()
// 'transmission:mutated' -- emitted by mutateTransmission()
// 'inheritance:composed' -- emitted by composeInheritance()
```

### Generation Schema Already Defined

```typescript
// Source: src/schemas/generation.ts -- already exists, ready to use
const GenerationPhaseSchema = z.enum([
  'INIT', 'BIRTHING', 'INTERACTING', 'DYING', 'TRANSMITTING', 'COMPLETE',
]);

const GenerationSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  phase: GenerationPhaseSchema.default('INIT'),
  citizenIds: z.array(z.string()).default([]),
  transmissionIds: z.array(z.string()).default([]),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});
```

### CLI Integration Point

```typescript
// Source: src/cli.ts -- line 39 is the placeholder to replace
// Current: console.log('Simulation bootstrap complete. Execution engine not yet implemented.');
// Replace with: await runSimulation(config);
```

### Test Pattern (from existing codebase)

```typescript
// Source: Derived from src/inheritance/inheritance.test.ts pattern
// Mock Agent SDK at module level before imports
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

// Mock fs for transmission read/write
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// Helper: create mock query generator (reuse pattern from inheritance.test.ts)
function createMockQueryGenerator(resultText: string, inputTokens = 100, outputTokens = 200) {
  return (async function* () {
    yield { type: 'result', subtype: 'success', result: resultText, /* ... */ };
  })();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Event-driven FSMs for sequential processes | Simple sequential method chains | Current best practice for linear workflows | Reduced complexity, easier debugging |
| Global state management | Function parameters + return values | Current codebase pattern | Testable, no shared mutable state |

## Open Questions

1. **Death Profile Integration Depth**
   - What we know: `ContextBudget` tracks context consumption and fires threshold callbacks. `createDeathThresholds()` maps death profiles to thresholds. `getDeclineSignal()` produces injectable decline text.
   - What's unclear: Should the v1 hackathon demo wire full mortality into the turn loop (citizens die mid-conversation, peak transmissions fire at threshold crossing), or use the simplified approach (all citizens complete turns, then all produce transmissions)?
   - Recommendation: Start with the simplified approach (Pattern 4 above) for the first plan. If time permits, add a second plan that wires ContextBudget into the turn loop for more realistic mortality. The simplified approach still produces valid transmissions across generations.

2. **citizen:died Event Emission**
   - What we know: The `citizen:died` event type is defined on `LineageEvents` but no existing subsystem emits it. The generation manager must emit this.
   - What's unclear: When exactly in the lifecycle -- after peak transmission? After the DYING phase completes?
   - Recommendation: Emit `citizen:died` after the citizen's peak transmission is written to disk. This captures "the citizen produced their legacy and then died." For accident citizens who die before peak transmission window, emit death without a transmission.

3. **Inheritance Layer Delivery Timing**
   - What we know: `inheritanceStagingRates.seedLayerAtBirth` (boolean) and `recentLayerThreshold` (0.25 = 25% context) control when layers are delivered. `INHERITANCE_RECENT_LABEL` is exported for threshold matching.
   - What's unclear: In the simplified approach, where ContextBudget is not wired into the turn loop, how do we deliver the recent layer "at 25% context"?
   - Recommendation: In the simplified approach, deliver BOTH layers at birth (prepend to first turn prompt). The exact staging timing is a v2 refinement. What matters for the demo is that inheritance content reaches the next generation's citizens.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/generation/generation.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GENM-01 | Full cohort lifecycle: birth -> interaction -> death -> transmission -> next | unit | `npx vitest run src/generation/generation.test.ts -t "runs full generation lifecycle"` | Wave 0 |
| GENM-02 | State machine transitions through INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE | unit | `npx vitest run src/generation/generation.test.ts -t "state machine"` | Wave 0 |
| GENM-03 | Generation size is configurable and respected | unit | `npx vitest run src/generation/generation.test.ts -t "generation size"` | Wave 0 |
| GENM-04 | Simulation stops after maxGenerations | unit | `npx vitest run src/generation/generation.test.ts -t "maxGenerations"` | Wave 0 |
| GENM-05 | Inheritance composed at generation boundary | unit | `npx vitest run src/generation/generation.test.ts -t "inheritance"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/generation/generation.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/generation/generation.test.ts` -- covers GENM-01 through GENM-05
- [ ] Mock setup for Agent SDK and fs (reuse patterns from inheritance.test.ts and mutation.test.ts)

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all source files in `src/` -- all subsystem APIs verified by reading implementations
- `src/schemas/generation.ts` -- GenerationPhaseSchema and GenerationSchema already defined
- `src/events/types.ts` -- all event types already declared
- `src/schemas/simulation.ts` -- SimulationParameters with generationSize, maxGenerations confirmed
- `vitest run` -- 294 tests passing, all subsystems operational

### Secondary (MEDIUM confidence)
- Test patterns from `src/inheritance/inheritance.test.ts`, `src/mutation/mutation.test.ts` -- established mock patterns for Agent SDK and fs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all code is internal orchestration
- Architecture: HIGH -- sequential orchestration of known APIs with an already-defined schema
- Pitfalls: HIGH -- identified from direct code inspection of existing subsystem contracts

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- no external dependency changes expected)
