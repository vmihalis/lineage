# LINEAGE

## What This Is

A civilization simulator where every citizen is an AI agent that lives, thinks, produces, ages, and dies — passing transmissions forward to the next generation. Citizens work turn-based within their generation, each building on what the previous citizen produced. Over generations, knowledge drifts, mutates, crystallizes, and occasionally corrupts — producing emergent mythology, wisdom traditions, and cultural character that no single agent designed. LINEAGE runs as a standalone simulation package that will eventually plug into Genesis (a self-modifying agentic engine) as the civilization layer beneath its god layer.

## Core Value

Mortality changes what a mind produces. The simulation must demonstrate that urgency, loss, and the knowledge of ending create different thinking than comfort and infinite time.

## Requirements

### Validated

- [x] Agent SDK setup with OAuth authentication for citizen agent calls — Validated in Phase 1: Project Scaffolding and Agent SDK
- [x] Zod schemas extending @genesis/shared types (CitizenConfig, SimulationParameters, etc.) — Validated in Phase 2: Type System, Config, and CLI
- [x] Typed events composing with Genesis event bus (LineageEvents) — Validated in Phase 2: Type System, Config, and CLI
- [x] State persistence via Genesis StateManager with atomic writes — Validated in Phase 2: Type System, Config, and CLI
- [x] Simulation parameters as mutable config (generation size, death distributions, mutation rates, role distributions, etc.) — Validated in Phase 2: Type System, Config, and CLI
- [x] Seed problem passed as CLI argument at launch — Validated in Phase 2: Type System, Config, and CLI
- [x] Configurable number of generations (default 3) — Validated in Phase 2: Type System, Config, and CLI
- [x] Context-as-lifespan tracking with safety buffer and threshold callbacks — Validated in Phase 3: Mortality Engine
- [x] Death profile assignment (old-age/accident) via weighted random selection — Validated in Phase 3: Mortality Engine
- [x] Old-age death with graduated decline signals at 75%, 85%, 95% context — Validated in Phase 3: Mortality Engine
- [x] Accident death with random termination between 30-70% context — Validated in Phase 3: Mortality Engine
- [x] Citizen birth factory creating fully configured citizens with hidden death profiles — Validated in Phase 3: Mortality Engine
- [x] Generation 1 protection from accident death — Validated in Phase 3: Mortality Engine
- [x] Five distinct role system prompts (Builder, Skeptic, Archivist, Elder Interpreter, Observer) with weighted random assignment — Validated in Phase 4: Roles
- [x] System prompts composed with role template + seed problem + generation context + mortality awareness — Validated in Phase 4: Roles
- [x] birthCitizen() produces citizens with non-empty, role-specific system prompts — Validated in Phase 4: Roles
- [x] Turn-based citizen interaction within a generation (each sees previous citizen's output) — Validated in Phase 5: Turn-Based Interaction
- [x] Sequential citizen execution (one at a time) — Validated in Phase 5: Turn-Based Interaction

### Active

- [x] ~~Agent SDK setup with OAuth authentication for citizen agent calls~~ (→ Validated)
- [x] ~~Mortality engine with death profiles (old age, accident) assigned hidden at birth~~ — core mortality implemented in Phase 3 (context-as-lifespan, death profiles, birth factory, death execution thresholds)
- [x] ~~Turn-based citizen interaction within a generation (each sees previous citizen's output)~~ (→ Validated)
- [x] ~~Sequential citizen execution (one at a time)~~ (→ Validated)
- [ ] Transmission system: peak, elder, accident artifacts, cancer flags, collective transmissions
- [ ] Mutation pipeline that corrupts transmissions in transit (small, large, generative, cancer propagation)
- [ ] Inheritance composer with staged delivery (seed layer at birth, recent layer at maturity, archive on request)
- [ ] Generation manager orchestrating cohort lifecycle: birth → roles → interaction → death → next
- [x] ~~5 agent roles (Builder, Skeptic, Archivist, Elder Interpreter, Observer) as config-driven system prompts~~ — Validated in Phase 4: Roles
- [x] ~~Generation 1 protection from random death by default~~ — Validated in Phase 3: Mortality Engine
- [ ] Civilization metrics computation (knowledge survival rate, seed problem progress, corruption level, generational diversity)
- [ ] Real-time event stream output (births, deaths, transmissions, mutations)
- [ ] Generation summary output at each generation boundary

### Out of Scope

- Genesis Interpreter integration — Phases 3-10 of Genesis not built yet, LINEAGE runs standalone for v1
- Dashboard/web UI — terminal output is sufficient for v1
- Parallel citizen execution — sequential is simpler and cheaper for v1
- Inter-citizen real-time communication — turn-based model handles this
- Multiple simultaneous civilizations — one civilization per run for v1

## Context

- **Genesis dependency**: `@genesis/shared` (Phase 1) is stable with 35 passing tests. Provides Zod schemas (AgentConfig, ProblemStatement, OrchestrationGraph, InterpreterState), typed event bus (EventEmitter3), and StateManager with atomic writes.
- **Genesis Phase 2**: AgentRunner, ClaudeClient, SandboxManager, ToolRegistry exist but are being migrated to Agent SDK. LINEAGE uses Agent SDK directly, so this doesn't block.
- **Agent SDK**: `@anthropic-ai/claude-agent-sdk` with OAuth needs to be installed and configured from scratch. This is the execution layer for all citizen agent calls.
- **Genesis path**: `/Users/memehalis/genesis` — LINEAGE imports from `@genesis/shared` and `@genesis/engine` via path reference.
- **Hackathon context**: 48-hour build timeline — optimize for shipping a working demo over architectural perfection.

## Constraints

- **Tech stack**: TypeScript — must match Genesis exactly for monorepo compatibility
- **Timeline**: 48-hour hackathon — ship working demo
- **Agent execution**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) with OAuth — no per-token API billing
- **Schema compatibility**: Must extend Genesis schemas, not fork them
- **Event compatibility**: Must compose with Genesis event bus, not replace it
- **Combination target**: Must be movable into Genesis monorepo as `packages/lineage/` with minimal friction

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Standalone simulation for v1 | Genesis Interpreter (Phases 3-10) not built — can't integrate what doesn't exist | — Pending |
| Turn-based citizen interaction | Each citizen sees previous citizen's work — creates conversation within a generation | — Pending |
| Sequential execution | Simpler, cheaper, easier to debug for v1 — parallel can come later | — Pending |
| Terminal output only | No Genesis dashboard yet, terminal with events + summaries is sufficient | — Pending |
| CLI argument for seed problem | Flexibility to experiment with different seeds without code changes | — Pending |
| Configurable generations (default 3) | Start small, tune up — 3 generations enough to see drift/mutation | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after Phase 5 completion*
