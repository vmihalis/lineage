# Feature Research

**Domain:** AI agent civilization simulation with mortality, knowledge transmission, and generational evolution
**Researched:** 2026-03-24
**Confidence:** HIGH (core simulation features) / MEDIUM (observability and metrics patterns)

## Feature Landscape

### Table Stakes (Simulation Doesn't Work Without These)

These features are structural requirements. Without any one of them, LINEAGE cannot demonstrate its core thesis that mortality changes what a mind produces.

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| **Agent Lifecycle Engine** | Agents must be born, execute turns, age (context fills), and die. Without lifecycle, there is no mortality. | HIGH | Context-window-as-lifespan is the central metaphor. Track context consumption as a percentage of max tokens. Every agent call increments the "age" counter. |
| **Death Profile Assignment** | Five death types (old age, accident, cancer, young death, elder death) assigned hidden at birth. Without differentiated death, mortality is uniform and uninteresting. | MEDIUM | Random weighted selection from configured distribution. The profile dictates WHEN and HOW the agent terminates, not IF. |
| **Death Execution** | Each death profile must actually terminate the agent at the right moment with the right behavior (accident = mid-sentence cut, cancer = degraded prompts, old age = gradual decline). | HIGH | Cancer is the hardest -- requires injecting degradation into system prompts without the agent knowing. Accident requires interrupting a running agent call. |
| **Turn-Based Interaction** | Citizens within a generation execute sequentially, each seeing the previous citizen's output. Without this, there is no within-generation conversation. | MEDIUM | Simple sequential loop. Each citizen's output becomes part of the next citizen's input context. The turn order matters -- it creates narrative. |
| **Transmission System** | Agents must produce transmissions at defined lifecycle moments (peak at 40-50% context, elder at 85-90%, accident artifact on sudden death). Without transmission, nothing survives death. | HIGH | Peak transmission is the genetic material. The agent must be prompted to distill its best thinking at the right moment. Timing detection based on context percentage. |
| **Mutation Pipeline** | Transmissions must corrupt in transit between generations. Without mutation, knowledge is static and there is no evolution. | MEDIUM | Four mutation types: small drift, large inversion, generative emergence, cancer propagation. Apply probabilistically based on configured rates. LLM-based mutation (ask Claude to corrupt the text) is more interesting than string manipulation. |
| **Inheritance Composer** | New agents must receive accumulated knowledge from prior generations in staged layers (seed at birth, recent at maturity, archive on request). Without inheritance, each generation starts from scratch. | HIGH | The composer must compress and stage N generations of transmissions into digestible layers. This is where context budget management matters most -- you cannot dump everything into a new agent's prompt. |
| **Generation Manager** | Orchestrate the full cohort lifecycle: birth all citizens, assign roles, run interaction loop, collect transmissions, trigger deaths, compose inheritance, advance to next generation. | HIGH | This is the main simulation loop. Must handle the state machine correctly: birth -> role assignment -> turn execution -> transmission collection -> death -> next gen. |
| **Role System** | Five roles (Builder, Skeptic, Archivist, Elder Interpreter, Observer) delivered as system prompt variations. Without differentiated roles, all agents think the same way. | LOW | Config-driven system prompts. Each role shapes HOW the agent engages with the seed problem and inherited knowledge. Distribution is a tunable parameter. |
| **Seed Problem Input** | A single question/challenge passed as CLI argument that the civilization works on across all generations. Without a seed, agents have nothing to work on. | LOW | CLI argument, injected into every agent's context. Simple but foundational. |
| **Simulation Configuration** | All parameters (generation size, death distributions, mutation rates, role distributions, inheritance staging, max generations) must be mutable config, not hardcoded. | MEDIUM | JSON config file validated with Zod schemas. This is the surface Genesis will eventually modify. Even without Genesis, config-driven simulation is essential for experimentation. |
| **Event Emission** | Every significant simulation event (birth, death, transmission, mutation, generation boundary) must emit typed events. Without events, the simulation is a black box. | MEDIUM | EventEmitter3-based typed events matching the LineageEvents interface from the PRD. These feed both terminal output AND future Genesis integration. |
| **Terminal Output** | Real-time human-readable output showing what is happening in the simulation. Without output, you cannot observe emergence. | MEDIUM | Stream events to stdout with formatting. Show births, deaths, transmissions, mutations, and generation summaries. This IS the demo for the 48-hour hackathon. |

### Differentiators (What Makes LINEAGE Unique)

These features are what separate LINEAGE from generic multi-agent frameworks (CrewAI, AutoGen, LangGraph) and from classic ALife simulations (Avida, Tierra, ALIEN). No existing system combines LLM agents with mortality-driven knowledge evolution.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Context-Window-as-Lifespan** | Maps LLM context consumption to biological aging. Not a metaphor -- the agent literally runs out of "life" as its context fills. No other system treats context exhaustion as death. | MEDIUM | Track token usage across turns. Death profiles define different consumption curves (young death = killed at 15-20%, elder = allowed to reach 95%+). |
| **Cancer Death Profile** | Reasoning degrades invisibly. The agent does not know it is corrupted. Its output enters the transmission pool and propagates wrongness across generations. Uniquely terrifying and unique to LLM simulation. | HIGH | Inject degradation into system prompts at a random point (e.g., contradictory instructions, hallucination-inducing context). The agent's output quality degrades without explicit notification. Cancer-flagged transmissions carry warnings the next generation cannot fully trust. |
| **Transmission-at-Peak** | Unlike biological reproduction (at maturity) or most simulations (at death), LINEAGE transmits at cognitive peak -- 40-50% context when the agent is at maximum capability. This is a novel evolutionary mechanic. | MEDIUM | Detect when context usage crosses the peak window. Prompt the agent to produce its most important synthesis. This becomes the primary "genetic material" for the next generation. |
| **LLM-Based Mutation** | Mutations are not string operations. They are LLM-driven semantic transformations. "A precise claim becomes slightly less precise. A name is forgotten but the idea survives." This produces meaningful drift, not random noise. | MEDIUM | Use Claude to rewrite transmissions with controlled degradation. Small mutation = paraphrase with slight information loss. Large mutation = invert a core claim. Generative mutation = reinterpret a corrupted idea as something new. |
| **Knowledge Drift Across Generations** | A precise fact in Gen 1 becomes an origin myth by Gen 7. No other LLM system tracks how knowledge transforms across multiple inheritance cycles. This is cultural evolution, not just agent orchestration. | LOW (emerges from other features) | This is not a feature to build -- it is an emergent property of transmission + mutation + inheritance working together. But it must be OBSERVABLE, which requires metrics. |
| **Civilization Metrics** | Six feedback signals (knowledge survival rate, seed problem progress, corruption level, generational diversity, institutional development, emergence events) that quantify what the civilization is doing. | HIGH | Some metrics are straightforward (count transmissions that survive N generations). Others require LLM evaluation (is the civilization making "progress" on the seed problem?). Institutional development detection is the hardest -- requires recognizing emergent patterns like redundancy or archival behavior. |
| **Generational Character** | Each generation develops a distinct personality based on its composition, deaths, and inherited knowledge. A generation defined by young deaths feels different from one dominated by an elder. | LOW (emerges from other features) | Emerges from role distribution + death profile assignment + inherited context. The generation summary should capture and name this character. |
| **Collective Transmission** | Each generation produces one shared artifact beyond individual transmissions -- a collectively-held understanding of progress. Both individual and collective transmissions mutate and propagate. | MEDIUM | After all citizens in a generation have interacted, synthesize their collective output into a single document. This is the "institutional memory" of the generation. |
| **Gen 1 Protection** | The founding generation is shielded from random death by default, because killing founders destroys original signal before redundancy can develop. This is an opinionated design choice that Genesis can later override. | LOW | Boolean config flag. When true, Gen 1 citizens all live to old age or elder death. Simple but narratively important. |
| **Staged Inheritance Delivery** | Knowledge arrives at different lifecycle moments: axioms at birth, recent history at maturity, full archive on request. This mirrors how humans learn -- you do not get the encyclopedia at birth. | MEDIUM | Three delivery triggers based on context percentage. Seed layer is always compact. Recent layer is medium. Archive is the full archaeological record and most agents should never need it. |

### Anti-Features (Deliberately NOT Building)

These are features that seem appealing but would either undermine LINEAGE's core thesis, blow the 48-hour timeline, or add complexity without proportional value.

| Feature | Why Tempting | Why Problematic | Alternative |
|---------|-------------|-----------------|-------------|
| **Parallel Agent Execution** | Faster simulation, more realistic "simultaneous" existence within a generation. | Destroys the turn-based conversation model that creates within-generation narrative. Adds race conditions, state management complexity. Costs more API calls simultaneously. | Sequential execution IS the design. Each citizen builds on the previous one's output. This is a feature, not a limitation. |
| **Agent-to-Agent Real-Time Chat** | Feels more "social" -- agents talking to each other like the Stanford Generative Agents (Smallville). | LINEAGE is not a social simulation. It is a civilization simulation. The unit of interaction is the turn, not the conversation. Real-time chat would blow context budgets and obscure the transmission mechanic. | Turn-based sequential output where each citizen sees the previous citizen's work. Interaction happens through artifacts, not dialogue. |
| **Web Dashboard / UI** | Prettier than terminal output. Easier to demo. | 48-hour timeline. No Genesis dashboard exists yet. Building a web UI is a separate project. Terminal output with good formatting IS the demo. | Rich terminal output with structured event streams. Color-coded events, generation summaries, ASCII visualization of knowledge flow. |
| **Multiple Simultaneous Civilizations** | Run different seed problems in parallel, compare outcomes. | Multiplies complexity, cost, and state management. One civilization already produces rich output. | One civilization per run. Compare across runs by changing seed problem or config. |
| **Persistent Agent Memory (Generative Agents Style)** | Stanford's memory-stream architecture (Memory + Reflection + Planning) is the gold standard for long-lived agents. | LINEAGE agents are mortal. They do NOT have long-term memory beyond their context window. Memory IS the context window. When it fills, you die. Adding external memory undermines the mortality thesis. | Context window IS the memory. Inheritance IS the external memory, but it belongs to the CIVILIZATION, not the individual. |
| **Fitness-Based Selection** | Classic genetic algorithm: select the "best" transmissions, discard the rest. | LINEAGE explicitly rejects fitness-based selection. Random death is an environmental pressure, not a quality filter. The interesting emergence comes from what the civilization builds to PROTECT against randomness, not from culling bad ideas. | All transmissions enter the pool. Mutation, not selection, drives evolution. The Skeptic role provides quality pressure within a generation, not across generations. |
| **Agent Self-Awareness of Death Profile** | Let agents know how they will die so they can plan accordingly. | Undermines the core design. Hidden death profiles create urgency and surprise. If you know you will die of old age, you do not transmit with urgency. If you know you have cancer, you would self-censor. | Death profiles are hidden. Agents experience mortality as a fact, not a known parameter. They may notice symptoms (declining context) but never know the cause. |
| **Complex Environment / Physics** | ALife systems like ALIEN and Framsticks simulate physics, spatial environments, resource competition. | LINEAGE's environment is conceptual, not spatial. The "environment" is the seed problem and inherited knowledge. Adding physics simulation is scope creep that does not serve the thesis. | The seed problem IS the environment. Knowledge IS the resource. Context window IS the habitat. |
| **Inter-Generation Communication** | Let dead agents "haunt" or advise living ones. | Undermines mortality. Death must be final. The only thing that survives is the transmission, and it mutates. | Transmissions are the ONLY bridge between generations. Dead agents are gone. Their transmissions are all that remain, and those transmissions are unreliable. |
| **Undo/Replay/Branching** | Rewind the simulation, branch at a decision point, compare alternate histories. | Massive state management complexity. Not needed for v1. The simulation is cheap enough to re-run with different parameters. | Re-run the simulation with different config. Each run is a unique history. |
| **Natural Language Config** | "Make the civilization more aggressive" instead of setting mutation_rate: 0.4. | Adds an LLM interpretation layer to config that creates ambiguity. Config should be precise and reproducible. | JSON config with Zod validation. Precise, reproducible, diffable. Genesis's Interpreter can eventually translate its observations into config changes. |

## Feature Dependencies

```
[Seed Problem Input]
    └──feeds──> [Agent Lifecycle Engine]
                    ├──requires──> [Death Profile Assignment]
                    │                  └──requires──> [Death Execution]
                    │                                     ├── old age: gradual context fill
                    │                                     ├── accident: random termination
                    │                                     ├── cancer: degraded prompts
                    │                                     ├── young death: early termination
                    │                                     └── elder death: extended lifespan
                    ├──requires──> [Turn-Based Interaction]
                    │                  └──produces──> citizen output per turn
                    └──requires──> [Role System]
                                       └──shapes──> system prompts per citizen

[Agent Lifecycle Engine] + [Death Execution]
    └──triggers──> [Transmission System]
                       ├── peak transmission (at 40-50% context)
                       ├── elder transmission (at 85-90% context)
                       ├── accident artifact (on sudden death)
                       ├── cancer flag (on degradation detection)
                       └── collective transmission (after generation interaction)

[Transmission System]
    └──feeds──> [Mutation Pipeline]
                    └──produces──> corrupted transmissions

[Mutation Pipeline]
    └──feeds──> [Inheritance Composer]
                    └──produces──> staged knowledge layers
                                       ├── seed layer (birth)
                                       ├── recent layer (maturity)
                                       └── archive (on request)

[Inheritance Composer]
    └──feeds──> [Agent Lifecycle Engine] (next generation)

[Generation Manager] ──orchestrates──> ALL of the above in sequence

[Simulation Configuration] ──parameterizes──> [Generation Manager]
                                               [Death Profile Assignment]
                                               [Mutation Pipeline]
                                               [Role System]
                                               [Inheritance Composer]

[Event Emission] ──observes──> ALL simulation components
    └──feeds──> [Terminal Output]
    └──feeds──> [Civilization Metrics]

[Civilization Metrics] ──computes from──> [Transmission System]
                                          [Mutation Pipeline]
                                          [Inheritance Composer]
                                          [Generation Manager]
```

### Dependency Notes

- **Transmission System requires Agent Lifecycle Engine:** Transmissions are triggered by lifecycle events (reaching peak context, reaching elder context, dying suddenly). Without lifecycle tracking, you cannot know when to trigger transmission.
- **Mutation Pipeline requires Transmission System:** You cannot mutate what does not exist. Transmissions must be produced before they can be corrupted.
- **Inheritance Composer requires Mutation Pipeline:** The composer receives already-mutated transmissions and stages them for the next generation. Without mutation, inheritance would be perfect copies (boring).
- **Generation Manager orchestrates everything:** It is the state machine that drives the simulation loop. Every other feature is a component the Generation Manager calls at the right time.
- **Event Emission is cross-cutting:** Every component emits events. This is not a dependency chain -- it is an observation layer that touches everything.
- **Civilization Metrics requires most features to be running:** Metrics compute aggregate statistics across transmissions, mutations, and generations. They are a late feature that depends on the core loop working first.
- **Cancer Death is the most complex feature:** It requires injecting prompt degradation, detecting corrupted output, flagging transmissions, and propagating corruption through mutation. It has tendrils into lifecycle, transmission, mutation, AND inheritance.

## MVP Definition

### Launch With (v1 -- 48-Hour Hackathon)

Minimum viable simulation that demonstrates the thesis: mortality changes what a mind produces.

- [ ] **Agent Lifecycle Engine** -- Context-window-as-lifespan with turn counting. Without this, nothing else works.
- [ ] **Death Profile Assignment** -- Random weighted assignment of 5 profiles at birth. The hidden death is the soul of the simulation.
- [ ] **Death Execution (Old Age + Accident)** -- Start with the two simplest death types. Old age = context fills gradually. Accident = random termination mid-run.
- [ ] **Turn-Based Interaction** -- Sequential citizen execution within a generation. Each sees previous output.
- [ ] **Role System** -- Five roles as system prompt templates. Config-driven distribution.
- [ ] **Peak Transmission** -- Agents produce their key synthesis at 40-50% context. This is the minimum viable "genetic material."
- [ ] **Basic Mutation (Small + Large)** -- LLM-based semantic corruption of transmissions. Small drift and large inversion. Skip generative and cancer propagation for v1.
- [ ] **Inheritance Composer (Seed + Recent layers)** -- Deliver compressed historical knowledge at birth, recent generation transmissions at maturity. Skip archive layer for v1.
- [ ] **Generation Manager** -- Full lifecycle loop for 3 generations. Birth -> roles -> interaction -> transmission -> death -> inheritance -> next generation.
- [ ] **Simulation Config** -- JSON config with Zod validation for all tunable parameters.
- [ ] **Event Emission + Terminal Output** -- Real-time event stream to terminal showing births, deaths, transmissions, mutations, generation summaries.
- [ ] **Seed Problem CLI** -- Pass the civilization's central question as a command-line argument.
- [ ] **Gen 1 Protection** -- Shield founding generation from random death by default.

### Add After Validation (v1.x)

Features to add once the core simulation loop works and produces interesting output.

- [ ] **Cancer Death Profile** -- Degraded reasoning injection, cancer-flagged transmissions, corruption propagation. Add when the basic death + mutation loop is stable.
- [ ] **Elder + Young Death Execution** -- Extended lifespan and premature death with their distinct transmission patterns. Add when basic lifecycle is proven.
- [ ] **Elder Transmission** -- Late-life fragmentary transmission at 85-90% context. Add when peak transmission is working reliably.
- [ ] **Collective Transmission** -- Per-generation shared artifact synthesized from all citizens' output. Add when individual transmissions work.
- [ ] **Generative Mutation** -- Corrupted ideas that accidentally produce something new. Add when basic mutation pipeline is stable.
- [ ] **Archive Inheritance Layer** -- Full archaeological record available on request. Add when seed + recent layers work.
- [ ] **Civilization Metrics** -- Knowledge survival rate, seed problem progress, corruption level, generational diversity. Add when there are enough generations of data to make metrics meaningful.
- [ ] **Cancer Propagation Mutation** -- Degraded reasoning entering transmission pool and compounding across generations. Add after cancer death profile works.
- [ ] **Accident Artifact** -- Raw unfiltered context dump on sudden death, available as archaeological material. Add when accident death execution is polished.

### Future Consideration (v2+ / Genesis Integration)

Features that belong to the combined Genesis+LINEAGE system, not to standalone LINEAGE v1.

- [ ] **Genesis Parameter Modification** -- Genesis Interpreter observes metrics and modifies simulation parameters at generation boundaries. Requires Genesis Phases 3-10.
- [ ] **Institutional Development Detection** -- Metric that recognizes when civilization develops protective mechanisms (redundancy, archival behavior, verification). Requires sophisticated LLM evaluation.
- [ ] **Emergence Event Detection** -- Automated detection of novel ideas not present in any ancestor transmission. Requires semantic comparison across full transmission history.
- [ ] **Dashboard Visualization** -- Two-timeline view: Genesis architectural evolution (top) + civilization knowledge evolution (bottom). Requires Genesis dashboard infrastructure.
- [ ] **Multi-Run Comparison** -- Compare civilizations across different seeds, configs, or parameter evolutions. Requires persistence and analysis tooling.
- [ ] **Parallel Citizen Execution** -- Run multiple citizens simultaneously within a generation. Only worth the complexity when sequential execution becomes a bottleneck at scale.

## Feature Prioritization Matrix

| Feature | Demo Value | Implementation Cost | Priority |
|---------|-----------|---------------------|----------|
| Agent Lifecycle Engine | HIGH | HIGH | P1 |
| Death Profile Assignment | HIGH | LOW | P1 |
| Death Execution (Old Age + Accident) | HIGH | MEDIUM | P1 |
| Turn-Based Interaction | HIGH | MEDIUM | P1 |
| Role System | MEDIUM | LOW | P1 |
| Peak Transmission | HIGH | MEDIUM | P1 |
| Basic Mutation (Small + Large) | HIGH | MEDIUM | P1 |
| Inheritance Composer (Seed + Recent) | HIGH | HIGH | P1 |
| Generation Manager | HIGH | HIGH | P1 |
| Simulation Config | MEDIUM | LOW | P1 |
| Event Emission | MEDIUM | MEDIUM | P1 |
| Terminal Output | HIGH | MEDIUM | P1 |
| Seed Problem CLI | LOW | LOW | P1 |
| Gen 1 Protection | LOW | LOW | P1 |
| Cancer Death Profile | HIGH | HIGH | P2 |
| Elder Transmission | MEDIUM | LOW | P2 |
| Collective Transmission | MEDIUM | MEDIUM | P2 |
| Generative Mutation | MEDIUM | LOW | P2 |
| Elder + Young Death Execution | MEDIUM | MEDIUM | P2 |
| Archive Inheritance Layer | LOW | MEDIUM | P2 |
| Civilization Metrics | HIGH | HIGH | P2 |
| Cancer Propagation Mutation | MEDIUM | MEDIUM | P2 |
| Accident Artifact | LOW | LOW | P2 |
| Genesis Parameter Modification | HIGH | HIGH | P3 |
| Institutional Development Detection | MEDIUM | HIGH | P3 |
| Emergence Event Detection | MEDIUM | HIGH | P3 |
| Dashboard Visualization | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for 48-hour hackathon demo
- P2: Should have, add when core loop is working
- P3: Future, requires Genesis integration or v2 scope

## Comparable Systems Feature Analysis

| Feature | Stanford Generative Agents | Avida / Tierra | CrewAI / AutoGen | AgentSociety | LINEAGE |
|---------|---------------------------|----------------|-------------------|--------------|---------|
| Agent lifecycle | Persistent (immortal) | Birth/death via memory allocation | Persistent per task | Persistent with daily cycles | Mortal with context-as-lifespan |
| Memory | Memory stream + reflection + retrieval | Genome (instruction set) | Shared memory / context | Emotions, needs, cognition | Context window only (mortality constraint) |
| Knowledge transfer | Conversation (synchronous) | Genetic inheritance (replication) | Task output handoff | Social interaction | Transmission at peak cognition, mutated in transit |
| Death mechanic | None (agents are immortal) | Memory pressure / age-based | None (task completion) | None | 5 differentiated death profiles (hidden) |
| Mutation | None | Copy errors, point mutation | None | Behavioral drift | LLM-based semantic mutation (4 types) |
| Roles | Personality-driven | None (uniform organisms) | Config-driven roles | Occupation-based | 5 config-driven cognitive roles |
| Generations | None (continuous time) | Explicit generations via replication | None (task-based) | Continuous | Explicit cohort-based generations |
| Observability | Visualization sandbox | Data analysis mode | Logging/traces | Large-scale metrics | Event stream + terminal + civilization metrics |
| Configuration | Persona descriptions | Environment parameters | YAML/code config | Scenario config | Mutable JSON config (Genesis-tunable) |
| Selection pressure | Social (reputation) | Fitness-based (resource competition) | Task performance | Social norms | None (random death, no fitness selection) |
| Scale | 25 agents | Millions of organisms | 5-20 agents per crew | 10,000+ agents | 3-10 agents per generation, 3-10 generations |
| Core thesis | Believable behavior | Digital evolution | Task completion | Social dynamics | Mortality changes cognition |

### Key Differentiation

LINEAGE occupies a unique space: it is NOT a social simulation (Stanford), NOT a digital evolution platform (Avida), NOT a task orchestration framework (CrewAI), and NOT a large-scale society model (AgentSociety). It is specifically a **knowledge evolution experiment under mortality pressure** where:

1. **Death is not selection** -- it is environmental pressure that forces institutional development
2. **Memory is finite and fatal** -- context exhaustion IS death, not a constraint to work around
3. **Transmission happens at peak, not at death** -- the "genetic material" is curated cognition, not raw state
4. **Mutation is semantic, not syntactic** -- ideas drift in meaning, they do not flip bits
5. **The question is philosophical, not computational** -- "does mortality change what a mind produces?"

## Sources

- [Generative Agents: Interactive Simulacra of Human Behavior (Stanford, 2023)](https://arxiv.org/abs/2304.03442) -- Memory stream architecture, reflection, and planning for LLM agents
- [Generative Agent Simulations of 1,000 People (Stanford, 2024)](https://arxiv.org/abs/2411.10109) -- Scaling generative agents to population-level simulation
- [AgentSociety: Large-Scale Simulation of LLM-Driven Generative Agents (Tsinghua, 2025)](https://arxiv.org/abs/2502.08691) -- 10k+ agent social simulation with emergent norms
- [Cultural Evolution of Cooperation among LLM Agents (2024)](https://arxiv.org/html/2412.10270v1) -- Knowledge evolution and cooperation across LLM agent generations
- [Avida Digital Evolution Platform](https://alife.org/encyclopedia/digital-evolution/avida/) -- Self-replicating digital organisms with mutation and evolution
- [ALIEN Artificial Life Simulation](https://github.com/chrxh/alien) -- CUDA-powered ALife with physics, neural networks, and evolution
- [Impacts of Drift and Population Bottlenecks on Cultural Transmission (2014)](https://www.sciencedirect.com/science/article/abs/pii/S0305440314001940) -- Agent-based model of cultural drift under different transmission modes
- [CrewAI Multi-Agent Platform](https://crewai.com/) -- Role-based sequential agent orchestration
- [AutoGen and CrewAI Architectures comparison](https://deepwiki.com/ombharatiya/ai-system-design-guide/7.3-autogen-and-crewai-architectures) -- Turn-based vs conversation-driven multi-agent patterns
- [EvoMAS: Evolutionary Generation of Multi-Agent Systems (2025)](https://arxiv.org/html/2602.06511v1) -- Evolutionary framework for MAS configuration optimization
- [AI Agent Observability (IBM)](https://www.ibm.com/think/insights/ai-agent-observability) -- MELT data patterns for agent monitoring
- [Claude Agent SDK Streaming Output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) -- Event streaming patterns for Claude Agent SDK

---
*Feature research for: AI agent civilization simulation with mortality and knowledge evolution*
*Researched: 2026-03-24*
