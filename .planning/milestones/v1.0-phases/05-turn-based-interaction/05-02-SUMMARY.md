---
phase: 05-turn-based-interaction
plan: 02
subsystem: interaction
tags: [agent-sdk, query, turn-runner, sequential-execution, context-budget, tdd]

# Dependency graph
requires:
  - phase: 05-turn-based-interaction plan 01
    provides: TurnOutputSchema, formatHandoff, buildTurnPrompt for turn data and prompt building
  - phase: 03-mortality-engine
    provides: ContextBudget for tracking token consumption as aging
  - phase: 04-roles
    provides: CitizenConfig with systemPrompt, role, maxTurns for agent execution
provides:
  - executeCitizenTurn function wrapping Agent SDK query() for single citizen execution
  - runTurns orchestration function for sequential citizen turns within a generation
  - TurnRunnerConfig and TurnResult interfaces for typed orchestration
  - Barrel exports making all interaction module types available from root
affects: [06-transmission, 09-generation-manager, 10-event-stream]

# Tech tracking
tech-stack:
  added: []
  patterns: [sequential-async-orchestration, mock-async-generator-testing, optional-side-effect-injection]

key-files:
  created:
    - src/interaction/turn-runner.ts
    - src/interaction/index.ts
  modified:
    - src/interaction/interaction.test.ts
    - src/index.ts

key-decisions:
  - "executeCitizenTurn takes turnNumber as parameter (TurnRunner tracks position externally)"
  - "ContextBudget integration is optional via config.contextBudget? to allow execution without mortality wiring"
  - "permissionMode forced to dontAsk and persistSession to false per project conventions (overrides AgentConfig defaults)"
  - "Error subtypes from query() produce [Agent error: subtype] text rather than throwing exceptions"

patterns-established:
  - "Agent SDK mock pattern: vi.mock with async generator factories yielding assistant + result messages"
  - "Optional side-effect injection: ContextBudget passed via config object, called only if present"
  - "Sequential async orchestration: for loop with await ensures ordered execution of agent calls"

requirements-completed: [INTR-01, INTR-02, INTR-03]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 05 Plan 02: TurnRunner Sequential Execution Summary

**TurnRunner orchestrating sequential Agent SDK query() calls with handoff threading, token accumulation, and optional ContextBudget mortality integration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T01:04:56Z
- **Completed:** 2026-03-25T01:08:59Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN, Task 2 barrel exports)
- **Files modified:** 4

## Accomplishments
- executeCitizenTurn wraps Agent SDK query() with citizen systemPrompt, maxTurns, model, dontAsk permission, no session persistence
- runTurns orchestrates sequential citizen execution: first citizen gets seed-only prompt, subsequent citizens get accumulated handoff context via buildTurnPrompt
- ContextBudget.update() called with actual input/output token usage after each citizen turn
- 9 new tests covering single turn execution (success + error), sequential orchestration, handoff threading, turn numbering, token accumulation, and budget updates
- Barrel exports from src/interaction/index.ts and src/index.ts make all interaction types consumable

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for TurnRunner** - `73a69bd` (test)
2. **Task 1 GREEN: Implement TurnRunner** - `90338aa` (feat)
3. **Task 2: Barrel exports and full suite verification** - `b32d636` (feat)

## Files Created/Modified
- `src/interaction/turn-runner.ts` - executeCitizenTurn and runTurns orchestration functions with Agent SDK query() integration
- `src/interaction/index.ts` - Barrel re-exports for all interaction module public symbols
- `src/interaction/interaction.test.ts` - 9 new tests added (20 total) with mocked Agent SDK async generators
- `src/index.ts` - Root barrel updated with interaction module exports

## Decisions Made
- executeCitizenTurn takes turnNumber as explicit parameter -- TurnRunner tracks position, keeping the function stateless
- ContextBudget integration is optional (config.contextBudget?) so TurnRunner can execute without mortality wiring in tests or standalone mode
- permissionMode forced to 'dontAsk' and persistSession to false per project conventions, overriding AgentConfig defaults ('bypassPermissions')
- Error subtypes from Agent SDK query() produce `[Agent error: subtype]` placeholder text rather than throwing exceptions, ensuring the turn sequence continues gracefully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DeathProfile schema usage in test helper**
- **Found during:** Task 1 RED phase
- **Issue:** Test helper `makeCitizen` passed `deathProfile: { type: 'old-age' }` but DeathProfileSchema is a string enum (`'old-age' | 'accident'`), not an object
- **Fix:** Changed to `deathProfile: 'old-age'` matching the actual schema
- **Files modified:** src/interaction/interaction.test.ts
- **Verification:** All 20 tests pass
- **Committed in:** 73a69bd (Task 1 RED commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test data)
**Impact on plan:** Minimal -- corrected test fixture to match actual schema. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functions are fully implemented with no placeholder data.

## Next Phase Readiness
- TurnRunner ready for Generation Manager (Phase 9) to orchestrate full generation lifecycle
- runTurns accepts CitizenConfig[] from birthCitizen, returns TurnResult for downstream processing
- ContextBudget integration allows mortality engine to track token consumption during interaction
- Transmission system (Phase 6) can consume TurnOutput records to extract peak/elder/accident transmissions

## Self-Check: PASSED

- All 4 source files exist on disk
- All 3 commits (73a69bd, 90338aa, b32d636) found in git history
- 183/183 tests pass (full suite)
- TypeScript clean (no type errors)

---
*Phase: 05-turn-based-interaction*
*Completed: 2026-03-25*
