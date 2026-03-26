# LINEAGE

## What This Is

A civilization simulator where every citizen is a Claude agent that lives, thinks, produces, ages, and dies — passing transmissions forward to the next generation. Citizens work turn-based within their generation, each building on what the previous citizen produced. Over generations, knowledge drifts, mutates, crystallizes, and occasionally corrupts — producing emergent mythology, wisdom traditions, and cultural character that no single agent designed. LINEAGE runs as a standalone simulation package that will eventually plug into Genesis (a self-modifying agentic engine) as the civilization layer beneath its god layer.

## Core Value

Mortality changes what a mind produces. The simulation must demonstrate that urgency, loss, and the knowledge of ending create different thinking than comfort and infinite time.

## Requirements

### Validated

- ✓ Agent SDK setup with OAuth authentication for citizen agent calls — v1.0
- ✓ Zod schemas extending @genesis/shared types (CitizenConfig, SimulationParameters, etc.) — v1.0
- ✓ Typed events composing with Genesis event bus (LineageEvents) — v1.0
- ✓ State persistence via Genesis StateManager with atomic writes — v1.0
- ✓ Simulation parameters as mutable config (generation size, death distributions, mutation rates, role distributions) — v1.0
- ✓ Seed problem passed as CLI argument at launch — v1.0
- ✓ Configurable number of generations (default 3) — v1.0
- ✓ Context-as-lifespan tracking with safety buffer and threshold callbacks — v1.0
- ✓ Death profile assignment (old-age/accident) via weighted random selection — v1.0
- ✓ Old-age death with graduated decline signals at 75%, 85%, 95% context — v1.0
- ✓ Accident death with random termination between 30-70% context — v1.0
- ✓ Citizen birth factory creating fully configured citizens with hidden death profiles — v1.0
- ✓ Generation 1 protection from accident death — v1.0
- ✓ Five distinct role system prompts (Builder, Skeptic, Archivist, Elder Interpreter, Observer) with weighted random assignment — v1.0
- ✓ System prompts composed with role template + seed problem + generation context + mortality awareness — v1.0
- ✓ birthCitizen() produces citizens with role-specific system prompts — v1.0
- ✓ Turn-based citizen interaction within a generation (each sees previous citizen's output) — v1.0
- ✓ Sequential citizen execution (one at a time) — v1.0
- ✓ Peak transmission at context thresholds with structured anchor token format and disk persistence — v1.0
- ✓ Mutation pipeline with small drift and large inversion mutations applied probabilistically via Agent SDK — v1.0
- ✓ Inheritance composer with staged delivery (seed at birth, recent at maturity) with LLM-powered seed compression — v1.0
- ✓ Generation manager orchestrating cohort lifecycle with state machine (INIT→COMPLETE) — v1.0
- ✓ Real-time event stream output with color-coded terminal formatting — v1.0
- ✓ Generation summary table at each generation boundary — v1.0
- ✓ Mortality engine operationally wired into generation runner — v1.0
- ✓ All config parameters wired to runtime call sites — v1.0

### Active

- [ ] Civilization metrics computation (knowledge survival rate, seed problem progress, corruption level, generational diversity)

### Out of Scope

- Genesis Interpreter integration — Phases 3-10 of Genesis not built yet, LINEAGE runs standalone for v1
- Dashboard/web UI — terminal output is sufficient for v1
- Parallel citizen execution — sequential is simpler and cheaper for v1
- Inter-citizen real-time communication — turn-based model handles this
- Multiple simultaneous civilizations — one civilization per run for v1
- Persistent agent memory (Stanford style) — context window IS the memory; when it fills, you die
- Fitness-based selection — LINEAGE rejects selection pressure; random death is environmental, not quality filter
- Agent self-awareness of death profile — hidden death creates urgency and surprise
- Undo/replay/branching — simulation is cheap enough to re-run with different config

## Context

Shipped v1.0 with 7,617 LOC TypeScript (5,250 test code) across 12 phases in 2 days.

**Tech stack:** TypeScript 6, Zod 4, EventEmitter3, Claude Agent SDK, Commander, chalk, ora, cli-table3.

**Architecture:** 12 subsystems built in strict dependency order — schemas → mortality → roles → interaction → transmission → mutation → inheritance → generation manager → display. All Agent SDK calls follow the same pattern: `query()` with `maxTurns: 1`, `permissionMode: 'dontAsk'`, `persistSession: false`.

**Test suite:** 366 tests, 15 test files, TypeScript compiles clean.

**Known tech debt:** Nyquist VALIDATION.md files in draft state, orphaned exports (`runTurns()`, `assignRole()`), human verification needed for narrative coherence and visual quality with live Agent SDK.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Standalone simulation for v1 | Genesis Interpreter not built — can't integrate what doesn't exist | ✓ Good — clean standalone package, easy to move to monorepo later |
| Turn-based citizen interaction | Each citizen sees previous citizen's work — creates conversation within a generation | ✓ Good — produces coherent within-generation narratives |
| Sequential execution | Simpler, cheaper, easier to debug for v1 — parallel can come later | ✓ Good — no race conditions, predictable output |
| Terminal output only | No Genesis dashboard yet, terminal with events + summaries is sufficient | ✓ Good — chalk/ora/cli-table3 produce compelling demo output |
| CLI argument for seed problem | Flexibility to experiment with different seeds without code changes | ✓ Good — Commander with Zod validation works cleanly |
| Configurable generations (default 3) | Start small, tune up — 3 generations enough to see drift/mutation | ✓ Good — sufficient for demo, configurable for longer runs |
| Context-as-lifespan (not token counting) | Percentage-based tracking abstracts away SDK overhead imprecision | ✓ Good — 15-20% safety buffer handles SDK overhead |
| Simplified mortality for v1 | All citizens complete turns then transmit (no mid-conversation death) | ✓ Good — avoids complex state management, still produces mortality effects |
| Strict dependency-order construction | Schemas before engines, engines before orchestrators, display last | ✓ Good — each subsystem independently testable before integration |
| ESM-only with no build step | Matches Genesis pattern, tsx for dev execution | ✓ Good — no build complexity, direct TS imports |
| lineageBus standalone (not Genesis bus) | Standalone operation requirement; can compose at integration time | ✓ Good — clean separation, easy to wire into Genesis later |
| Immutable transmission data flow | Original transmissions never mutated; mutations create new objects | ✓ Good — prevents silent corruption, clean audit trail |

## Constraints

- **Tech stack**: TypeScript — must match Genesis exactly for monorepo compatibility
- **Agent execution**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) with OAuth — no per-token API billing
- **Schema compatibility**: Must extend Genesis schemas, not fork them
- **Event compatibility**: Must compose with Genesis event bus, not replace it
- **Combination target**: Must be movable into Genesis monorepo as `packages/lineage/` with minimal friction

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
*Last updated: 2026-03-26 after v1.0 milestone completion*
