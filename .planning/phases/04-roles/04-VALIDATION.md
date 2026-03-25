---
phase: 4
slug: roles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/roles/roles.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/roles/roles.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ROLE-01 | unit | `npx vitest run src/roles/roles.test.ts -t "builder"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | ROLE-02 | unit | `npx vitest run src/roles/roles.test.ts -t "skeptic"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | ROLE-03 | unit | `npx vitest run src/roles/roles.test.ts -t "archivist"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | ROLE-04 | unit | `npx vitest run src/roles/roles.test.ts -t "elder-interpreter"` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | ROLE-05 | unit | `npx vitest run src/roles/roles.test.ts -t "observer"` | ❌ W0 | ⬜ pending |
| 04-01-06 | 01 | 1 | ROLE-06 | unit | `npx vitest run src/roles/roles.test.ts -t "assignRole"` | ❌ W0 | ⬜ pending |
| 04-01-07 | 01 | 1 | INTEGRATION | unit | `npx vitest run src/mortality/mortality.test.ts -t "systemPrompt"` | ✅ (update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/roles/roles.test.ts` — stubs for ROLE-01 through ROLE-06 and integration
- [ ] Update `src/mortality/mortality.test.ts` — verify non-empty systemPrompt after integration

*Existing infrastructure covers test framework and config.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent output reflects role personality | ROLE-01..05 | Requires live Agent SDK call to verify behavioral differentiation | Run simulation with each role and inspect output quality |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
