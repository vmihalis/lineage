---
phase: 3
slug: mortality-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/mortality/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/mortality/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | LIFE-01 | unit | `npx vitest run src/mortality/mortality.test.ts -t "birthCitizen"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | LIFE-06 | unit | `npx vitest run src/mortality/mortality.test.ts -t "assignDeathProfile"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | LIFE-07 | unit | `npx vitest run src/mortality/mortality.test.ts -t "gen1Protection"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | LIFE-02 | unit | `npx vitest run src/mortality/mortality.test.ts -t "ContextBudget"` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | LIFE-03 | unit | `npx vitest run src/mortality/mortality.test.ts -t "safety buffer"` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | LIFE-04 | unit | `npx vitest run src/mortality/mortality.test.ts -t "old-age"` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | LIFE-05 | unit | `npx vitest run src/mortality/mortality.test.ts -t "accident"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/mortality/mortality.test.ts` — test stubs for LIFE-01 through LIFE-07
- [ ] `src/mortality/context-budget.ts` — ContextBudget class stub
- [ ] `src/mortality/death-profiles.ts` — death profile assignment stub
- [ ] `src/mortality/citizen-lifecycle.ts` — birth factory stub
- [ ] `src/mortality/index.ts` — barrel export

*Existing test infrastructure is fully functional — 83 tests passing. Vitest config, node environment, and ESM support all confirmed working.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Old-age citizen observes decline signals | LIFE-04 | Requires running actual Agent SDK query to verify citizen receives/responds to decline signals | Run single citizen with old-age profile, inspect output for decline awareness |
| Accident death cuts output mid-stream | LIFE-05 | Requires running actual Agent SDK query and verifying output is truncated | Run single citizen with accident profile, verify output ends abruptly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
