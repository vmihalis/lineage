---
phase: 10-event-stream-and-terminal-output
plan: 01
subsystem: display
tags: [formatters, chalk, cli-table3, generation-summary, terminal-output]
dependency_graph:
  requires: [events/types, events/bus]
  provides: [display/formatters, display/generation-summary, display/index]
  affects: [index.ts]
tech_stack:
  added: [chalk@5.6.2, ora@9.3.0, cli-table3@0.6.5]
  patterns: [pure-formatter-functions, strip-ansi-test-pattern, createRequire-cjs-interop]
key_files:
  created:
    - src/display/formatters.ts
    - src/display/generation-summary.ts
    - src/display/display.test.ts
    - src/display/index.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/index.ts
decisions:
  - "COLORS constant exports chalk functions by category for reuse in summary builder"
  - "createRequire CJS interop for cli-table3 to avoid verbatimModuleSyntax conflicts"
  - "stripAnsi helper in tests for content assertions independent of terminal color support"
  - "shortId slices to 8 chars matching inheritance-composer pattern"
metrics:
  duration: 5min
  completed: "2026-03-26T02:52:04Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 18
  tests_total: 335
  files_changed: 7
---

# Phase 10 Plan 01: Display Dependencies and Pure Event Formatters Summary

Pure formatter functions mapping all 9 LineageEvents to chalk-colored strings, plus cli-table3 generation summary builder with full unit tests

## What Was Built

### Task 1: Install display dependencies and create pure event formatters
- Installed chalk ^5.6.2, ora ^9.3.0, cli-table3 ^0.6.5 as production dependencies
- Created `src/display/formatters.ts` with 9 pure formatter functions and a `COLORS` constant:
  - `formatBirth` (green), `formatDeath` (red), `formatTransmission` (blue), `formatMutation` (yellow)
  - `formatGenerationStart`/`formatGenerationEnd` (magenta), `formatInheritance` (cyan)
  - `formatSimulationStart`/`formatSimulationEnd` (bold white)
- Created `src/display/index.ts` barrel exports
- Wired display module into `src/index.ts` main barrel

### Task 2: Generation summary builder and unit tests
- Created `src/display/generation-summary.ts` with:
  - `DisplayCitizen` and `GenerationDisplayState` interfaces
  - `createGenerationDisplayState()` factory function
  - `buildGenerationSummary()` producing a cli-table3 table with Citizen, Role, Death, Transmitted, Mutated columns
- Created `src/display/display.test.ts` with 18 unit tests across 3 describe blocks:
  - EVNT-02: 11 tests for all 9 formatter functions, return types, and COLORS constant
  - EVNT-03: 5 tests for generation summary builder (init, headers, rows, transmitted status, mutation display)
  - EVNT-01: 2 tests verifying lineageBus accepts all 7+ required event types

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `40276a7` | Install display deps and create pure event formatters |
| 2 | `889ac8d` | Add unit tests for display formatters and generation summary |
| 2+ | `94e8b02` | Wire display module into main barrel exports |

## Decisions Made

1. **createRequire CJS interop for cli-table3**: Used `createRequire(import.meta.url)` pattern for cli-table3 import because `verbatimModuleSyntax: true` in tsconfig prevents default import of CJS modules. This is the same pattern documented in the plan's interface context.

2. **COLORS constant as reusable mapping**: Exported chalk color functions by event category so the generation summary builder (and future EventRenderer in Plan 02) can reuse the same color scheme without re-importing chalk.

3. **stripAnsi test helper**: Tests use a regex-based ANSI stripping function to assert on text content rather than ANSI escape codes, since chalk may not colorize in non-TTY environments (Vitest).

4. **shortId(8) convention**: All formatters truncate IDs to 8 characters, matching the `citizenId.slice(0, 8)` pattern established in Phase 8 inheritance-composer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed @genesis/shared path resolution in worktree**
- **Found during:** Task 1 (pnpm install)
- **Issue:** Worktree at `.claude/worktrees/agent-aa5f8ffa/` can't resolve relative path `../genesis/packages/shared` since genesis isn't a sibling of the worktree directory
- **Fix:** Temporarily used absolute path for pnpm install, then restored relative path in package.json for git consistency
- **Files modified:** package.json (temporary, restored)

**2. [Rule 2 - Missing functionality] Added display exports to main barrel**
- **Found during:** Task 2 (after creating display module)
- **Issue:** src/index.ts didn't re-export the new display module, breaking the established pattern where every module is accessible from the main barrel
- **Fix:** Added formatters, summary builder, and types to src/index.ts exports
- **Files modified:** src/index.ts
- **Commit:** `94e8b02`

**3. [Rule 2 - Missing functionality] Created generation-summary.ts in Task 1 instead of Task 2**
- **Found during:** Task 1 (tsc verification)
- **Issue:** The barrel index.ts imports from `generation-summary.js` which the plan assigned to Task 2, but Task 1's verification requires `tsc --noEmit` to pass
- **Fix:** Created the full implementation in Task 1 alongside formatters, then wrote TDD tests in Task 2 that validated the already-working implementation
- **Impact:** TDD RED phase was technically GREEN from the start since implementation preceded tests; all 18 tests verified correctness

## Verification Results

- `pnpm ls chalk ora cli-table3` -- all three installed (5.6.2, 0.6.5, 9.3.0)
- `npx vitest run src/display/display.test.ts` -- 18 display tests pass
- `npx vitest run` -- 335 total tests pass (15 files, zero regressions)
- `npx tsc --noEmit` -- no type errors
- All formatter functions importable from `src/display/index.ts` and `src/index.ts`

## Known Stubs

None -- all display functions are fully implemented with real chalk and cli-table3 output.

## Self-Check: PASSED

- All 4 created files exist on disk
- All 3 commit hashes verified in git log
- 335 tests pass, zero regressions
- TypeScript compiles without errors
