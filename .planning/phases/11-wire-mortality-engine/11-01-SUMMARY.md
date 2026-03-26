---
phase: 11-wire-mortality-engine
plan: 01
subsystem: generation
tags: [mortality, context-budget, death-profiles, decline-signals, generation-runner]

# Dependency graph
requires:
  - phase: 03-mortality-engine
    provides: "ContextBudget, createDeathThresholds, getDeclineSignal, death profiles"
  - phase: 09-generation-manager
    provides: "runGeneration lifecycle, generation state machine"
  - phase: 05-turn-based-interaction
    provides: "executeCitizenTurn, buildTurnPrompt"
  - phase: 06-transmission-system
    provides: "buildPeakTransmissionPrompt, executePeakTransmission"
provides:
  - "Mortality-aware generation runner with active ContextBudget tracking"
  - "Per-citizen death threshold checking after each turn"
  - "Decline signal accumulation for old-age citizen peak prompts"
  - "Accident citizen termination without peak transmission"
  - "Configurable contextWindow on SimulationParameters"
affects: [12-civilization-metrics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single ContextBudget per generation with manual per-citizen threshold checking"
    - "vi.hoisted() for shared mock state accessible inside vi.mock factories"

key-files:
  created: []
  modified:
    - src/schemas/simulation.ts
    - src/generation/generation-runner.ts
    - src/generation/generation.test.ts

key-decisions:
  - "Single ContextBudget per generation (not per-citizen) tracking cumulative token consumption"
  - "Manual threshold checking per-citizen instead of passing thresholds to ContextBudget constructor"
  - "Decline signals accumulated per-citizen during INTERACTING, prepended to peak prompt in DYING if needed"
  - "DYING phase emits citizen:died for all non-accident citizens, even those with early peak collection"

patterns-established:
  - "vi.hoisted() pattern for vitest mock state that needs to be shared between vi.mock factories and test code"
  - "Per-citizen mortality tracking struct with thresholds, firedLabels Set, isDead, declineSignals"

requirements-completed: [LIFE-02, LIFE-03, LIFE-04, LIFE-05]

# Metrics
duration: 8min
completed: 2026-03-26
---

# Phase 11 Plan 01: Wire Mortality Engine Summary

**Active mortality wiring: ContextBudget tracks cumulative token consumption per generation, per-citizen death thresholds fire decline signals and accident termination, replacing hardcoded 0.45 with actual budget.percentage**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-26T03:55:32Z
- **Completed:** 2026-03-26T04:03:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wired Phase 3 mortality primitives (ContextBudget, createDeathThresholds, getDeclineSignal) into Phase 9 generation runner
- Replaced runTurns() black box with per-citizen executeCitizenTurn() loop enabling mortality checks after each turn
- Added contextWindow field to SimulationParametersSchema (default 200,000 tokens)
- Replaced hardcoded 0.45 contextPercentage with actual budget.percentage from ContextBudget
- Added 10 new tests covering LIFE-02, LIFE-03, LIFE-04, LIFE-05 requirements (356 total, 0 regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add contextWindow to schema and refactor generation-runner with mortality wiring** - `e6fb7c9` (feat)
2. **Task 2: Update generation.test.ts with mortality mocks and LIFE-02/03/04/05 tests** - `96243c8` (test)

## Files Created/Modified
- `src/schemas/simulation.ts` - Added contextWindow field with default 200,000 to SimulationParametersSchema
- `src/generation/generation-runner.ts` - Refactored to mortality-aware lifecycle with ContextBudget, per-citizen thresholds, decline signals, accident termination
- `src/generation/generation.test.ts` - Replaced runTurns mocks with executeCitizenTurn/buildTurnPrompt, added mortality module mocks, added LIFE-02/03/04/05 tests

## Decisions Made
- Single ContextBudget per generation (not per-citizen) -- citizens share the same context window cumulatively, matching the "generation as conversation" metaphor
- Empty thresholds array on ContextBudget constructor, manual threshold checking per-citizen -- avoids needing multiple budgets while supporting per-citizen death profiles
- DYING phase emits citizen:died for all non-accident citizens regardless of whether peak-transmission was already collected during INTERACTING -- ensures consistent event emission for downstream listeners (EventRenderer)
- Used vi.hoisted() for shared mock state in vitest -- the standard pattern for mock variables that must be accessible inside hoisted vi.mock factories

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] citizen:died event not emitted for citizens with early peak transmission collection**
- **Found during:** Task 2 (test verification)
- **Issue:** When peak-transmission threshold fired during INTERACTING phase, the citizen was marked peakTransmissionCollected=true. The DYING phase then skipped these citizens entirely with `if (isDead || peakTransmissionCollected) continue`, meaning citizen:died was never emitted for them.
- **Fix:** Split DYING phase logic: skip only isDead (accident) citizens. For all surviving citizens, emit citizen:died. Only call executePeakTransmission if peakTransmissionCollected is false.
- **Files modified:** src/generation/generation-runner.ts
- **Verification:** Test "emits citizen:died event for each citizen after their transmission" passes
- **Committed in:** 96243c8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for correct event emission. No scope creep.

## Issues Encountered
- vi.mock hoisting prevents referencing top-level variables in factory functions -- resolved by using vi.hoisted() to create shared mock state that is available in hoisted scope
- ContextBudget mock required function expression (not arrow function) to work as constructor with `new` keyword

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data paths are fully wired.

## Next Phase Readiness
- Mortality engine is now active in the generation runner -- death profiles determine lifespan behavior
- Core thesis ("mortality changes what a mind produces") is now mechanically enforced
- Phase 12 (civilization metrics) can measure mortality-driven outcomes

---
## Self-Check: PASSED

All files exist, all commits verified.

*Phase: 11-wire-mortality-engine*
*Completed: 2026-03-26*
