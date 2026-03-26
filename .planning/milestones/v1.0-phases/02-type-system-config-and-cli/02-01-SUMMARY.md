---
phase: 02-type-system-config-and-cli
plan: 01
subsystem: schemas
tags: [zod, eventemitter3, type-system, events, validation]

# Dependency graph
requires:
  - phase: 01-project-scaffolding-and-agent-sdk
    provides: "@genesis/shared with AgentConfigSchema, EventEmitter3, Zod 4, project structure"
provides:
  - "CitizenConfigSchema extending AgentConfigSchema with role, generationNumber, deathProfile"
  - "SimulationParametersSchema with all CONF-02 config fields and sensible defaults"
  - "GenerationPhaseSchema and GenerationSchema for generation lifecycle tracking"
  - "TransmissionSchema for peak/elder/accident transmissions"
  - "DeathProfileDistributionSchema and RoleDistributionSchema with refine sum checks"
  - "LineageEvents typed interface with 11 lifecycle event signatures"
  - "lineageBus standalone EventEmitter instance (not Genesis bus)"
affects: [mortality-engine, transmission-system, mutation-pipeline, inheritance-composer, generation-manager, cli, state-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod 4 schema extension via AgentConfigSchema.extend()"
    - "Distribution schemas with .refine() for sum ~1.0 validation"
    - "Standalone typed EventEmitter<LineageEvents> bus (not Genesis bus)"
    - "Barrel exports from index.ts for schemas and events"
    - "Zod 4 .default() requires full object values (not empty {})"

key-files:
  created:
    - src/schemas/role.ts
    - src/schemas/death-profile.ts
    - src/schemas/citizen.ts
    - src/schemas/simulation.ts
    - src/schemas/generation.ts
    - src/schemas/transmission.ts
    - src/schemas/index.ts
    - src/schemas/schemas.test.ts
    - src/events/types.ts
    - src/events/bus.ts
    - src/events/index.ts
    - src/events/events.test.ts
  modified: []

key-decisions:
  - "Zod 4 .default({}) provides empty object without inner field defaults -- use full default objects instead"
  - "lineageBus is standalone EventEmitter (not Genesis bus) for standalone operation"
  - "Distribution refine checks use Math.abs(sum - 1.0) < 0.01 tolerance for floating point"

patterns-established:
  - "Schema extension: AgentConfigSchema.extend() for LINEAGE-specific fields"
  - "Distribution validation: z.object().default(fullDefaults).refine(sumCheck)"
  - "Event bus: standalone EventEmitter<LineageEvents> in src/events/bus.ts"
  - "Type-only imports: import type { X } from for types, import { X } from for values"
  - "All relative imports use .js extension (ESM/nodenext requirement)"

requirements-completed: [FOUND-04, FOUND-05, CONF-01, CONF-02]

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 02 Plan 01: Zod Schemas and Typed Events Summary

**6 Zod schemas (CitizenConfig, SimulationParameters, Generation, Transmission, DeathProfile, Role) extending @genesis/shared, plus standalone typed LineageEvents bus with 11 lifecycle events -- 42 tests passing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T22:57:47Z
- **Completed:** 2026-03-24T23:05:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- All 6 schema files with Zod 4 validation, proper defaults, and type inference
- CitizenConfigSchema extends AgentConfigSchema (not forks) with role, generationNumber, deathProfile, contextBudget, birthTimestamp
- SimulationParametersSchema includes every CONF-02 parameter with sensible defaults (generationSize=5, maxGenerations=3, mutationRate=0.3, gen1Protection=true)
- Distribution schemas (RoleDistribution, DeathProfileDistribution) with refine checks ensuring probabilities sum to ~1.0
- LineageEvents interface with all 11 lifecycle event signatures for citizen, generation, transmission, inheritance, simulation, and state events
- Standalone lineageBus EventEmitter that does NOT import Genesis bus (standalone operation requirement)
- 42 tests passing: 28 schema tests + 14 event tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Define all Zod schemas and inferred types**
   - `eb21aab` (test: TDD RED - failing schema tests)
   - `317c567` (feat: TDD GREEN - implement all schemas)
2. **Task 2: Define LineageEvents interface and typed event bus**
   - `3fd41fb` (test: TDD RED - failing event tests)
   - `359e7c8` (feat: TDD GREEN - implement event types and bus)

## Files Created/Modified
- `src/schemas/role.ts` - CitizenRoleSchema enum (5 roles), RoleDistributionSchema with refine
- `src/schemas/death-profile.ts` - DeathProfileSchema enum, DeathProfileDistributionSchema with refine
- `src/schemas/citizen.ts` - CitizenConfigSchema extending AgentConfigSchema
- `src/schemas/simulation.ts` - SimulationParametersSchema with all CONF-02 parameters
- `src/schemas/generation.ts` - GenerationPhaseSchema enum, GenerationSchema
- `src/schemas/transmission.ts` - TransmissionTypeSchema enum, TransmissionSchema
- `src/schemas/index.ts` - Barrel export of all schemas and types
- `src/schemas/schemas.test.ts` - 28 tests covering all schemas
- `src/events/types.ts` - LineageEvents interface (11 event signatures)
- `src/events/bus.ts` - Standalone lineageBus EventEmitter instance
- `src/events/index.ts` - Barrel export of bus and types
- `src/events/events.test.ts` - 14 tests for event emit/subscribe roundtrip

## Decisions Made
- **Zod 4 .default() behavior:** `.default({})` in Zod 4 provides an empty object without applying inner field defaults. Fixed by providing full default objects (e.g., `.default({ 'old-age': 0.7, 'accident': 0.3 })`). This is a Zod 4 behavior change from Zod 3.
- **Standalone event bus:** lineageBus is a standalone `new EventEmitter<LineageEvents>()` that does NOT import from `@genesis/shared`. This ensures LINEAGE can run independently while still being composable with Genesis events later.
- **Floating point tolerance:** Distribution refine checks use `Math.abs(sum - 1.0) < 0.01` to handle floating point precision issues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod 4 .default({}) behavior for distribution schemas**
- **Found during:** Task 1 (Schema implementation)
- **Issue:** Plan specified `.default({})` for RoleDistributionSchema and DeathProfileDistributionSchema, but Zod 4 does not apply inner field defaults when outer default is empty object `{}`
- **Fix:** Changed `.default({})` to `.default({ full: values })` with explicit default values matching inner field defaults
- **Files modified:** src/schemas/role.ts, src/schemas/death-profile.ts, src/schemas/simulation.ts (peakTransmissionWindow, inheritanceStagingRates)
- **Verification:** All 28 schema tests pass including default filling tests
- **Committed in:** 317c567 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for Zod 4 compatibility. No scope creep.

## Issues Encountered
- Worktree did not have node_modules -- resolved by symlinking from main repo
- Vitest 4 does not support `-x` flag (from plan's verify command) -- used `--bail 1` instead

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All schemas and types are ready for Phase 3+ subsystems to import
- Event bus ready for lifecycle event emission in mortality engine, transmission system, etc.
- SimulationParameters ready for CLI configuration parsing (Plan 02-02)
- TypeScript compiles cleanly with `tsc --noEmit`

## Self-Check: PASSED

All 12 created files verified present. All 4 commit hashes verified in git log.

---
*Phase: 02-type-system-config-and-cli*
*Completed: 2026-03-24*
