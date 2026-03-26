---
phase: 11
slug: wire-mortality-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | LIFE-02 | integration | `npx vitest run src/generation/generation.test.ts -t "context budget"` | Partial | ⬜ pending |
| 11-01-02 | 01 | 1 | LIFE-03 | unit | `npx vitest run src/generation/generation.test.ts -t "safety buffer"` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | LIFE-04 | integration | `npx vitest run src/generation/generation.test.ts -t "decline signal"` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | LIFE-05 | integration | `npx vitest run src/generation/generation.test.ts -t "accident"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/generation/generation.test.ts` — new test cases for LIFE-02 (budget instantiation and update)
- [ ] `src/generation/generation.test.ts` — new test cases for LIFE-03 (safety buffer configuration)
- [ ] `src/generation/generation.test.ts` — new test cases for LIFE-04 (decline signal injection)
- [ ] `src/generation/generation.test.ts` — new test cases for LIFE-05 (accident termination, no transmission)
- [ ] `src/generation/generation.test.ts` — mock additions for mortality module imports

*Existing infrastructure covers test framework. Wave 0 adds test stubs only.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
