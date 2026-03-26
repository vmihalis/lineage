---
phase: 07-mutation-pipeline
plan: 01
subsystem: mutation
tags: [mutation, probability, prompt-engineering, tdd, pure-functions]

# Dependency graph
requires:
  - phase: 06-transmission-system
    provides: extractAnchorTokens for roundtrip verification, TransmissionSchema with mutated/mutationType fields
provides:
  - buildSmallMutationPrompt for LLM-driven semantic drift
  - buildLargeMutationPrompt for LLM-driven semantic inversion
  - MUTATION_SYSTEM_PROMPT for agent role framing
  - decideMutation two-stage probabilistic decider with injectable randomFn
  - selectTokenIndex random index selection within token bounds
  - reassembleContent [N] formatted text rebuilder from token array
  - MutationType and MutationDecision types
affects: [07-mutation-pipeline plan 02, inheritance-composer, generation-manager]

# Tech tracking
tech-stack:
  added: []
  patterns: [injectable-randomFn for deterministic testing, two-stage probability model, prompt builder pattern]

key-files:
  created:
    - src/mutation/mutation-prompts.ts
    - src/mutation/mutation-decider.ts
    - src/mutation/mutation.test.ts
  modified: []

key-decisions:
  - "Injectable randomFn parameter for deterministic testing of probabilistic logic"
  - "Two-stage mutation decision: first roll for mutate/no-mutate, second roll for small/large"
  - "Strict less-than comparison (randomFn() < rate) so rate 0.0 always produces no-mutation"
  - "reassembleContent produces [N] format that roundtrips with extractAnchorTokens"

patterns-established:
  - "Injectable randomFn: pure functions accept () => number for testable randomness"
  - "Prompt builder pattern: functions return complete prompt strings targeting single anchor tokens"
  - "TDD with makeSequence helper for multi-call random sequences"

requirements-completed: [MUTN-01, MUTN-02, MUTN-03, MUTN-04]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 07 Plan 01: Mutation Pipeline Pure Functions Summary

**TDD pure functions for mutation pipeline: two-stage probabilistic decider with injectable randomFn, small/large mutation prompt builders, and [N]-format content reassembly with extractAnchorTokens roundtrip verification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T02:14:34Z
- **Completed:** 2026-03-25T02:16:32Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files created:** 3

## Accomplishments
- 23 TDD tests covering all pure mutation functions (RED phase confirmed all fail, GREEN phase confirmed all pass)
- Two-stage probabilistic mutation decider with injectable randomFn for deterministic testing
- Small mutation prompt builder producing drift instructions (imprecision language)
- Large mutation prompt builder producing inversion instructions (opposite meaning language)
- MUTATION_SYSTEM_PROMPT establishing imperfect transmission medium framing
- reassembleContent verified to roundtrip with extractAnchorTokens from Phase 06
- Full suite 238 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: TDD pure mutation functions -- failing tests** - `b64383c` (test)
2. **Task 1 GREEN: TDD pure mutation functions -- passing implementation** - `b59276d` (feat)

## Files Created/Modified
- `src/mutation/mutation.test.ts` - 23 tests covering all pure mutation functions (prompts, decider, helpers)
- `src/mutation/mutation-prompts.ts` - buildSmallMutationPrompt, buildLargeMutationPrompt, MUTATION_SYSTEM_PROMPT
- `src/mutation/mutation-decider.ts` - decideMutation, selectTokenIndex, reassembleContent, MutationType, MutationDecision

## Decisions Made
- Injectable randomFn parameter enables deterministic testing of probabilistic logic without mocking Math.random
- Strict less-than comparison (`randomFn() < rate`) so mutationRate 0.0 always produces no-mutation (boundary correctness)
- Two-stage probability: first roll determines mutate/no-mutate, second roll determines small/large type
- reassembleContent produces `[N] text` format compatible with extractAnchorTokens parser from Phase 06

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functions are fully implemented with no placeholder data.

## Next Phase Readiness
- Pure mutation functions ready for consumption by mutation executor (Plan 02)
- decideMutation provides the mutation/no-mutation decision with type
- Prompt builders provide the LLM instructions for executeMutation in Plan 02
- selectTokenIndex and reassembleContent provide the token-level mutation targeting

## Self-Check: PASSED

- All 3 files exist (mutation-prompts.ts, mutation-decider.ts, mutation.test.ts)
- Both commits found (b64383c, b59276d)
- mutation-prompts.ts: 2 exported functions
- mutation-decider.ts: 3 exported functions
- 23 tests passing

---
*Phase: 07-mutation-pipeline*
*Completed: 2026-03-25*
