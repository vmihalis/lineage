# Project Research Summary

**Project:** LINEAGE
**Domain:** AI agent civilization simulator with mortality-driven knowledge evolution
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

LINEAGE is a generational AI agent civilization simulator where Claude-powered citizens are born, think, transmit knowledge, and die -- with context window exhaustion serving as biological aging. The system combines three architectural patterns: a simulation loop (game engine tick per generation), an event-driven backbone (typed pub/sub for observability and future Genesis integration), and a pipeline-based transformation layer (mutations and inheritance composition as composable pure functions). The recommended stack is lean: the Claude Agent SDK for agent execution, Commander for CLI, chalk/ora for terminal output, and Zod 4 for schema validation -- all running as a TypeScript ESM package within or alongside the Genesis monorepo with no build step.

The recommended approach is strict dependency-order construction: schemas and events first, then the mortality engine (context-as-lifespan tracking), then the transmission/mutation/inheritance pipeline, and finally the generation manager that orchestrates everything. The 48-hour hackathon demands ruthless prioritization -- the MVP is 3 generations of 3-5 citizens with visible transmissions, at least one death, and basic mutation. Cancer simulation, civilization metrics, and Genesis integration are explicitly deferred. The core thesis -- "does mortality change what a mind produces?" -- is demonstrable with just old-age and accident death profiles, peak transmission, and small/large mutation.

The five critical risks are: (1) iterative LLM generation destroying information through the "broken telephone" effect before your mutation pipeline even runs, (2) imprecise context-window tracking causing agents to miss peak transmission windows or crash instead of dying gracefully, (3) cost explosion from uncontrolled agent calls during rapid development iteration, (4) the 17x error amplification trap where one confused citizen poisons an entire generation chain, and (5) the hackathon scope trap of building fascinating subsystems (cancer, generative mutations) before the boring-but-critical generation loop works end-to-end. All five have concrete prevention strategies documented in the pitfalls research.

## Key Findings

### Recommended Stack

LINEAGE inherits most infrastructure from the Genesis monorepo (TypeScript 6.0, Zod 4, EventEmitter3, nanoid, Vitest 4, pnpm, Turbo). It installs only simulation-specific dependencies: the Claude Agent SDK for agent execution, Commander v14 for CLI parsing, chalk v5 and ora v9 for terminal output, cli-table3 for generation summaries, and log-update for streaming event display. No build step -- TypeScript sources are imported directly following the Genesis pattern. Development uses tsx for execution.

**Core technologies:**
- **Claude Agent SDK** (^0.2.81): Agent execution via `query()` with streaming, per-role system prompts, `maxTurns` for mortality, `permissionMode: "dontAsk"` for headless operation
- **Commander** (^14.0.0): CLI argument parsing for seed problem, generation count, and config path -- lightweight, excellent TypeScript generics
- **Zod** (^4.3.6): Schema validation at all component boundaries, extending `@genesis/shared` types for Genesis compatibility
- **chalk + ora + cli-table3**: Terminal output stack -- the demo IS the terminal stream, not a dashboard

**Critical version constraint:** Claude Agent SDK peer-depends on Zod 4 (not Zod 3). All ESM-only packages (chalk 5, ora 9, log-update 6) require `"type": "module"` in package.json.

### Expected Features

**Must have (table stakes -- simulation does not work without these):**
- Agent Lifecycle Engine with context-window-as-lifespan
- Death Profile Assignment (5 types, hidden, weighted random at birth)
- Death Execution for old age and accident (simplest two profiles)
- Turn-based sequential interaction within generations
- Role System (5 roles as system prompt templates)
- Peak Transmission at 40-50% context usage
- Basic Mutation Pipeline (small drift + large inversion, LLM-powered)
- Inheritance Composer with seed + recent layers
- Generation Manager orchestrating the full lifecycle loop
- Simulation Config with Zod validation
- Event Emission + Terminal Output for real-time observability
- Gen 1 Protection (shield founders from random death)

**Should have (differentiators -- add after core loop works):**
- Cancer Death Profile (degraded reasoning injection)
- Elder and Young Death Execution
- Elder Transmission (late-life fragmentary output at 85-90% context)
- Collective Transmission (per-generation shared artifact)
- Generative Mutation (corrupted ideas producing something new)
- Archive Inheritance Layer (full archaeological record)
- Civilization Metrics (knowledge survival, seed progress, corruption level, diversity)

**Defer (v2+ / Genesis integration):**
- Genesis Parameter Modification (Interpreter modifying simulation params)
- Institutional Development Detection
- Emergence Event Detection
- Dashboard Visualization
- Parallel Citizen Execution
- Multi-Run Comparison

**Anti-features (deliberately NOT building):**
- Parallel agent execution within generations (destroys turn-based narrative)
- Agent-to-agent real-time chat (wrong interaction model)
- Persistent agent memory beyond context window (undermines mortality thesis)
- Fitness-based selection (random death is environmental pressure, not quality filter)
- Agent self-awareness of death profile (hidden death is the design)
- Web dashboard / UI (terminal output IS the demo for the hackathon)

### Architecture Approach

The architecture is a sequential turn-based simulation engine with three combined patterns: a game-loop-style Generation Manager driving discrete generation ticks, an EventEmitter3 pub/sub bus for decoupled observability, and a pipeline of composable pure transformation functions for mutation and inheritance composition. Components are strictly separated with the Generation Manager as a thin orchestrator delegating to specialized subsystems: Mortality Engine, Transmission System, Mutation Pipeline, Inheritance Composer, and Civilization Metrics.

**Major components:**
1. **Simulation Runner** -- CLI entry point, outer generation loop, parameter loading
2. **Generation Manager** -- Orchestrates one generation lifecycle as a state machine (INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE)
3. **Mortality Engine** -- Hidden death profile assignment, context-as-age tracking, death condition triggers
4. **Transmission System** -- Writes peak/elder/accident/collective transmission artifacts at lifecycle thresholds
5. **Mutation Pipeline** -- Composable LLM-powered corruption transforms applied between generations
6. **Inheritance Composer** -- Assembles staged knowledge layers (seed at birth, recent at maturity, archive on request) with lazy evaluation
7. **Civilization Metrics** -- Computes feedback signals at generation boundaries

**Key architectural decisions:**
- LINEAGE owns its own event bus instance (separate from Genesis bus for standalone operation)
- State persisted per-generation as separate JSON files (natural crash recovery boundaries)
- All randomness via seeded PRNG for reproducibility
- LLM-powered mutations (semantic transformation, not string manipulation)
- Structured handoffs between citizens to limit error propagation

### Critical Pitfalls

1. **Broken Telephone Effect** -- Iterative LLM generation destroys information independently of your mutation pipeline. LLMs flatten nuance and converge on platitudes across generations. Prevent with: temperature 0 for transmission writing, structured output format with anchor tokens, and testing the telephone game in isolation before building mutations.

2. **Context-as-Lifespan Accounting Imprecision** -- Token counting is an estimate, system prompts and SDK overhead consume hidden context, and prompt caching complicates the mental model. Prevent with: a `ContextBudget` abstraction separating system overhead from citizen life tokens, 15-20% safety buffer on all thresholds, and empirical testing of tracking accuracy.

3. **Cost Explosion** -- 15+ citizen agent calls per run, each with growing context, compounded by rapid development iteration. Prevent with: `total_cost_usd` tracking from day one, configurable cost ceiling, Haiku for dev/Sonnet for demos, dry-run mode with canned responses, and starting with 3 citizens x 2 generations during development.

4. **17x Error Amplification** -- One confused citizen poisons every downstream citizen in the turn-based chain, compounding across generations. Prevent with: structured handoffs between citizens (JSON claims, not raw prose), limiting what each citizen sees from predecessors, and monitoring for echo chambers.

5. **Hackathon Scope Trap** -- Building fascinating subsystems (cancer, generative mutations, metrics) before the boring-but-critical generation loop works. Prevent with: strict dependency-order implementation, "demo-ready" defined as 3 generations with visible transmissions and one death, and 4-hour time-box per subsystem.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Project Scaffolding and Agent SDK Integration
**Rationale:** Authentication and basic agent execution are blocking dependencies for everything else. Pitfall 4 (auth failures) and Pitfall 9 (scope trap) both demand this comes first. Nothing else works until a single citizen agent can execute and produce output.
**Delivers:** Working project structure, installed dependencies, validated Agent SDK authentication, a single citizen agent that executes with a system prompt and returns streamed output, basic CLI entry point with Commander.
**Addresses:** Seed Problem CLI, Simulation Config (initial schema), Event Emission (type definitions)
**Avoids:** Pitfall 4 (auth failures), Pitfall 9 (scope trap -- front-loads the unknown-unknown)

### Phase 2: Mortality Engine and Context Tracking
**Rationale:** The mortality engine is the foundation dependency for transmission timing (peak at 40-50%, elder at 85-90%) and death execution. Without accurate context tracking, transmission windows are meaningless. Architecture research places this in the "Core Engine" build layer.
**Delivers:** Death profile assignment (5 types, weighted random, seeded RNG), `ContextBudget` abstraction with safety buffers, context-as-age tracking per citizen turn, death condition detection for old age and accident profiles.
**Addresses:** Agent Lifecycle Engine, Death Profile Assignment, Death Execution (Old Age + Accident), Gen 1 Protection
**Avoids:** Pitfall 2 (context tracking imprecision), Pitfall 8 (untracked randomness via seeded PRNG)

### Phase 3: Generation Loop and Turn-Based Interaction
**Rationale:** The Generation Manager is the orchestrator that ties mortality to execution. It must work as a state machine before transmission or mutation can be tested. Build with stub citizens first (canned responses) to validate the lifecycle without LLM cost.
**Delivers:** Generation state machine (INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE), sequential citizen execution within a generation, role assignment from config, terminal output of birth/death/turn events, dry-run mode with canned responses.
**Addresses:** Turn-Based Interaction, Role System, Generation Manager, Terminal Output
**Avoids:** Pitfall 5 (error amplification -- design structured handoffs here), Pitfall 9 (generation loop before fancy features), Pitfall 3 (dry-run mode avoids cost during development)

### Phase 4: Transmission System
**Rationale:** Transmissions are the "genetic material" of the civilization. They depend on the mortality engine for timing (context thresholds) and the generation loop for orchestration. The broken telephone effect must be addressed here through structured output format.
**Delivers:** Peak transmission writer triggered at 40-50% context, structured transmission format with anchor tokens and numbered claims, transmission storage (per-generation file split), basic collective transmission (synthesized from individual citizen outputs).
**Addresses:** Peak Transmission, Collective Transmission (basic), Transmission System
**Avoids:** Pitfall 1 (broken telephone -- structured format with low temperature), Pitfall 7 (per-generation file split from day one)

### Phase 5: Mutation Pipeline and Inheritance Composer
**Rationale:** Mutation and inheritance complete the inter-generational loop. They depend on transmissions existing. Build mutation as composable pure-function transforms. Start with mutation rate 0.0 to verify the simulation works without mutation first, then calibrate empirically.
**Delivers:** Mutation pipeline with small drift and large inversion (LLM-powered), inheritance composer with seed layer (birth) and recent layer (maturity), staged delivery via lazy composition, the complete multi-generation loop running end-to-end.
**Addresses:** Basic Mutation (Small + Large), Inheritance Composer (Seed + Recent layers)
**Avoids:** Pitfall 8 (mutation calibration -- start at 0.0, test empirically), Pitfall 1 (separate designed mutation from LLM-native drift)

### Phase 6: Polish, Advanced Death Profiles, and Metrics
**Rationale:** With the core loop working, add the features that make the demo compelling: cancer simulation (simplified as corrupted input, not degraded reasoning), elder/young death profiles, civilization metrics, and refined terminal output.
**Delivers:** Cancer death profile (corrupted input injection), elder and young death execution, elder transmission, generative mutation, civilization metrics (knowledge survival rate, seed progress, corruption level), polished terminal output with generation summaries.
**Addresses:** Cancer Death Profile, Elder + Young Death Execution, Elder Transmission, Generative Mutation, Civilization Metrics
**Avoids:** Pitfall 6 (cancer tar pit -- implement as corrupted input with 2-hour time-box)

### Phase 7: Genesis Integration Preparation
**Rationale:** Only after standalone LINEAGE works end-to-end. Create the adapter layer for Genesis schema compatibility, bridge events to the Genesis bus, expose simulation parameters as mutable configs, and ensure LINEAGE is movable into the Genesis monorepo as `packages/lineage/`.
**Delivers:** Genesis schema adapter layer, event bus bridging, mutable simulation parameters for Interpreter consumption, workspace-compatible package structure.
**Addresses:** Genesis Parameter Modification (preparation), Integration Surface
**Avoids:** Pitfall 10 (schema coupling fragility -- adapter layer isolates LINEAGE from Genesis changes)

### Phase Ordering Rationale

- **Phases 1-3 before Phases 4-5:** The generation loop must work end-to-end (even with stub citizens) before transmission and mutation are built. This is the single most important ordering decision -- it prevents the hackathon scope trap (Pitfall 9) and ensures the boring-but-critical plumbing is complete first.
- **Mortality before Transmission:** Transmission timing depends on context thresholds managed by the mortality engine. Building transmission without mortality means guessing at timing, which the context tracking pitfall (Pitfall 2) shows is dangerous.
- **Mutation after Transmission:** You cannot mutate what does not exist. More importantly, Pitfall 8 says calibration is empirical -- you need working transmissions to calibrate mutations against.
- **Phase 6 is explicitly last-priority for the hackathon:** Cancer, metrics, and advanced death profiles are high demo value but not required for the core thesis demonstration. A working 3-generation simulation with old-age deaths, peak transmissions, and basic mutation already answers "does mortality change what a mind produces?"
- **Phase 7 is post-hackathon:** Genesis integration is the combination target but not the hackathon deliverable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Mortality Engine):** The `ContextBudget` abstraction requires understanding exact Claude Agent SDK token reporting behavior. Empirical testing needed -- how does `message.usage` report tokens across multi-turn conversations? Does system prompt count? What about cached tokens?
- **Phase 4 (Transmission System):** The broken telephone effect is the highest risk to the project thesis. The structured output format and anchor token strategy need prototyping before full integration. Run the telephone game test in isolation.
- **Phase 5 (Mutation Pipeline):** LLM-powered mutation prompt engineering is unpredictable. Need a standalone mutation test harness before integrating into the pipeline. How does batching mutations in a single prompt compare to individual calls?

Phases with standard patterns (skip deeper research):
- **Phase 1 (Scaffolding):** Standard TypeScript project setup, Agent SDK quickstart docs are sufficient.
- **Phase 3 (Generation Loop):** State machine and sequential execution are well-documented patterns. The architecture research provides clear implementation guidance.
- **Phase 7 (Genesis Integration):** Standard monorepo workspace patterns with adapter layer. No novel technical challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified from installed versions, official docs, and Genesis monorepo inspection. Version compatibility confirmed. |
| Features | HIGH | Feature landscape well-defined by PRD. Table stakes vs differentiators clearly separated. Anti-features are well-reasoned. Comparable systems analysis validates unique positioning. |
| Architecture | HIGH | Three combined patterns (simulation loop, event bus, pipeline) are individually well-established. Component boundaries and data flow are clear. Build order follows dependency analysis. |
| Pitfalls | HIGH | Critical pitfalls backed by peer-reviewed research (ACL 2025 broken telephone, DeepMind 17x error amplification, Affordable Generative Agents cost analysis). Prevention strategies are concrete and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **Context tracking accuracy:** No empirical data on how precisely the Claude Agent SDK reports token usage across multi-turn `query()` calls. The 15-20% safety buffer is a guess. Need to measure variance in practice during Phase 2.
- **LLM mutation quality:** Whether LLM-powered mutations produce meaningfully different results than template-based mutations at hackathon scale (3 generations) is unvalidated. May not matter for the demo but affects long-term viability.
- **Structured handoff format:** The exact JSON schema for citizen-to-citizen structured handoffs is undesigned. Should citizens produce `{claims: [...], confidence: ..., contested_by: [...]}` or something simpler? Needs prototyping in Phase 3.
- **Optimal generation/citizen count for demo:** The PRD targets 5 citizens x 10 generations but the hackathon likely supports 3-5 citizens x 3 generations. The exact sweet spot depends on per-citizen execution time, which depends on context budget, which depends on model choice (Haiku vs Sonnet).
- **Genesis dependency strategy:** Whether to vendor `@genesis/shared` utilities (~100 lines) or maintain the path reference dependency is undecided. Should be resolved in the first hour of Phase 1.
- **Event bus ownership:** Architecture research recommends a separate bus instance for standalone LINEAGE, but the PRD says "compose with Genesis event bus." Needs a decision in Phase 1 that does not preclude Phase 7 integration.

## Sources

### Primary (HIGH confidence)
- Claude Agent SDK npm package (v0.2.81) -- execution model, authentication, streaming, cost tracking
- Claude Agent SDK TypeScript Reference -- https://platform.claude.com/docs/en/agent-sdk/typescript
- Genesis monorepo source code -- direct inspection of `@genesis/shared` and `@genesis/engine`
- Anthropic Token Counting API -- https://platform.claude.com/docs/en/build-with-claude/token-counting
- Anthropic Context Windows Documentation -- https://platform.claude.com/docs/en/build-with-claude/context-windows
- LLM as a Broken Telephone (ACL 2025) -- https://arxiv.org/abs/2502.20258
- Why Your Multi-Agent System is Failing: The 17x Error Trap -- https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/
- Commander.js v14 -- https://github.com/tj/commander.js
- Vitest 4.1 -- https://vitest.dev/blog/vitest-4-1

### Secondary (MEDIUM confidence)
- Stanford Generative Agents (Park et al. 2023) -- https://arxiv.org/abs/2304.03442 -- memory architecture and agent lifecycle patterns
- AgentSociety (Tsinghua, 2025) -- https://arxiv.org/abs/2502.08691 -- large-scale agent simulation architecture
- Affordable Generative Agents -- https://arxiv.org/html/2402.02053v1 -- cost reduction strategies
- Cultural Evolution of Cooperation among LLM Agents -- https://arxiv.org/html/2412.10270v1 -- knowledge evolution across agent generations
- Agent Drift: Behavioral Degradation in Multi-Agent Systems -- https://arxiv.org/abs/2601.04170
- Event-Driven Multi-Agent Systems (Confluent) -- https://www.confluent.io/blog/event-driven-multi-agent-systems/
- Game Loop Pattern -- https://gameprogrammingpatterns.com/game-loop.html

### Tertiary (LOW confidence)
- LLMs Can Get "Brain Rot" -- https://arxiv.org/abs/2510.13928 -- cognitive decline modeling (no direct precedent for LINEAGE's cancer use case)
- OAuth token expiration issues -- https://github.com/anthropics/claude-code/issues/12447 -- anecdotal, behavior may vary by SDK version

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
