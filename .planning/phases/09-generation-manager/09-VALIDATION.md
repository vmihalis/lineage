---
phase: 9
slug: generation-manager
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | GENM-01 | unit | `npx vitest run src/generation/__tests__/generation-state-machine.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | GENM-02 | unit | `npx vitest run src/generation/__tests__/generation-manager.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | GENM-03 | integration | `npx vitest run src/generation/__tests__/simulation-runner.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | GENM-04 | integration | `npx vitest run src/generation/__tests__/generation-boundary.test.ts` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 3 | GENM-05 | e2e | `npx vitest run src/generation/__tests__/multi-generation-e2e.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/generation/__tests__/generation-state-machine.test.ts` — stubs for GENM-01 state transitions
- [ ] `src/generation/__tests__/generation-manager.test.ts` — stubs for GENM-02 lifecycle orchestration
- [ ] `src/generation/__tests__/simulation-runner.test.ts` — stubs for GENM-03 multi-generation runner
- [ ] `src/generation/__tests__/generation-boundary.test.ts` — stubs for GENM-04 inheritance at boundary
- [ ] `src/generation/__tests__/multi-generation-e2e.test.ts` — stubs for GENM-05 configurable generation size

*Existing vitest infrastructure covers framework needs. Only test file stubs required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LLM-driven citizen interaction quality | GENM-03 | Agent SDK responses non-deterministic | Run 3-gen sim, verify citizens produce contextual output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
