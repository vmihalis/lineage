# Roadmap: LINEAGE

## Overview

LINEAGE is built in strict dependency order: foundation first (scaffolding, types, config), then the subsystems that model mortality, roles, interaction, transmission, mutation, and inheritance, and finally the generation manager that orchestrates them into a civilization lifecycle. The terminal output layer comes last because it wraps everything into the demo experience. Each phase produces a testable increment -- you can verify each subsystem works before wiring it into the whole.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Project Scaffolding and Agent SDK** - TypeScript package with working Agent SDK authentication and a single agent producing output
- [ ] **Phase 2: Type System, Config, and CLI** - Zod schemas, typed events, state persistence, simulation config, and CLI entry point
- [ ] **Phase 3: Mortality Engine** - Context-as-lifespan tracking with old age and accident death profiles assigned hidden at birth
- [ ] **Phase 4: Roles** - Five agent roles as config-driven system prompts with configurable distribution
- [ ] **Phase 5: Turn-Based Interaction** - Sequential citizen execution within a generation with structured handoffs
- [ ] **Phase 6: Transmission System** - Peak transmission at context thresholds with structured format and disk persistence
- [ ] **Phase 7: Mutation Pipeline** - LLM-powered small drift and large inversion mutations applied probabilistically
- [ ] **Phase 8: Inheritance Composer** - Staged knowledge delivery (seed at birth, recent at maturity) for next generation
- [ ] **Phase 9: Generation Manager** - Full lifecycle orchestration as state machine across multiple generations
- [x] **Phase 10: Event Stream and Terminal Output** - Real-time color-coded event stream and generation summaries for demo (completed 2026-03-26)
- [x] **Phase 11: Wire Mortality Engine into Generation Runner** - Operationally activate ContextBudget, death thresholds, and decline signals in generation-runner (completed 2026-03-26)
- [ ] **Phase 12: Wire Config Parameters to Runtime Call Sites** - Replace hardcoded values with config-driven peakTransmissionWindow and recentLayerThreshold

## Phase Details

### Phase 1: Project Scaffolding and Agent SDK
**Goal**: A single Claude agent can be spawned and produce output through the Agent SDK with OAuth authentication
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):
  1. Running `tsx src/index.ts` starts the application without errors
  2. A single agent call via Agent SDK `query()` returns a coherent response with a system prompt
  3. OAuth authentication succeeds without manual token management
  4. The project imports from `@genesis/shared` without resolution errors
**Plans:** 1 plan

Plans:
- [ ] 01-01-PLAN.md -- Scaffold TypeScript package, Agent SDK proof-of-concept, and tests

### Phase 2: Type System, Config, and CLI
**Goal**: All core types are defined with Zod validation, simulation parameters are configurable, and the CLI accepts a seed problem
**Depends on**: Phase 1
**Requirements**: FOUND-04, FOUND-05, FOUND-06, CONF-01, CONF-02, CONF-03, CONF-04
**Success Criteria** (what must be TRUE):
  1. Zod schemas for CitizenConfig, SimulationParameters, and all core types validate correct input and reject malformed input
  2. LineageEvents type definitions exist and emit on an EventEmitter3 bus without errors
  3. State can be persisted to a JSON file and loaded back with identical data
  4. Running `tsx src/cli.ts "What is consciousness?"` parses the seed problem from CLI and loads validated config
  5. All simulation parameters (generationSize, deathProfileDistribution, mutationRate, roleDistribution, etc.) are readable from config
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md -- Zod schemas for all core types and typed LineageEvents event bus
- [ ] 02-02-PLAN.md -- State persistence, config loading, Commander CLI entry point

### Phase 3: Mortality Engine
**Goal**: Citizens are born with hidden death profiles and age through context consumption, with old age and accident deaths executing correctly
**Depends on**: Phase 2
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, LIFE-07
**Success Criteria** (what must be TRUE):
  1. A citizen is created with a role, generation number, and a death profile that is hidden from the citizen's own context
  2. ContextBudget tracks context consumption as a percentage and accounts for SDK overhead with safety buffers
  3. Old age death triggers when context fills gradually, giving the citizen time to observe decline
  4. Accident death triggers at an unpredictable point with no warning, cutting output mid-thought
  5. Generation 1 citizens are protected from random (accident) death by default, and this protection is toggleable via config
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md -- ContextBudget class, death profile assignment, and citizen birth factory
- [ ] 03-02-PLAN.md -- Death execution thresholds for old-age and accident profiles

### Phase 4: Roles
**Goal**: Five distinct agent roles produce observably different output when given the same input
**Depends on**: Phase 3
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-06
**Success Criteria** (what must be TRUE):
  1. Builder role produces output focused on solving the seed problem and generating ideas
  2. Skeptic role produces output that questions and stress-tests inherited claims
  3. Archivist, Elder Interpreter, and Observer roles each produce output consistent with their defined focus
  4. Role distribution is configurable -- changing roleDistribution in config changes which roles appear in a generation
**Plans:** 1 plan

Plans:
- [ ] 04-01-PLAN.md -- Role assignment, system prompts, prompt builder, and birthCitizen integration

### Phase 5: Turn-Based Interaction
**Goal**: Citizens within a generation execute sequentially, each building on what the previous citizen produced
**Depends on**: Phase 4
**Requirements**: INTR-01, INTR-02, INTR-03
**Success Criteria** (what must be TRUE):
  1. Citizens execute one at a time in defined turn order within a generation
  2. Each citizen's input includes the previous citizen's output, creating a visible chain of building on prior work
  3. The sequence of outputs reads as a coherent within-generation narrative (not isolated monologues)
**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md -- TurnOutput schema, handoff formatting, and turn prompt builder with TDD tests
- [ ] 05-02-PLAN.md -- TurnRunner sequential execution with Agent SDK, ContextBudget integration, and barrel exports

### Phase 6: Transmission System
**Goal**: Citizens produce structured peak transmissions at the right moment in their lifespan, persisted to disk
**Depends on**: Phase 5
**Requirements**: TRAN-01, TRAN-02, TRAN-03
**Success Criteria** (what must be TRUE):
  1. When a citizen reaches 40-50% context usage, a peak transmission prompt fires and the citizen distills their best thinking
  2. Peak transmissions use a structured format with anchor tokens (numbered claims, not raw prose)
  3. Transmissions are persisted to disk as files with full metadata (citizenId, generation, role, type, timestamp)
**Plans:** 2 plans

Plans:
- [x] 06-01-PLAN.md -- Anchor token parser and peak transmission prompt builder (TDD pure functions)
- [x] 06-02-PLAN.md -- Transmission executor (Agent SDK call), writer (disk persistence + event), and barrel exports

### Phase 7: Mutation Pipeline
**Goal**: Transmissions are corrupted in transit between generations through LLM-powered semantic transformations
**Depends on**: Phase 6
**Requirements**: MUTN-01, MUTN-02, MUTN-03, MUTN-04
**Success Criteria** (what must be TRUE):
  1. Small mutation produces a transmission where a precise claim becomes slightly less precise (semantic drift, not string mangling)
  2. Large mutation produces a transmission where a core claim inverts meaning (warning becomes instruction)
  3. Mutations are applied probabilistically -- running the same simulation with mutation rate 0.0 produces no mutations
  4. Large mutation probability is configurable independently from the base mutation rate
**Plans:** 1/2 plans executed

Plans:
- [x] 07-01-PLAN.md -- TDD pure functions: mutation prompts, decider, token selection, content reassembly
- [ ] 07-02-PLAN.md -- Mutation executor (Agent SDK call), pipeline orchestrator, and barrel exports

### Phase 8: Inheritance Composer
**Goal**: Next-generation citizens receive staged knowledge from their predecessors at the right moments in their lifespan
**Depends on**: Phase 7
**Requirements**: INHR-01, INHR-02, INHR-03
**Success Criteria** (what must be TRUE):
  1. At birth, a citizen receives a seed layer -- a compressed summary of the civilization's oldest, most repeated knowledge
  2. At maturity (~20-30% context), a citizen receives a recent layer -- fuller detail from the most recent generation's transmissions
  3. Inheritance staging rates are configurable -- changing the config changes when layers are delivered
**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md -- Transmission reader, seed compression prompt builder, seed/recent layer formatters (TDD pure functions)
- [ ] 08-02-PLAN.md -- Seed compression executor (Agent SDK call), inheritance composer orchestrator, and barrel exports

### Phase 9: Generation Manager
**Goal**: The full civilization lifecycle runs autonomously across multiple generations: birth, interaction, death, transmission, and inheritance composing into the next generation
**Depends on**: Phase 8
**Requirements**: GENM-01, GENM-02, GENM-03, GENM-04, GENM-05
**Success Criteria** (what must be TRUE):
  1. A 3-generation simulation runs end-to-end without manual intervention after launch
  2. The generation state machine transitions through INIT, BIRTHING, INTERACTING, DYING, TRANSMITTING, COMPLETE in order
  3. Generation size (citizens per cohort) is configurable and respected
  4. The simulation stops after the configured maximum number of generations
  5. At each generation boundary, inheritance is composed and delivered to the next generation's citizens
**Plans:** 0/2 plans executed

Plans:
- [x] 09-01-PLAN.md -- Generation runner state machine and simulation outer loop with TDD tests
- [ ] 09-02-PLAN.md -- Generation state persistence, barrel exports, and CLI integration

### Phase 10: Event Stream and Terminal Output
**Goal**: Running LINEAGE produces a compelling real-time terminal experience showing births, deaths, transmissions, and mutations as they happen
**Depends on**: Phase 9
**Requirements**: EVNT-01, EVNT-02, EVNT-03
**Success Criteria** (what must be TRUE):
  1. Typed events fire for all major lifecycle moments: citizen:born, citizen:died, citizen:peak-transmission, generation:started, generation:ended, transmission:mutated, inheritance:composed
  2. Terminal output is color-coded and streams in real-time (births, deaths, transmissions, mutations are visually distinguishable)
  3. A generation summary is displayed at each generation boundary showing who lived, who died, what was transmitted, and what mutated
**Plans:** 2/2 plans complete
**UI hint**: yes

Plans:
- [x] 10-01-PLAN.md -- Install display deps, pure event formatters, generation summary builder, and unit tests
- [ ] 10-02-PLAN.md -- EventRenderer class, CLI wiring, integration tests, and visual verification

### Phase 11: Wire Mortality Engine into Generation Runner
**Goal**: The mortality engine (ContextBudget, death thresholds, decline signals) is operationally active in generation-runner — citizens age through context consumption, receive decline signals, and die according to their death profile
**Depends on**: Phase 3, Phase 9
**Requirements**: LIFE-02, LIFE-03, LIFE-04, LIFE-05
**Gap Closure:** Closes HIGH-severity integration gap from v1.0 audit (Phase 3 → Phase 9 unwired)
**Success Criteria** (what must be TRUE):
  1. ContextBudget is instantiated per citizen in generation-runner.ts and tracks context consumption during turns
  2. Death thresholds are created via createDeathThresholds() based on each citizen's death profile at birth
  3. Old-age citizens receive decline signals via getDeclineSignal() injected into their conversation context
  4. Accident-profile citizens are terminated early when their threshold is reached, cutting output mid-thought
  5. All existing 346 tests continue to pass (no regressions)
**Plans:** 1/1 plans complete

Plans:
- [x] 11-01-PLAN.md -- Wire ContextBudget, death thresholds, and decline signals into generation-runner

### Phase 12: Wire Config Parameters to Runtime Call Sites
**Goal**: All config parameters declared in SimulationParametersSchema have runtime effect at their call sites
**Depends on**: Phase 6, Phase 8, Phase 9
**Requirements**: TRAN-01, INHR-03
**Gap Closure:** Closes MEDIUM/LOW-severity integration gaps from v1.0 audit (config params ignored)
**Success Criteria** (what must be TRUE):
  1. generation-runner.ts reads params.peakTransmissionWindow instead of hardcoding 0.45
  2. composeInheritance reads recentLayerThreshold from config and uses it to control recent layer delivery
  3. Changing peakTransmissionWindow or recentLayerThreshold in config produces observable runtime behavior change

Plans:
- [ ] 12-01-PLAN.md -- Replace hardcoded values with config-driven parameters

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffolding and Agent SDK | 0/1 | Planning complete | - |
| 2. Type System, Config, and CLI | 0/2 | Planning complete | - |
| 3. Mortality Engine | 0/2 | Planning complete | - |
| 4. Roles | 0/1 | Planning complete | - |
| 5. Turn-Based Interaction | 0/2 | Planning complete | - |
| 6. Transmission System | 0/2 | Planning complete | - |
| 7. Mutation Pipeline | 1/2 | In Progress|  |
| 8. Inheritance Composer | 0/2 | Planning complete | - |
| 9. Generation Manager | 0/2 | Planned    |  |
| 10. Event Stream and Terminal Output | 1/2 | Complete    | 2026-03-26 |
| 11. Wire Mortality Engine into Generation Runner | 1/1 | Complete    | 2026-03-26 |
| 12. Wire Config Parameters to Runtime Call Sites | 0/1 | Planned | - |
