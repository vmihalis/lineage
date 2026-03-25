---
phase: 03-mortality-engine
plan: 02
subsystem: mortality
tags: [death-execution, death-thresholds, decline-signals, tdd, context-budget]

# Dependency graph
requires:
  - phase: 03-mortality-engine
    plan: 01
    provides: "ContextBudget class with threshold callbacks, assignDeathProfile, calculateAccidentPoint, barrel exports"
provides:
  - "createDeathThresholds factory producing ContextThreshold[] arrays for old-age and accident profiles"
  - "getDeclineSignal providing injectable mortality text for decline-warning, final-window, old-age-death stages"
  - "Exported constants: PEAK_TRANSMISSION_LABEL, ACCIDENT_DEATH_LABEL, OldAgeThresholdLabels"
affects: [05-transmission-system, 09-generation-manager]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Profile-based threshold factory dispatching on DeathProfile type", "Mock-based boundary testing with vi.spyOn for random functions"]

key-files:
  created:
    - src/mortality/death-execution.ts
  modified:
    - src/mortality/index.ts
    - src/index.ts
    - src/mortality/mortality.test.ts

key-decisions:
  - "Old-age thresholds at fixed percentages (75/85/95%) with configurable peak-transmission via SimulationParameters.peakTransmissionWindow.min"
  - "Accident citizens who die before peakTransmissionMin never get a peak-transmission threshold -- they die before their peak"
  - "Decline signals are plain text SYSTEM NOTICE messages designed for injection into agent conversation context"

patterns-established:
  - "DeathProfile-based dispatch pattern: factory function routes on profile type to produce different threshold arrays"
  - "Threshold exclusion pattern: accident deaths may exclude peak-transmission if death point < peak threshold"

requirements-completed: [LIFE-04, LIFE-05]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 3 Plan 2: Death Execution Logic Summary

**Death threshold factory translating death profiles into ContextBudget thresholds with graduated old-age decline signals at 75%/85%/95% and random accident termination at 30-70%**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T23:58:49Z
- **Completed:** 2026-03-25T00:01:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- createDeathThresholds factory produces sorted ContextThreshold[] arrays: 4 thresholds for old-age (peak-transmission, decline-warning at 75%, final-window at 85%, old-age-death at 95%) and 1-2 for accident (optional peak-transmission + accident-death at random 30-70%)
- getDeclineSignal provides injectable mortality text creating the subjective experience of aging -- declining cognitive clarity, urgency to preserve, and final moments awareness
- Accident citizens who die before peakTransmissionMin are correctly excluded from peak-transmission threshold (they never reach their productive peak)
- 29 new tests via TDD (red-green), all passing alongside 116 existing tests (145 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Death threshold factory and decline signals with tests**
   - `c1469d4` (test) - RED: failing tests for createDeathThresholds, getDeclineSignal, constants
   - `fa971df` (feat) - GREEN: implement death threshold factory and decline signals
2. **Task 2: Update barrel exports and run full verification**
   - `706659a` (feat) - Wire death-execution exports through barrel files with tests

_TDD Task 1 has two commits: test (red) then feat (green). Task 2 is a standard commit._

## Files Created/Modified
- `src/mortality/death-execution.ts` - Death threshold factory (createDeathThresholds, getDeclineSignal) with constants
- `src/mortality/index.ts` - Updated barrel export including death-execution exports
- `src/index.ts` - Updated root barrel with all death-execution exports
- `src/mortality/mortality.test.ts` - 29 new tests for death execution, decline signals, constants, and barrel exports

## Decisions Made
- **Fixed percentage thresholds for old-age:** 75%/85%/95% are hardcoded because they represent universal aging milestones (decline, final clarity, death). Only peak-transmission is configurable via SimulationParameters because different simulations may want earlier/later productive peaks.
- **Accident threshold exclusion logic:** If calculateAccidentPoint() returns a value below peakTransmissionMin, the peak-transmission threshold is excluded entirely. This models citizens who die before reaching their productive peak -- a deliberately tragic outcome.
- **SYSTEM NOTICE format for decline signals:** Plain text with percentage context creates a consistent injection format that future orchestration code can prepend to agent conversation turns.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None. All functions are fully implemented with no placeholder data.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Death execution is fully tested and exported, completing the mortality engine foundation
- createDeathThresholds output feeds directly into ContextBudget constructor (thresholds field)
- getDeclineSignal output will be injected into agent conversation by the generation manager (Phase 9)
- Full mortality data flow complete: birth -> death profile -> thresholds -> ContextBudget -> threshold events -> decline signals -> death

## Self-Check: PASSED

All 4 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 03-mortality-engine*
*Completed: 2026-03-24*
