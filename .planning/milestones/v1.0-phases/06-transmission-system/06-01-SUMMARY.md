---
phase: 06-transmission-system
plan: 01
subsystem: transmission
tags: [anchor-parser, peak-prompt, pure-functions, tdd]
dependency_graph:
  requires: [schemas/citizen, schemas/transmission]
  provides: [transmission/anchor-parser, transmission/peak-prompt]
  affects: [06-02 transmission executor]
tech_stack:
  added: []
  patterns: [regex-based-parsing, pure-function-modules, mortality-aware-prompts]
key_files:
  created:
    - src/transmission/anchor-parser.ts
    - src/transmission/peak-prompt.ts
    - src/transmission/transmission.test.ts
  modified: []
decisions:
  - "Regex /\\[(\\d+)\\]\\s*(.+?)(?=\\n\\[\\d+\\]|\\s*$)/gs for multi-line, multi-digit anchor parsing"
  - "Fallback to full text as single token when no [N] markers found (never loses content)"
  - "Context percentage displayed as integer (Math.round) for prompt clarity"
  - "Prompt includes 3-7 claims range as guidance, not hard constraint"
metrics:
  duration: 2min
  completed: "2026-03-25T01:38:31Z"
  tasks_completed: 1
  tasks_total: 1
  test_count: 16
  test_pass: 16
---

# Phase 06 Plan 01: Anchor Parser and Peak Prompt Builder Summary

Regex-based anchor token extractor and mortality-aware peak transmission prompt builder as pure functions with full TDD coverage.

## What Was Built

### extractAnchorTokens (anchor-parser.ts)
Pure function that parses numbered `[N] claim text` patterns from agent output into a `string[]` of anchor tokens. Uses a single regex with `exec` loop to handle multi-digit numbers, multi-line claims, and arbitrary claim counts. Falls back to returning the full trimmed text as a single-element array when no `[N]` markers are found. Returns empty array only for empty/whitespace input. This function feeds directly into `TransmissionSchema.anchorTokens`.

### buildPeakTransmissionPrompt (peak-prompt.ts)
Pure function that accepts a `CitizenConfig` and context consumption percentage (0-1) and returns a mortality-aware prompt string. The prompt includes: context percentage as integer, role and generation awareness, numbered `[1]` claim format instructions, 3-7 claim target guidance, "stand alone" independence rule, and closing mortality urgency language. This prompt is what triggers a citizen to produce their peak transmission.

## TDD Execution

| Phase | Action | Tests |
|-------|--------|-------|
| RED | Created transmission.test.ts with 16 tests | 0/16 pass (module imports fail) |
| GREEN | Implemented anchor-parser.ts and peak-prompt.ts | 16/16 pass |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d8e548c | test | Add failing tests for anchor parser and peak prompt builder |
| c7b62e2 | feat | Implement anchor parser and peak prompt builder |

## Deviations from Plan

None -- plan executed exactly as written.

## Test Coverage

16 tests across 2 describe blocks:

**extractAnchorTokens (9 tests):**
- Two numbered claims parsed correctly
- Single claim parsed
- Double-digit numbers handled
- Prose fallback returns full text
- Empty string returns empty array
- Whitespace trimmed from claims
- Five claims handled
- Multi-line claims preserved
- Whitespace-only returns empty array

**buildPeakTransmissionPrompt (7 tests):**
- Context percentage as integer (0.42 -> "42%")
- [1] format example present
- Mortality language present (transmission, legacy/survive/death)
- 3-7 claims guidance
- Stand alone instruction
- PEAK TRANSMISSION MOMENT header
- Rounding (0.876 -> "88%")

## Known Stubs

None -- both functions are fully implemented with no placeholder data or TODO markers.

## Self-Check: PASSED

All 3 created files verified on disk. Both commit hashes (d8e548c, c7b62e2) found in git log.
