---
phase: 04-roles
plan: 01
subsystem: roles
tags: [system-prompts, role-assignment, weighted-random, prompt-builder, tdd]

# Dependency graph
requires:
  - phase: 03-mortality-engine
    provides: birthCitizen() factory, CitizenConfig schema, death-profiles weighted random pattern
  - phase: 02-types-config-cli
    provides: CitizenRoleSchema, RoleDistributionSchema, SimulationParameters
provides:
  - "ROLE_PROMPTS constant with 5 distinct role-specific system prompt templates"
  - "assignRole() and assignRoles() for weighted random role selection"
  - "buildSystemPrompt() composing role template + civilization context + mortality awareness"
  - "birthCitizen() producing citizens with non-empty, role-specific system prompts"
affects: [05-transmission, 06-mutation, 07-inheritance, 09-generation-manager]

# Tech tracking
tech-stack:
  added: []
  patterns: [role-prompt-templates, weighted-random-selection, prompt-composition]

key-files:
  created:
    - src/roles/system-prompts.ts
    - src/roles/role-assignment.ts
    - src/roles/prompt-builder.ts
    - src/roles/index.ts
    - src/roles/roles.test.ts
  modified:
    - src/mortality/citizen-lifecycle.ts
    - src/mortality/mortality.test.ts
    - src/index.ts

key-decisions:
  - "Role prompts under 2000 chars each for efficient context usage"
  - "Prompt builder appends shared mortality awareness section to all roles"
  - "citizenName in prompt uses separate nanoid(6) call, independent of citizen ID"

patterns-established:
  - "Role prompt templates as Record<CitizenRole, string> constant"
  - "Prompt composition: role template + context section + mortality section"
  - "Weighted random role assignment following assignDeathProfile pattern"

requirements-completed: [ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-06]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 4 Plan 1: Roles Summary

**Five-role system (Builder, Skeptic, Archivist, Elder Interpreter, Observer) with config-driven weighted random assignment and prompt builder composing role identity + civilization context + mortality awareness into birthCitizen() system prompts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T00:30:57Z
- **Completed:** 2026-03-25T00:34:28Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 5 distinct role-specific system prompt templates defining behavioral identity (Builder solves, Skeptic questions, Archivist preserves, Elder Interpreter bridges, Observer records)
- Weighted random role assignment (assignRole/assignRoles) following the established assignDeathProfile pattern
- Prompt builder composing role template + seed problem + generation number + citizen name + mortality awareness
- birthCitizen() now produces citizens with fully populated, role-specific system prompts instead of empty string placeholder
- 17 new tests + 1 updated test + 1 new integration test, all passing (163 total)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for role module** - `48bcdf2` (test)
2. **Task 1 GREEN: Role assignment, system prompts, prompt builder** - `3e1337e` (feat)
3. **Task 2: Wire roles into birthCitizen, barrel exports** - `2dc120f` (feat)

_TDD task had separate RED and GREEN commits._

## Files Created/Modified
- `src/roles/system-prompts.ts` - ROLE_PROMPTS constant with 5 role-specific prompt templates
- `src/roles/role-assignment.ts` - assignRole() and assignRoles() with weighted random selection
- `src/roles/prompt-builder.ts` - buildSystemPrompt() composing role + context + mortality
- `src/roles/index.ts` - Barrel export for roles module
- `src/roles/roles.test.ts` - 17 tests covering all role module functions
- `src/mortality/citizen-lifecycle.ts` - birthCitizen() now calls buildSystemPrompt() instead of empty string
- `src/mortality/mortality.test.ts` - Updated placeholder test + added role differentiation test
- `src/index.ts` - Root barrel exports for roles module (assignRole, assignRoles, buildSystemPrompt, ROLE_PROMPTS, PromptContext)

## Decisions Made
- Role prompts kept under 2000 characters each for efficient context window usage
- Prompt builder appends a shared mortality awareness section to all roles regardless of type
- citizenName in the system prompt uses its own nanoid(6) call, independent from the citizen ID and name field -- the prompt identity does not need to exactly match the config name

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Role system complete and wired into citizen birth factory
- System prompts ready for agent SDK query() calls
- All 5 roles produce distinct behavioral prompts with mortality awareness
- Ready for transmission system (Phase 5) which will use role-influenced citizen output

## Self-Check: PASSED

- All 5 created files verified present on disk
- All 3 task commits verified in git history (48bcdf2, 3e1337e, 2dc120f)
- 163 tests passing, TypeScript clean

---
*Phase: 04-roles*
*Completed: 2026-03-25*
