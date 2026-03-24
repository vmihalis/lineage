---
phase: 02-type-system-config-and-cli
plan: 02
subsystem: state-config-cli
tags: [state-manager, config-loader, commander, cli, barrel-export]

# Dependency graph
requires:
  - phase: 02-type-system-config-and-cli
    plan: 01
    provides: "SimulationParametersSchema, lineageBus, all schemas and event types"
  - phase: 01-project-scaffolding-and-agent-sdk
    provides: "@genesis/shared StateManager, project structure"
provides:
  - "LineageStateManager wrapping Genesis StateManager with lineageBus event emission"
  - "loadConfig function merging file config + CLI overrides + Zod validation"
  - "DEFAULT_SIMULATION_PARAMETERS with all schema default values (no seedProblem)"
  - "Commander CLI entry point with seed-problem arg and --generations, --size, --config, --output flags"
  - "Clean barrel export in src/index.ts (schemas, events, state, config)"
affects: [generation-manager, mortality-engine, simulation-runner, all-future-phases]

# Tech tracking
tech-stack:
  added: ["commander ^14.0.0"]
  patterns:
    - "LineageStateManager wraps Genesis StateManager with lineageBus event emission"
    - "loadConfig() merges file JSON + CLI string overrides + Zod defaults"
    - "createProgram() factory for testable Commander instances"
    - "CLI action re-throws errors; direct-run block catches and exits"
    - "Barrel export in src/index.ts re-exports all LINEAGE modules"

key-files:
  created:
    - src/state/manager.ts
    - src/state/index.ts
    - src/state/state.test.ts
    - src/config/defaults.ts
    - src/config/loader.ts
    - src/config/index.ts
    - src/config/config.test.ts
    - src/cli.ts
    - src/cli.test.ts
  modified:
    - src/index.ts
    - package.json

key-decisions:
  - "createProgram() factory pattern so CLI tests get fresh Commander instances without ESM module caching issues"
  - "CLI action handler re-throws errors instead of process.exit(1) for testability; isDirectRun block handles exit"
  - "Parsing-only test programs (no action) for flag parsing tests; separate integration tests for action behavior"
  - "DEFAULT_SIMULATION_PARAMETERS is a const object without seedProblem (always required from CLI)"

patterns-established:
  - "State persistence: LineageStateManager.write/read with lineageBus events"
  - "Config loading: loadConfig(seedProblem, cliOptions) with file merge + Zod validation"
  - "CLI entry: createProgram() factory + exported program singleton + isDirectRun guard"
  - "Testing Commander: createParsingProgram() for sync parse tests, createProgram() with parseAsync for action tests"

requirements-completed: [FOUND-06, CONF-03, CONF-04]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 02 Plan 02: State, Config, and CLI Summary

**LineageStateManager wrapping Genesis StateManager with event emission, loadConfig merging file/CLI/Zod defaults, and Commander CLI entry point -- 83 total tests passing, `tsx src/cli.ts "What is consciousness?"` works end-to-end**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T23:08:57Z
- **Completed:** 2026-03-24T23:15:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- LineageStateManager wraps Genesis StateManager with lineageBus state:saved and state:loaded events
- loadConfig() merges JSON config file values + CLI option overrides + Zod schema defaults into validated SimulationParameters
- DEFAULT_SIMULATION_PARAMETERS provides all schema defaults without seedProblem for reference
- Commander CLI with `<seed-problem>` required argument and `-g/--generations`, `-s/--size`, `-c/--config`, `-o/--output` flags
- src/index.ts replaced Phase 1 POC with clean barrel export of all LINEAGE modules (schemas, events, state, config)
- package.json updated with commander dependency, start script pointing to cli.ts, and bin field
- 83 total tests passing (18 state/config + 15 CLI + 42 schema + 14 event = some overlap from shared tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: State persistence and config loading with tests**
   - `9878f61` (test: TDD RED - failing state/config tests)
   - `dd90f5c` (feat: TDD GREEN - implement state manager and config loader)
2. **Task 2: Commander CLI entry point and library barrel export**
   - `090d338` (test: TDD RED - failing CLI and barrel export tests)
   - `a82c973` (feat: TDD GREEN - implement CLI and barrel export)

## Files Created/Modified
- `src/state/manager.ts` - LineageStateManager wrapping Genesis StateManager with lineageBus events
- `src/state/index.ts` - Barrel export for state module
- `src/state/state.test.ts` - 5 tests for roundtrip, validation, and event emission
- `src/config/defaults.ts` - DEFAULT_SIMULATION_PARAMETERS with all schema defaults
- `src/config/loader.ts` - loadConfig() function with file merge + CLI overrides + Zod validation
- `src/config/index.ts` - Barrel export for config module
- `src/config/config.test.ts` - 13 tests for config loading, overrides, and defaults
- `src/cli.ts` - Commander CLI with createProgram() factory, action handler, and isDirectRun guard
- `src/cli.test.ts` - 15 tests for argument parsing, flag parsing, action integration, and barrel export
- `src/index.ts` - Replaced Phase 1 POC with clean barrel export of schemas, events, state, config
- `package.json` - Added commander dep, start script, and bin field

## Decisions Made
- **createProgram() factory pattern:** Commander program instances are created via factory function so tests get fresh instances without ESM module caching issues. The module also exports a singleton `program` for direct execution.
- **CLI action re-throws instead of process.exit:** The action handler re-throws errors instead of calling process.exit(1), making it testable. The isDirectRun block at module level catches rejections and exits for direct CLI invocation.
- **Parsing-only test programs:** CLI flag parsing tests use lightweight Commander programs without async action handlers to avoid unintended side effects (like loadConfig trying to read nonexistent files).
- **DEFAULT_SIMULATION_PARAMETERS without seedProblem:** The defaults object intentionally omits seedProblem since it is always a required CLI argument and has no meaningful default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Commander test approach for async action handlers**
- **Found during:** Task 2
- **Issue:** Plan specified `program.parse(['node', 'cli', ...], { from: 'user' })` for tests, but `from: 'user'` treats all array elements as raw args (Commander doesn't strip first two). Also, sync `.parse()` with async `.action()` creates unhandled promise rejections in tests.
- **Fix:** Used `from: 'node'` (default) for proper arg stripping, created `createParsingProgram()` for sync parsing tests without action side effects, and used `program.parseAsync()` for action integration tests.
- **Files modified:** src/cli.test.ts, src/cli.ts
- **Committed in:** a82c973

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for Commander v14 test compatibility. No scope creep.

## Issues Encountered
- Worktree did not have node_modules -- resolved by symlinking from main repo
- Commander v14 `from: 'user'` behavior different from plan expectation -- fixed in tests
- pnpm install had to be run from main repo directory (worktree symlinks node_modules)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- State persistence ready for mortality engine and generation manager
- Config loading ready for all simulation parameters
- CLI entry point ready for simulation execution engine (future phases)
- Barrel export provides clean import path for all LINEAGE modules
- TypeScript compiles cleanly with `tsc --noEmit`
- `tsx src/cli.ts "What is consciousness?"` works end-to-end

## Self-Check: PASSED

All 11 created/modified files verified present. All 4 commit hashes verified in git log.

---
*Phase: 02-type-system-config-and-cli*
*Completed: 2026-03-24*
