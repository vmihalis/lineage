---
phase: 03-mortality-engine
plan: 01
subsystem: mortality
tags: [context-budget, death-profiles, citizen-lifecycle, tdd, zod, eventemitter3, nanoid]

# Dependency graph
requires:
  - phase: 02-type-system-config-and-cli
    provides: "Zod schemas (CitizenConfig, DeathProfile, SimulationParameters), typed event bus (lineageBus), barrel exports"
provides:
  - "ContextBudget class for tracking context-as-lifespan with threshold callbacks"
  - "assignDeathProfile function with weighted random selection and gen1Protection"
  - "calculateAccidentPoint function for random termination in [0.3, 0.7] range"
  - "birthCitizen factory creating fully configured CitizenConfig with hidden death profile"
  - "Barrel export at src/mortality/index.ts and wiring into src/index.ts"
affects: [04-citizen-roles, 05-transmission-system, 06-mutation-pipeline, 09-generation-manager]

# Tech tracking
tech-stack:
  added: []
  patterns: ["TDD red-green for domain logic", "Schema parse in factory for Zod default propagation", "Threshold callback pattern for lifecycle events"]

key-files:
  created:
    - src/mortality/context-budget.ts
    - src/mortality/death-profiles.ts
    - src/mortality/citizen-lifecycle.ts
    - src/mortality/index.ts
    - src/mortality/mortality.test.ts
  modified:
    - src/index.ts

key-decisions:
  - "Used CitizenConfigSchema.parse() in birthCitizen to propagate AgentConfig defaults (model, tools, status, allowedTools, permissionMode, maxTurns) rather than hardcoding them"
  - "ContextBudget threshold labels tracked in a Set for exactly-once firing semantics"
  - "calculateAccidentPoint range [0.3, 0.7] ensures meaningful work before death but disruptive enough to create urgency"

patterns-established:
  - "Factory parse pattern: construct minimal input object, parse through Zod schema for default propagation"
  - "Threshold callback pattern: sorted thresholds, Set-based deduplication, batch return of newly triggered"
  - "Mortality module structure: individual files per concern with barrel export"

requirements-completed: [LIFE-01, LIFE-02, LIFE-03, LIFE-06, LIFE-07]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 3 Plan 1: Mortality Engine Foundations Summary

**ContextBudget tracking context-as-lifespan with threshold callbacks, death profile weighted assignment with gen1Protection, and citizen birth factory emitting events via lineageBus**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T23:50:25Z
- **Completed:** 2026-03-24T23:55:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ContextBudget class tracks token consumption as 0-1 percentage with configurable safety buffer (default 20%) and threshold callbacks that fire exactly once
- Death profile assignment via weighted random selection respects gen1Protection override, with accident points randomly placed in [0.3, 0.7] range
- Citizen birth factory creates schema-validated CitizenConfig with hidden death profile and emits citizen:born event on lineageBus
- 33 new tests via TDD (red-green), all passing alongside 83 existing tests (116 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: ContextBudget class and death profile assignment with tests**
   - `69945f6` (test) - RED: failing tests for ContextBudget, assignDeathProfile, calculateAccidentPoint
   - `0dee329` (feat) - GREEN: implement ContextBudget class and death profile functions
2. **Task 2: Citizen birth factory, barrel export, and wiring tests**
   - `e94357f` (test) - RED: failing tests for birthCitizen and barrel exports
   - `5bdc83d` (feat) - GREEN: implement citizen birth factory, barrel exports, and wiring

_TDD tasks have two commits each: test (red) then feat (green). No refactor phase needed._

## Files Created/Modified
- `src/mortality/context-budget.ts` - ContextBudget class with percentage tracking, safety buffer, threshold callbacks, and reset
- `src/mortality/death-profiles.ts` - assignDeathProfile (weighted random + gen1Protection) and calculateAccidentPoint ([0.3, 0.7] range)
- `src/mortality/citizen-lifecycle.ts` - birthCitizen factory creating CitizenConfig via schema parse, emitting citizen:born event
- `src/mortality/index.ts` - Barrel export of all mortality module components
- `src/mortality/mortality.test.ts` - 33 tests covering all mortality functionality
- `src/index.ts` - Added mortality module exports to main library barrel

## Decisions Made
- **CitizenConfigSchema.parse() in factory:** AgentConfigSchema base requires model, tools, status, allowedTools, permissionMode, maxTurns which all have Zod defaults. Rather than hardcoding these in the factory, we pass the minimal input through schema.parse() so Zod fills defaults automatically. This ensures any future AgentConfig default changes propagate without touching citizen-lifecycle.ts.
- **Threshold label-based deduplication:** Using threshold labels (strings) in a Set rather than percentage values avoids floating-point comparison issues and makes the API more ergonomic for consumers who check "did halfway fire?" by label.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript compilation error in birthCitizen**
- **Found during:** Task 2 (citizen birth factory implementation)
- **Issue:** Object literal assigned to CitizenConfig type was missing AgentConfigSchema fields (model, tools, parameters, status, allowedTools, permissionMode, maxTurns) which have Zod defaults but are required in the TypeScript output type
- **Fix:** Changed from direct object literal to CitizenConfigSchema.parse() which fills Zod defaults
- **Files modified:** src/mortality/citizen-lifecycle.ts
- **Verification:** `npx tsc --noEmit` exits 0, all tests pass
- **Committed in:** 5bdc83d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Fix was necessary for TypeScript compilation. The parse-based approach is actually better design (propagates future default changes).

## Known Stubs

- `src/mortality/citizen-lifecycle.ts` line ~41: `systemPrompt: ''` - Intentional empty string placeholder. System prompts are built by the Roles phase (Phase 4, plan 04). This stub does not prevent this plan's goals from being achieved.

## Issues Encountered
None beyond the TypeScript type error documented in Deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Mortality module is fully tested and exported, ready for Phase 3 Plan 2 (death trigger integration, if applicable)
- ContextBudget threshold callbacks ready to be wired into agent execution loop
- birthCitizen ready to be called by Generation Manager (Phase 9)
- Death profile data flows: birth -> hidden profile -> threshold triggers -> death event (wiring in later phases)

## Self-Check: PASSED

All 6 files verified present. All 4 commit hashes verified in git log.

---
*Phase: 03-mortality-engine*
*Completed: 2026-03-24*
