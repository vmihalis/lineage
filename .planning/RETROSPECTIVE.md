# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-26
**Phases:** 12 | **Plans:** 20 | **Tasks:** 35

### What Was Built
- Complete civilization simulator: 12 subsystems from schemas to terminal display
- Mortality engine with context-as-lifespan, old-age decline signals, accident death
- Transmission-mutation-inheritance pipeline for inter-generational knowledge transfer
- Five distinct citizen roles with turn-based sequential interaction
- Generation manager orchestrating full lifecycle across configurable generations
- Real-time color-coded terminal output with generation summaries

### What Worked
- **Strict dependency-order construction** — each subsystem independently testable before integration, no circular dependency issues
- **TDD pure functions first, Agent SDK wiring second** — splitting each phase into pure functions + executor kept test coverage high and execution fast
- **Consistent Agent SDK pattern** — `maxTurns: 1`, `dontAsk`, `no persist` across all 4 call sites made the SDK predictable
- **Phase velocity** — 20 plans in ~81min total (~4min avg) with high test coverage throughout
- **Milestone audit before completion** — caught 3 real integration gaps (mortality unwired, config params ignored) that were fixed in Phases 11-12

### What Was Inefficient
- **Nyquist validation never backfilled** — 12/12 VALIDATION.md files in draft state; the framework was set up but never populated
- **ROADMAP.md progress tracking inconsistency** — some phases marked `[ ]` even after completion; progress table had stale data
- **SUMMARY frontmatter** — no `requirements_completed` field in any SUMMARY.md, reducing automated traceability
- **Mortality simplification** — v1 simplified to "all citizens complete turns then die" rather than mid-conversation death; this was the right call for the timeline but means the mortality thesis hasn't been fully tested yet

### Patterns Established
- `extractAnchorTokens()` / `reassembleContent()` roundtrip for structured LLM output that survives mutation
- Injectable `randomFn` parameter for deterministic testing of probabilistic logic
- `createRequire()` CJS interop for packages without ESM support under `verbatimModuleSyntax`
- Graceful degradation on Agent SDK errors — placeholder text rather than exceptions
- `shortId(8)` convention for compact display of nanoid identifiers
- Bound handler Map for safe bus detach — never `removeAllListeners` on shared bus

### Key Lessons
1. **Wire integration gaps early** — building subsystems in isolation is efficient, but integration verification (Phases 11-12) should have been part of Phase 9 rather than separate late phases
2. **Config-to-runtime traceability matters** — declaring a config parameter in a schema doesn't mean it has runtime effect; the audit caught two ignored parameters
3. **Milestone audit is high-value** — the re-audit found all gaps were closed and gave confidence to ship; worth the 30-minute investment
4. **Simplified v1 was the right call** — shipping 12 working subsystems in 2 days required simplifying mortality to "turns then death" rather than mid-conversation death tracking

### Cost Observations
- Model mix: primarily sonnet for execution, opus for planning/audit
- Sessions: ~6 sessions across 2 days
- Notable: ~4min avg plan execution with high parallelism across independent subsystems

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 12 | 20 | Initial process: TDD pure functions + SDK wiring per phase |

### Cumulative Quality

| Milestone | Tests | LOC | Test LOC |
|-----------|-------|-----|----------|
| v1.0 | 366 | 7,617 | 5,250 |

### Top Lessons (Verified Across Milestones)

1. Strict dependency-order construction produces testable, integrable subsystems
2. Milestone audit before completion catches real integration gaps
