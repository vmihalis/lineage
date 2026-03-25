---
phase: 05-turn-based-interaction
plan: 01
subsystem: interaction
tags: [zod, turn-output, handoff, prompt-builder, tdd]

# Dependency graph
requires:
  - phase: 04-roles
    provides: CitizenRoleSchema enum for role validation in TurnOutput
provides:
  - TurnOutputSchema Zod schema for validating citizen turn data
  - TurnOutput type for typed citizen output records
  - formatHandoff function for structured handoff text between citizens
  - buildTurnPrompt function for constructing first-citizen and subsequent-citizen prompts
affects: [05-turn-based-interaction plan 02 (TurnRunner), 06-transmission, 09-generation-manager]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function-formatting, zod-schema-contract, test-factory-helper]

key-files:
  created:
    - src/interaction/turn-output.ts
    - src/interaction/handoff.ts
    - src/interaction/interaction.test.ts
  modified: []

key-decisions:
  - "Handoff text uses structured header format: --- citizenName (role, Turn N) --- for easy parsing"
  - "First citizen prompt omits PREVIOUS CITIZEN CONTRIBUTIONS section entirely (not empty section)"
  - "Role instruction line covers all 5 roles: build on, question, record, interpret, or observe"

patterns-established:
  - "TurnOutput as the data contract between citizen execution and handoff formatting"
  - "Pure function formatting (formatHandoff, buildTurnPrompt) with no side effects for testability"
  - "makeTurnOutput() test factory helper with Partial<TurnOutput> overrides pattern"

requirements-completed: [INTR-02, INTR-03]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 05 Plan 01: Turn Output and Handoff Formatting Summary

**TurnOutput Zod schema with citizen turn validation and pure handoff/prompt-building functions for turn-based citizen interaction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T01:00:48Z
- **Completed:** 2026-03-25T01:02:32Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- TurnOutputSchema validates citizenId, citizenName, role, turnNumber, output, usage (inputTokens/outputTokens), and ISO datetime timestamp
- formatHandoff produces structured handoff text with citizen name/role/turn number headers, or empty string for no previous turns
- buildTurnPrompt differentiates first-citizen prompts (seed problem only) from subsequent-citizen prompts (seed + handoff)
- 11 comprehensive tests covering schema validation, handoff formatting, and prompt building

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for TurnOutput and handoff** - `7b0e596` (test)
2. **Task 1 GREEN: Implement TurnOutput schema and handoff formatting** - `6f06ba4` (feat)

## Files Created/Modified
- `src/interaction/turn-output.ts` - TurnOutput Zod schema and type export (imports CitizenRoleSchema from schemas)
- `src/interaction/handoff.ts` - formatHandoff and buildTurnPrompt pure functions
- `src/interaction/interaction.test.ts` - 11 tests: schema validation (4), formatHandoff (4), buildTurnPrompt (3)

## Decisions Made
- Handoff text uses structured header format `--- citizenName (role, Turn N) ---` for clear visual separation and parseability
- First citizen prompt entirely omits the PREVIOUS CITIZEN CONTRIBUTIONS section rather than including an empty one
- Role instruction line covers all 5 roles with action verbs: "Build on, question, record, interpret, or observe"
- Test factory helper `makeTurnOutput()` uses `Partial<TurnOutput>` overrides for test brevity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functions are fully implemented with no placeholder data.

## Next Phase Readiness
- TurnOutput schema and handoff functions ready for Plan 02's TurnRunner implementation
- formatHandoff and buildTurnPrompt are pure functions that TurnRunner will call during citizen execution
- No barrel export added yet (Plan 02 will create src/interaction/index.ts when integrating with TurnRunner)

## Self-Check: PASSED

- All 3 source files exist on disk
- Both commits (7b0e596, 6f06ba4) found in git history
- 11/11 tests pass
- TypeScript clean (no type errors)

---
*Phase: 05-turn-based-interaction*
*Completed: 2026-03-25*
