# Requirements: LINEAGE

**Defined:** 2026-03-24
**Core Value:** Mortality changes what a mind produces -- the simulation must demonstrate that urgency, loss, and the knowledge of ending create different thinking than comfort and infinite time.

## v1 Requirements

Requirements for initial release (48-hour hackathon). Each maps to roadmap phases.

### Project Foundation

- [ ] **FOUND-01**: Project scaffolded as TypeScript package with proper tsconfig extending Genesis patterns
- [ ] **FOUND-02**: Claude Agent SDK installed and configured with working authentication
- [ ] **FOUND-03**: Single agent can be spawned via Agent SDK query() and produce output
- [ ] **FOUND-04**: Zod schemas defined for CitizenConfig, SimulationParameters, and all core types extending @genesis/shared
- [ ] **FOUND-05**: Typed LineageEvents defined and emitting on EventEmitter3 event bus
- [ ] **FOUND-06**: State persistence via JSON files with atomic writes (following Genesis StateManager pattern)

### Agent Lifecycle

- [ ] **LIFE-01**: Citizen agent born with assigned role, generation number, and hidden death profile
- [ ] **LIFE-02**: Context consumption tracked as percentage of max tokens (context-as-age proxy)
- [ ] **LIFE-03**: ContextBudget abstraction with safety buffers accounting for SDK overhead (10-20% imprecision)
- [ ] **LIFE-04**: Old age death profile -- context fills gradually, agent can observe decline, time for careful transmission
- [ ] **LIFE-05**: Accident death profile -- random termination at unpredictable point, no warning, mid-sentence cut
- [ ] **LIFE-06**: Death profiles assigned hidden at birth via weighted random selection from configured distribution
- [ ] **LIFE-07**: Generation 1 protected from random death by default (configurable parameter)

### Roles

- [ ] **ROLE-01**: Builder role -- system prompt focused on seed problem, generating ideas, attempting solutions
- [ ] **ROLE-02**: Skeptic role -- system prompt focused on stress-testing, questioning inherited wisdom
- [ ] **ROLE-03**: Archivist role -- system prompt focused on protecting knowledge, monitoring what's about to be lost
- [ ] **ROLE-04**: Elder Interpreter role -- system prompt helping younger agents understand inheritance
- [ ] **ROLE-05**: Observer role -- system prompt for watching, recording, writing history without solving
- [ ] **ROLE-06**: Role distribution configurable via simulation parameters

### Interaction

- [ ] **INTR-01**: Citizens within a generation execute turn-based sequentially
- [ ] **INTR-02**: Each citizen sees the previous citizen's output as part of their input context
- [ ] **INTR-03**: Turn order creates within-generation narrative (structured handoffs between citizens)

### Transmission

- [ ] **TRAN-01**: Peak transmission triggered at 40-50% context -- agent prompted to distill best thinking
- [ ] **TRAN-02**: Peak transmission uses structured output format with anchor tokens (anti-telephone-effect)
- [ ] **TRAN-03**: Transmission persisted to disk with metadata (citizenId, generation, role, type, timestamp)

### Mutation

- [ ] **MUTN-01**: Small mutation -- LLM-based semantic drift (precise claim becomes slightly less precise, name forgotten but idea survives)
- [ ] **MUTN-02**: Large mutation -- LLM-based semantic inversion (core claim inverts, warning becomes instruction)
- [ ] **MUTN-03**: Mutation applied probabilistically based on configured mutation rate
- [ ] **MUTN-04**: Large mutation probability configurable separately from base mutation rate

### Inheritance

- [ ] **INHR-01**: Seed layer delivered at birth -- compressed summary of civilization's oldest, most repeated knowledge
- [ ] **INHR-02**: Recent layer delivered at maturity (~20-30% context) -- fuller detail of most recent generation's transmissions
- [ ] **INHR-03**: Inheritance staging rates configurable via simulation parameters

### Generation Management

- [ ] **GENM-01**: Generation manager orchestrates full cohort lifecycle: birth -> roles -> interaction -> death -> next
- [ ] **GENM-02**: State machine with clear phases: INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE
- [ ] **GENM-03**: Configurable generation size (citizens per cohort)
- [ ] **GENM-04**: Configurable maximum number of generations (default 3, safety limit)
- [ ] **GENM-05**: Generation boundary triggers inheritance composition for next generation

### Simulation Config

- [ ] **CONF-01**: All simulation parameters as mutable JSON config validated with Zod
- [ ] **CONF-02**: Parameters include: generationSize, deathProfileDistribution, mutationRate, largeMutationProbability, roleDistribution, gen1Protection, peakTransmissionWindow, inheritanceStagingRates, maxGenerations
- [ ] **CONF-03**: Seed problem passed as CLI argument at launch
- [ ] **CONF-04**: CLI entry point using Commander for argument parsing

### Events & Output

- [ ] **EVNT-01**: Typed events emitted for: citizen:born, citizen:died, citizen:peak-transmission, generation:started, generation:ended, transmission:mutated, inheritance:composed
- [ ] **EVNT-02**: Real-time event stream to terminal with color-coded formatting (births, deaths, transmissions, mutations)
- [ ] **EVNT-03**: Generation summary displayed at each generation boundary (who lived, who died, what was transmitted, what mutated)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Death Profiles

- **LIFE-V2-01**: Cancer death profile -- reasoning degrades at random point, responses fragment, agent may not notice
- **LIFE-V2-02**: Young death profile -- dies at fraction of potential lifespan, thin incomplete transmission
- **LIFE-V2-03**: Elder death profile -- lives longer than almost anyone, dense rich transmission

### Advanced Transmission

- **TRAN-V2-01**: Elder transmission at 85-90% context -- fragmentary, pattern-based, wisdom tradition
- **TRAN-V2-02**: Accident artifact -- raw unfiltered context dump on sudden death, available as archaeological material
- **TRAN-V2-03**: Cancer flag -- if degradation detected, transmission marked potentially corrupted with warning
- **TRAN-V2-04**: Collective transmission -- each generation produces one shared artifact of collective understanding

### Advanced Mutation

- **MUTN-V2-01**: Generative mutation -- corrupted idea lands as something new, civilization advances from noise
- **MUTN-V2-02**: Cancer propagation -- degraded reasoning enters transmission, compounds across generations

### Advanced Inheritance

- **INHR-V2-01**: Archive layer -- full archaeological record across all generations with mutation history, available on request

### Observability

- **OBSV-V2-01**: Knowledge survival rate metric (% of gen N transmissions appearing in gen N+3)
- **OBSV-V2-02**: Seed problem progress metric (collective understanding improving, stagnating, or regressing)
- **OBSV-V2-03**: Corruption level metric (inheritance traceable to cancer-corrupted sources)
- **OBSV-V2-04**: Generational diversity metric (approach variation within a generation)
- **OBSV-V2-05**: Institutional development metric (emergent protective mechanisms)
- **OBSV-V2-06**: Emergence events metric (generative mutations, novel ideas)

### Genesis Integration

- **GINT-V2-01**: Simulation parameters exposed as mutable configs for Genesis Interpreter
- **GINT-V2-02**: Civilization metrics as feedback signals to Genesis outer loop
- **GINT-V2-03**: Events bridged to Genesis event bus
- **GINT-V2-04**: Adapter layer for Genesis orchestration graph integration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Web dashboard / UI | No Genesis dashboard exists yet; terminal output sufficient for v1 hackathon demo |
| Parallel agent execution | Destroys turn-based conversation model; adds race conditions and complexity |
| Agent-to-agent real-time chat | LINEAGE is civilization sim, not social sim; interaction through turns, not dialogue |
| Multiple simultaneous civilizations | Multiplies complexity and cost; one civilization per run, compare across runs |
| Persistent agent memory (Stanford style) | Undermines mortality thesis -- context window IS the memory; when it fills, you die |
| Fitness-based selection | LINEAGE rejects selection pressure; random death is environmental, not quality filter |
| Agent self-awareness of death profile | Hidden death creates urgency and surprise; knowing removes the pressure |
| Complex environment / physics | Environment is conceptual (seed problem), not spatial; physics is scope creep |
| Inter-generation communication | Death must be final; transmissions are the only bridge, and they mutate |
| Undo/replay/branching | State management complexity; simulation is cheap enough to re-run with different config |
| Natural language config | Adds ambiguity; JSON with Zod validation is precise and reproducible |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 2 | Pending |
| FOUND-05 | Phase 2 | Pending |
| FOUND-06 | Phase 2 | Pending |
| LIFE-01 | Phase 3 | Pending |
| LIFE-02 | Phase 3 | Pending |
| LIFE-03 | Phase 3 | Pending |
| LIFE-04 | Phase 3 | Pending |
| LIFE-05 | Phase 3 | Pending |
| LIFE-06 | Phase 3 | Pending |
| LIFE-07 | Phase 3 | Pending |
| ROLE-01 | Phase 4 | Pending |
| ROLE-02 | Phase 4 | Pending |
| ROLE-03 | Phase 4 | Pending |
| ROLE-04 | Phase 4 | Pending |
| ROLE-05 | Phase 4 | Pending |
| ROLE-06 | Phase 4 | Pending |
| INTR-01 | Phase 5 | Pending |
| INTR-02 | Phase 5 | Pending |
| INTR-03 | Phase 5 | Pending |
| TRAN-01 | Phase 6 | Pending |
| TRAN-02 | Phase 6 | Pending |
| TRAN-03 | Phase 6 | Pending |
| MUTN-01 | Phase 7 | Pending |
| MUTN-02 | Phase 7 | Pending |
| MUTN-03 | Phase 7 | Pending |
| MUTN-04 | Phase 7 | Pending |
| INHR-01 | Phase 8 | Pending |
| INHR-02 | Phase 8 | Pending |
| INHR-03 | Phase 8 | Pending |
| GENM-01 | Phase 9 | Pending |
| GENM-02 | Phase 9 | Pending |
| GENM-03 | Phase 9 | Pending |
| GENM-04 | Phase 9 | Pending |
| GENM-05 | Phase 9 | Pending |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |
| CONF-04 | Phase 2 | Pending |
| EVNT-01 | Phase 10 | Pending |
| EVNT-02 | Phase 10 | Pending |
| EVNT-03 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
