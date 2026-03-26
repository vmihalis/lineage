---
phase: 12-wire-config-parameters
plan: 01
subsystem: generation-runner
tags: [config-wiring, peak-transmission, inheritance, context-thresholds, mortality]

# Dependency graph
requires:
  - phase: 11-wire-mortality-engine
    provides: ContextBudget integration, per-citizen threshold checking, peak transmission during INTERACTING/DYING
  - phase: 08-inheritance-composer
    provides: INHERITANCE_RECENT_LABEL constant, composeInheritance with recentLayerThreshold config
  - phase: 06-transmission-system
    provides: buildPeakTransmissionPrompt, executePeakTransmission
provides:
  - Config-driven peak transmission window context (peakTransmissionWindow.max wired to prompt language)
  - Config-driven recent layer delivery timing (recentLayerThreshold gates when recent layer appears in citizen prompts)
  - Every SimulationParametersSchema config value now has a runtime consumer
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Threshold-gated content delivery: recentLayerDelivered flag toggled by INHERITANCE_RECENT_LABEL threshold crossing"
    - "Optional parameter extension: peakWindow? added to buildPeakTransmissionPrompt preserving backward compatibility"

key-files:
  created: []
  modified:
    - src/generation/generation-runner.ts
    - src/transmission/peak-prompt.ts
    - src/generation/generation.test.ts
    - src/transmission/transmission.test.ts
    - src/inheritance/inheritance.test.ts

key-decisions:
  - "Recent layer delivery is threshold-gated per-generation, not per-citizen -- recentLayerDelivered is shared across all citizens in a generation"
  - "peakWindow parameter is optional to preserve backward compatibility of buildPeakTransmissionPrompt"
  - "Existing inheritance injection tests updated to reflect threshold-based delivery behavior rather than immediate inclusion"

patterns-established:
  - "Config-to-runtime wiring: every SimulationParametersSchema value has a runtime consumer verified by tests"

requirements-completed: [TRAN-01, INHR-03]

# Metrics
duration: 7min
completed: 2026-03-26
---

# Phase 12 Plan 01: Wire Config Parameters Summary

**Threshold-gated recent layer delivery via INHERITANCE_RECENT_LABEL and peak transmission window context via peakWindow parameter -- closing all config-to-runtime integration gaps**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T04:33:07Z
- **Completed:** 2026-03-26T04:41:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Wired peakTransmissionWindow.max into buildPeakTransmissionPrompt via optional peakWindow parameter with "within"/"past" window context language
- Wired recentLayerThreshold into generation-runner via INHERITANCE_RECENT_LABEL threshold that gates when recent layer content appears in citizen prompts
- Every config parameter in SimulationParametersSchema now has a runtime consumer verified by tests
- Full test suite passes at 366 tests with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire peakTransmissionWindow.max and recentLayerThreshold (TDD)** - `d931472` (test: RED), `4fcdb26` (feat: GREEN)
2. **Task 2: Update peak-prompt unit tests and inheritance integration tests** - `11a9333` (test)

_Note: Task 1 followed TDD with separate RED and GREEN commits_

## Files Created/Modified
- `src/generation/generation-runner.ts` - Added INHERITANCE_RECENT_LABEL import, threshold-gated recent layer delivery, peakTransmissionWindow pass-through to peak prompt
- `src/transmission/peak-prompt.ts` - Added optional peakWindow parameter with window context language (within/past)
- `src/generation/generation.test.ts` - Added 5 new config-wiring tests, updated existing tests for third arg and threshold behavior
- `src/transmission/transmission.test.ts` - Added 4 peakWindow parameter tests (backward compat, within, past, custom values)
- `src/inheritance/inheritance.test.ts` - Added smoke test for custom recentLayerThreshold

## Decisions Made
- Recent layer delivery is threshold-gated per-generation (shared `recentLayerDelivered` flag) rather than per-citizen, since the recent layer represents shared generational context
- peakWindow parameter is optional (`peakWindow?`) to preserve backward compatibility -- callers without the param get the original prompt without window context
- Updated existing inheritance injection tests to verify threshold-based delivery instead of immediate inclusion, since this is the correct new behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing tests for new buildPeakTransmissionPrompt signature**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** 5 existing tests asserted on `buildPeakTransmissionPrompt(citizen, pct)` with 2 args, but it now receives 3 args (with peakTransmissionWindow). Inheritance injection tests expected immediate recentLayer delivery.
- **Fix:** Updated assertions to include third arg `params.peakTransmissionWindow` and changed inheritance injection tests to verify threshold-based delivery behavior
- **Files modified:** src/generation/generation.test.ts
- **Verification:** All 366 tests pass
- **Committed in:** 4fcdb26 (part of Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix -- test assertions matched old interface)
**Impact on plan:** Necessary to keep existing tests correct after interface change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All SimulationParametersSchema config values now have runtime consumers
- v1.0 milestone config-to-runtime integration gaps are fully closed
- Phase 12 is the final phase -- ready for milestone completion

## Self-Check: PASSED

- All 5 modified files exist on disk
- All 3 task commits verified in git log (d931472, 4fcdb26, 11a9333)
- 366 tests pass with zero failures

---
*Phase: 12-wire-config-parameters*
*Completed: 2026-03-26*
