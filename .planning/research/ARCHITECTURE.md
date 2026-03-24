# Architecture Patterns

**Domain:** AI Agent Civilization Simulator (generational knowledge evolution)
**Researched:** 2026-03-24

## Recommended Architecture

LINEAGE is a **sequential turn-based simulation engine** with an **event-driven backbone** and a **pipeline-based transformation layer**. It combines three well-established architectural patterns:

1. **Simulation Loop** (game engine pattern) -- The Generation Manager drives a discrete, tick-like outer loop: `birth -> roles -> interaction -> death -> next`. Each generation is one "tick." Within a generation, citizen execution is sequential (one agent at a time, each seeing the previous agent's output).

2. **Event Bus** (pub/sub pattern) -- All state mutations emit typed events through a shared EventEmitter3 bus inherited from `@genesis/shared`. Components observe events rather than calling each other directly. This keeps subsystems decoupled and makes the system observable.

3. **Pipeline** (transformation chain) -- The Mutation Pipeline and Inheritance Composer use a staged pipeline pattern where data flows through ordered transformation steps. Each step is a pure function that takes input and returns transformed output, making mutations testable in isolation.

### System Architecture Diagram

```
                          CLI Entry Point
                               |
                               v
                    +---------------------+
                    |  Simulation Runner   |  <-- Reads SimulationParameters
                    |  (outer loop)        |      Writes final output
                    +---------------------+
                               |
                    Generation Loop (1..N)
                               |
                               v
                    +---------------------+
                    |  Generation Manager  |  <-- Orchestrates one generation
                    |                      |      birth -> interact -> death -> transmit
                    +---------------------+
                       |    |    |    |
           +-----------+    |    |    +------------+
           |                |    |                 |
           v                v    v                 v
   +-------------+   +-----------+   +------------------+
   |  Mortality   |   | Agent SDK |   |  Transmission    |
   |  Engine      |   | Execution |   |  System          |
   |              |   | (citizen  |   |                  |
   | - profiles   |   |  turns)   |   | - peak writer    |
   | - context    |   |           |   | - elder writer   |
   |   tracking   |   +-----------+   | - accident snap  |
   | - death      |        |         | - collective     |
   |   triggers   |        |         +------------------+
   +-------------+         |                  |
                           |                  v
                           |         +------------------+
                           |         |  Mutation         |
                           |         |  Pipeline         |
                           |         |                  |
                           |         | - small drift    |
                           |         | - large invert   |
                           |         | - generative     |
                           |         | - cancer prop    |
                           |         +------------------+
                           |                  |
                           |                  v
                           |         +------------------+
                           |         |  Inheritance      |
                           |         |  Composer          |
                           |         |                  |
                           |         | - seed layer     |
                           |         | - recent layer   |
                           |         | - archive        |
                           +-------->| - staged deliver |
                                     +------------------+
                                              |
                                              v
                                     +------------------+
                                     |  Civilization     |
                                     |  Metrics          |
                                     |                  |
                                     | - survival rate  |
                                     | - seed progress  |
                                     | - corruption lvl |
                                     | - diversity      |
                                     +------------------+

   Cross-cutting: Event Bus (all components emit), StateManager (all persist),
                  Schemas (all validate at boundaries)
```

### Component Boundaries

| Component | Responsibility | Inputs | Outputs | Communicates With |
|-----------|---------------|--------|---------|-------------------|
| **Simulation Runner** | CLI entry, outer generation loop, parameter loading | CLI args (seed problem, config path), SimulationParameters | Final simulation report, event stream | Generation Manager, Metrics |
| **Generation Manager** | Orchestrates one generation's lifecycle: birth, role assignment, sequential citizen interaction, death execution, transmission collection | SimulationParameters, inherited knowledge from Inheritance Composer | Generation summary, citizen outputs, transmission artifacts | Mortality Engine, Agent SDK execution, Transmission System, Inheritance Composer, Metrics |
| **Mortality Engine** | Assigns hidden death profiles at birth, tracks context usage as aging proxy, triggers death conditions | Citizen config, context token counts per turn, death profile distribution | Death events, death profile data, cancer degradation signals | Generation Manager (called by), Event Bus (emits to) |
| **Transmission System** | Writes transmission artifacts at defined lifecycle points (peak, elder, accident, collective) | Citizen agent output at various context thresholds, death profile state | Transmission documents (peak, elder, accident artifact, collective, cancer flags) | Generation Manager (triggered by), Mutation Pipeline (feeds into) |
| **Mutation Pipeline** | Applies corruption to transmissions in transit between generations | Raw transmission documents, mutation rate params, cancer flags | Mutated transmissions with provenance metadata | Transmission System (receives from), Inheritance Composer (feeds into) |
| **Inheritance Composer** | Assembles and stages inherited knowledge for newborn citizens | All mutated transmissions from all prior generations, staging rate params | Three delivery layers: seed (compressed axioms), recent (last gen detail), archive (full history) | Mutation Pipeline (receives from), Generation Manager (delivers to newborns) |
| **Civilization Metrics** | Computes feedback signals at generation boundaries | All transmissions (original + mutated), citizen outputs, generation history | Metric values: survival rate, seed progress, corruption level, diversity, emergence events | Generation Manager (triggered by), Simulation Runner (reported to) |
| **Schemas** | Zod schemas extending @genesis/shared; validation at all boundaries | N/A (type definitions) | Type-safe interfaces | All components (imported by all) |
| **Events** | LineageEvents extending GenesisEvents; typed event definitions | N/A (type definitions) | Typed event emissions | All components (emit through shared bus) |

### Data Flow

**Inter-generational flow (the core loop):**

```
Gen N Citizens produce output
        |
        v
Transmission System writes peak/elder/accident/collective artifacts
        |
        v
Mutation Pipeline corrupts transmissions (rates from SimulationParameters)
        |
        v
Inheritance Composer assembles layered inheritance package
        |
        v
Gen N+1 Citizens receive staged inheritance at birth/maturity/on-request
```

**Intra-generational flow (within one generation):**

```
Citizen 1 executes (receives inheritance + seed problem)
        |
        v  (output visible to next citizen)
Citizen 2 executes (sees Citizen 1's output + inheritance)
        |
        v
Citizen 3 executes (sees Citizen 1+2 output + inheritance)
        |
        v
... (sequential, each building on prior citizens)
        |
        v
Mortality Engine triggers deaths at context thresholds
        |
        v
Transmission System captures artifacts from each citizen at lifecycle points
```

**Event flow (cross-cutting):**

```
Every state mutation --> Event Bus --> Console output (real-time stream)
                                   --> Metrics computation
                                   --> State persistence (StateManager atomic writes)
                                   --> (Future: Genesis Interpreter observation)
```

## Patterns to Follow

### Pattern 1: Generation State Machine

**What:** Model each generation as a finite state machine with explicit phases: `INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE`. The Generation Manager transitions through these states, and each state has clear entry/exit conditions.

**When:** Always. This is the core orchestration pattern.

**Why:** The PRD describes a clear sequential lifecycle (birth -> roles -> interaction -> death -> next). A state machine makes each phase explicit, debuggable, and resilient to partial failures. If a citizen agent crashes, you know exactly which phase you're in and can handle recovery.

**Example:**
```typescript
type GenerationPhase =
  | 'init'
  | 'birthing'
  | 'interacting'
  | 'dying'
  | 'transmitting'
  | 'complete';

interface GenerationState {
  generation: number;
  phase: GenerationPhase;
  citizens: CitizenState[];
  transmissions: Transmission[];
  parameters: SimulationParameters;
}

// Transitions are explicit functions
async function transitionTo(
  state: GenerationState,
  nextPhase: GenerationPhase
): Promise<GenerationState> {
  bus.emit('generation:phase-changed', {
    generation: state.generation,
    from: state.phase,
    to: nextPhase,
  });
  // Each phase handler does its work and returns updated state
  return phaseHandlers[nextPhase](state);
}
```

**Confidence:** HIGH -- State machines for lifecycle management are a universally validated pattern in simulation engines and game loops.

### Pattern 2: Context-as-Age Proxy

**What:** Track cumulative context tokens used by each citizen agent across their turns. Use context percentage (tokens used / max context) as the aging proxy that drives death profile triggers, transmission timing, and cancer degradation onset.

**When:** Every citizen turn. The Mortality Engine updates context tracking after each agent execution.

**Why:** The PRD specifies context as the aging mechanism. LLM agents don't have biological age, but their context window is a natural bounded resource. Using context percentage to trigger lifecycle events (peak transmission at 40-50%, elder transmission at 85-90%, death at 100%) creates an organic simulation of mortality within the LLM execution model.

**Example:**
```typescript
interface ContextTracker {
  citizenId: string;
  maxTokens: number;
  usedTokens: number;
  get contextPercentage(): number; // usedTokens / maxTokens

  // Returns lifecycle events triggered by this update
  recordTurn(tokensUsed: number): LifecycleEvent[];
}

// Lifecycle events triggered at context thresholds
type LifecycleEvent =
  | { type: 'peak-window-entered' }   // 40% context
  | { type: 'peak-window-exited' }    // 50% context
  | { type: 'elder-window-entered' }  // 85% context
  | { type: 'cancer-onset'; degradationRate: number }
  | { type: 'death-triggered'; profile: DeathProfile };
```

**Confidence:** HIGH -- This is a novel pattern specific to LLM simulation (not from existing literature), but it follows directly from the PRD's design and is the only sensible proxy for "aging" in an LLM agent.

### Pattern 3: Mutation Pipeline as Composable Transforms

**What:** Model the mutation system as a pipeline of composable, pure transformation functions. Each mutation type (small drift, large inversion, generative, cancer propagation) is an independent step that receives a transmission and returns a (possibly mutated) transmission.

**When:** Between generations, when transmissions pass from the Transmission System to the Inheritance Composer.

**Why:** The pipeline pattern makes each mutation type independently testable, configurable, and orderable. Mutation rates from SimulationParameters control which pipeline steps fire and how aggressively. Cancer propagation can be modeled as a special mutation step that checks for cancer flags and compounds corruption.

**Example:**
```typescript
type MutationStep = (
  transmission: Transmission,
  params: SimulationParameters,
  rng: () => number
) => Transmission;

const smallDrift: MutationStep = (t, params, rng) => {
  if (rng() > params.mutationRate) return t; // no mutation
  // Apply small drift to content
  return { ...t, content: applyDrift(t.content), mutationHistory: [...t.mutationHistory, 'small-drift'] };
};

const pipeline: MutationStep[] = [smallDrift, largeInversion, generativeMutation, cancerPropagation];

function applyMutationPipeline(
  transmission: Transmission,
  params: SimulationParameters,
  rng: () => number
): Transmission {
  return pipeline.reduce((t, step) => step(t, params, rng), transmission);
}
```

**Confidence:** HIGH -- Pipeline/chain-of-responsibility is a well-established pattern. Multiple sources confirm its applicability to data transformation chains.

### Pattern 4: Staged Delivery via Lazy Composition

**What:** The Inheritance Composer does not build all three inheritance layers at birth. It builds the seed layer at birth, defers the recent layer until the citizen reaches maturity (20-30% context), and the archive is only built on explicit request. Each layer is computed lazily when needed.

**When:** During citizen lifecycle, triggered by context thresholds.

**Why:** This matches the PRD's staged delivery model and avoids wasting computation building layers that most citizens never access (the PRD says "Most agents never access the archive"). Lazy computation also reduces initial context size for newborn agents, giving them room to develop original thought before being overwhelmed with inherited knowledge.

**Example:**
```typescript
interface InheritancePackage {
  seed: ComposedLayer;         // Always built at birth
  recent: () => ComposedLayer; // Built lazily at maturity threshold
  archive: () => ComposedLayer; // Built lazily on explicit request
}

function composeInheritance(
  allTransmissions: Transmission[],
  currentGeneration: number,
  params: SimulationParameters
): InheritancePackage {
  return {
    seed: composeSeedLayer(allTransmissions, params),
    recent: () => composeRecentLayer(allTransmissions, currentGeneration, params),
    archive: () => composeArchiveLayer(allTransmissions),
  };
}
```

**Confidence:** MEDIUM -- Lazy evaluation is standard, but the specific layer decomposition is novel to this project. The PRD is clear on the three layers, so confidence in the requirement is high; confidence in exact implementation is medium.

### Pattern 5: Seeded RNG for Reproducibility

**What:** All random decisions (death profile assignment, mutation application, accident timing, cancer onset) use a seeded pseudo-random number generator rather than `Math.random()`. The seed is part of SimulationParameters.

**When:** Every random decision throughout the simulation.

**Why:** Reproducibility is essential for a simulation engine. Without seeded RNG, you cannot replay a run, debug an interesting emergence event, or verify that a code change didn't break behavior. This is standard practice in all simulation and game engines.

**Example:**
```typescript
// Use a simple but effective PRNG (e.g., mulberry32 or xorshift128)
function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (state >>> 0) / 0xFFFFFFFF;
  };
}
```

**Confidence:** HIGH -- This is a universally validated best practice for simulation engines. Game loop pattern literature is unanimous on this.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Component Coupling

**What:** Components calling each other's methods directly rather than communicating through the event bus or through the Generation Manager as orchestrator.

**Why bad:** Tight coupling makes it impossible to add new observers (like Genesis's Interpreter), replace subsystems, or test components in isolation. The cultural evolution literature emphasizes that simulation components must be independently configurable because parameters change between runs.

**Instead:** Components emit events and return data. The Generation Manager orchestrates by calling components in sequence and passing results between them. Other components observe via the event bus.

### Anti-Pattern 2: God Object Generation Manager

**What:** Putting all logic into the Generation Manager -- mortality checks, transmission writing, mutation application, inheritance composition.

**Why bad:** The Generation Manager becomes impossible to test, modify, or understand. Each subsystem (mortality, transmission, mutation, inheritance) has distinct, well-defined responsibilities from the PRD.

**Instead:** Generation Manager is a thin orchestrator that delegates to specialized components. It knows the lifecycle order (birth -> interact -> die -> transmit) but doesn't know how death profiles work or how mutations apply. Each subsystem is a separate module with its own tests.

### Anti-Pattern 3: Mutable Shared State

**What:** Multiple components reading and writing to the same in-memory state objects without coordination.

**Why bad:** Race conditions in async code, impossible to reason about state at any point, and violates the atomic write pattern from Genesis. The AgentSociety research demonstrates that large-scale agent simulations require clear state ownership boundaries.

**Instead:** State flows through the pipeline. Each component receives immutable input and returns new output. Persistence happens through StateManager with atomic writes. The Generation Manager holds the canonical state for the current generation.

### Anti-Pattern 4: Untracked Randomness

**What:** Using `Math.random()` for any simulation decision (death profile assignment, mutation application, accident timing).

**Why bad:** Cannot reproduce runs. Cannot debug interesting emergence events. Cannot verify correctness. Every simulation engine reference emphasizes this.

**Instead:** Seeded PRNG passed explicitly to all components that need randomness (see Pattern 5).

### Anti-Pattern 5: Blocking on LLM Calls Without Timeout

**What:** Calling the Agent SDK's `query()` without timeout handling, causing the simulation to hang indefinitely if an agent gets stuck.

**Why bad:** LLM calls can hang, error, or produce unexpectedly long responses. One stuck agent blocks the entire sequential simulation.

**Instead:** Wrap every Agent SDK call with a timeout. On timeout, treat as an "accident death" -- the agent died mid-thought. Capture whatever output exists as an accident artifact.

## Key Architecture Decisions

### Decision 1: LINEAGE Owns Its Own Event Bus Instance

**Rationale:** While LINEAGE uses the same EventEmitter3 library and event pattern as Genesis, LINEAGE should create its own bus instance for the simulation. The `@genesis/shared` singleton bus is for Genesis-level events (agent:spawned, state:written). LINEAGE events (citizen:born, citizen:died, transmission:mutated) are simulation-specific.

**Integration:** When Genesis eventually observes LINEAGE, it can subscribe to LINEAGE's bus or LINEAGE can bridge specific events to the Genesis bus. But the simulation should not pollute the Genesis event namespace during standalone execution.

**Confidence:** MEDIUM -- The PRD says "compose with Genesis event bus." This could mean using the same instance or the same pattern. For standalone v1, a separate instance is cleaner. Revisit at Genesis integration time.

### Decision 2: State Persistence Per Generation

**Rationale:** Each generation's state should be persisted as a separate JSON file (e.g., `state/generation-001.json`, `state/generation-002.json`). This creates a natural archaeological record that the Inheritance Composer can reference, and it means a crash mid-generation only loses the current generation, not all prior state.

**Structure:**
```
state/
  simulation.json         <- SimulationParameters + run metadata
  generation-001.json     <- Gen 1 complete state (citizens, transmissions, metrics)
  generation-002.json     <- Gen 2 complete state
  transmissions/
    gen-001/
      citizen-abc-peak.json
      citizen-def-elder.json
      collective.json
    gen-002/
      ...
```

**Confidence:** HIGH -- File-per-generation with atomic writes follows Genesis's StateManager pattern and provides natural crash recovery boundaries.

### Decision 3: Agent Execution Wraps Genesis AgentRunner

**Rationale:** LINEAGE citizens are Claude Agent SDK agents. Rather than reimplementing execution, LINEAGE should wrap the Genesis `AgentRunner.fromConfig()` with citizen-specific behavior: context tracking, lifecycle event hooks, and role-specific system prompts.

A `CitizenRunner` wraps `AgentRunner`, adding:
- Context token tracking per turn (aging proxy)
- Lifecycle event emission (citizen:born, citizen:died)
- Death profile checking after each turn
- Transmission triggering at context thresholds

**Confidence:** HIGH -- The Genesis AgentRunner source code confirms it's designed for composition (config-driven, event-emitting, no hardcoded behavior).

### Decision 4: Mutation Is LLM-Powered, Not String Manipulation

**Rationale:** Mutations should use the LLM itself to corrupt transmissions, not regex or string replacement. A "small drift" mutation means asking Claude to "slightly paraphrase this, making one claim less precise." A "large inversion" means "take one claim and invert its meaning." This produces semantically meaningful mutations rather than syntactic noise.

This is more expensive (one LLM call per mutation) but produces dramatically better simulation quality. For the hackathon, mutations can be batched (mutate all transmissions in one prompt) to reduce call count.

**Confidence:** MEDIUM -- This is the right approach for quality but adds cost and latency. A fallback of template-based mutations (find/replace patterns) should exist for testing without LLM calls.

## Suggested Build Order (Dependencies)

Build order is driven by dependency analysis. Components at the bottom of the dependency graph must be built first.

```
Phase 1: Foundation (no simulation dependencies)
  schemas/     -- Zod schemas extending @genesis/shared (everything depends on these)
  events/      -- LineageEvents type definitions (everything emits events)

Phase 2: Core Engine (depends on schemas + events)
  mortality/   -- Death profiles, context tracking (no other LINEAGE deps)
  metrics/     -- Metric computation (pure functions, no other LINEAGE deps)

Phase 3: Knowledge Flow (depends on schemas + events + mortality)
  transmission/  -- Transmission writers (needs mortality for death profile context)
  mutation/      -- Mutation pipeline (needs transmission types)
  inheritance/   -- Inheritance composer (needs mutation output types)

Phase 4: Orchestration (depends on everything above)
  generation/    -- Generation Manager that wires all components together
  CLI entry point that drives the generation loop
```

**Build order rationale:**
1. **Schemas first** because every component imports types. Cannot build anything without shared types.
2. **Events first** because every component emits events. Event types define the system's observable surface.
3. **Mortality before Transmission** because transmission timing depends on mortality's context tracking (peak at 40-50%, elder at 85-90%).
4. **Transmission before Mutation** because mutations transform transmissions.
5. **Mutation before Inheritance** because inheritance receives mutated transmissions.
6. **Generation Manager last** because it orchestrates all other components. Building it last means all dependencies are available and tested.
7. **Metrics can be built in parallel** with Phase 2 or 3 because it's pure computation over data structures defined in schemas.

### Dependency Graph

```
schemas ─────────────────────────────────────┐
   |                                          |
events ──────────────────────────────────┐    |
   |                                     |    |
mortality ──────────┐                    |    |
   |                |                    |    |
transmission ───────┤                    |    |
   |                |                    |    |
mutation ───────────┤                    |    |
   |                |                    |    |
inheritance ────────┤                    |    |
   |                |                    |    |
metrics ────────────┤                    |    |
   |                |                    |    |
generation ─────────┴────────────────────┴────┘
   |
   v
CLI / Simulation Runner
```

## Scalability Considerations

| Concern | 3 Generations (v1 demo) | 10 Generations | 50+ Generations |
|---------|------------------------|----------------|-----------------|
| **LLM calls** | ~15 citizen calls + ~15 mutation calls = ~30 total | ~50 citizen + ~50 mutation = ~100 total | Need batched mutations, possibly cached inheritance |
| **State size** | ~30 JSON files, trivially small | ~100 JSON files, still fine on disk | May need indexed archive, not flat files |
| **Inheritance composition** | Compress 1 generation's transmissions | Compress 3-5 generations, manageable | Need hierarchical compression: summarize summaries |
| **Metric computation** | Trivial scan | Linear scan, still fast | Need incremental metrics (compute delta, not full re-scan) |
| **Memory** | All state fits in memory | All state fits in memory | May need to stream from disk, lazy-load older generations |

For the 48-hour hackathon target of 3 generations with 5 citizens each, none of these scaling concerns are relevant. The architecture supports scaling without rewrite because: (1) the pipeline is composable (add caching steps), (2) state is per-generation on disk (lazy-loadable), and (3) metrics are pure functions (can be made incremental).

## Integration with Genesis

LINEAGE is designed to be movable into Genesis as `packages/lineage/` with minimal friction:

| LINEAGE Component | Genesis Integration Point | How |
|-------------------|--------------------------|-----|
| Schemas | Extend `@genesis/shared` schemas | Already planned: `AgentConfigSchema.extend()` |
| Events | Compose with `GenesisEvents` | TypeScript interface extension or event bridging |
| State | Use `StateManager` from `@genesis/shared` | Already uses same atomic write pattern |
| Agent execution | Wrap `AgentRunner` from `@genesis/engine` | `CitizenRunner` delegates to `AgentRunner` |
| Metrics | Feed Genesis Interpreter | Metrics as JSON files readable by Interpreter |
| Parameters | Mutable by Genesis Interpreter | SimulationParameters as JSON file, modified at generation boundaries |

## Sources

- [Stanford Generative Agents (Park et al. 2023)](https://arxiv.org/abs/2304.03442) -- Memory stream + reflection + planning architecture for believable agent simulation. HIGH confidence.
- [AgentSociety: Large-Scale LLM Simulation](https://arxiv.org/abs/2502.08691) -- Modular layered architecture for 10k+ agent simulation with persistent memory and async execution. MEDIUM confidence (different scale/goals but validated patterns).
- [Four Design Patterns for Event-Driven Multi-Agent Systems (Confluent)](https://www.confluent.io/blog/event-driven-multi-agent-systems/) -- Pub/sub patterns for decoupled agent communication. HIGH confidence.
- [Game Loop Pattern (Game Programming Patterns)](https://gameprogrammingpatterns.com/game-loop.html) -- Fixed-step simulation loops with state machines. HIGH confidence.
- [Pipeline Pattern in TypeScript](https://dev.to/wallacefreitas/the-pipeline-pattern-streamlining-data-processing-in-software-architecture-44hn) -- Composable transformation chains for data processing. HIGH confidence.
- [Cultural Transmission Between and Within Generations (Acerbi & Parisi)](https://jasss.soc.surrey.ac.uk/9/1/9.html) -- Agent-based models of inter-generational vs intra-generational knowledge transmission. MEDIUM confidence (academic simulation, different domain but relevant transmission patterns).
- [Knowledge Transmission and Improvement Across Generations (AAMAS 2022)](https://www.ifaamas.org/Proceedings/aamas2022/pdfs/p163.pdf) -- Oblique + horizontal transmission models in agent populations. MEDIUM confidence.
- [LLM-based Multi-Agent Systems Survey](https://arxiv.org/abs/2402.01680) -- Comprehensive survey of LLM multi-agent architectures, role assignment, and communication patterns. HIGH confidence.
- Genesis `@genesis/shared` source code -- Direct inspection of StateManager, event bus, and schema patterns. HIGH confidence (primary source).
- Genesis `@genesis/engine` AgentRunner source code -- Direct inspection of Agent SDK integration pattern. HIGH confidence (primary source).
