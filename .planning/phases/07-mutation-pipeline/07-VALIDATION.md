---
phase: 7
slug: mutation-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/mutation/mutation.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/mutation/mutation.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | MUTN-01 | unit | `npx vitest run src/mutation/mutation.test.ts -t "buildSmallMutationPrompt"` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | MUTN-01 | unit | `npx vitest run src/mutation/mutation.test.ts -t "executeMutation.*small"` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | MUTN-02 | unit | `npx vitest run src/mutation/mutation.test.ts -t "buildLargeMutationPrompt"` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | MUTN-02 | unit | `npx vitest run src/mutation/mutation.test.ts -t "executeMutation.*large"` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | MUTN-03 | unit | `npx vitest run src/mutation/mutation.test.ts -t "decideMutation"` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | MUTN-03 | unit | `npx vitest run src/mutation/mutation.test.ts -t "mutationRate 0.0"` | ❌ W0 | ⬜ pending |
| 07-02-03 | 02 | 1 | MUTN-03 | unit | `npx vitest run src/mutation/mutation.test.ts -t "mutationRate 1.0"` | ❌ W0 | ⬜ pending |
| 07-02-04 | 02 | 1 | MUTN-04 | unit | `npx vitest run src/mutation/mutation.test.ts -t "largeMutationProbability"` | ❌ W0 | ⬜ pending |
| 07-02-05 | 02 | 1 | MUTN-04 | unit | `npx vitest run src/mutation/mutation.test.ts -t "largeMutationProbability 0.0"` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | ALL | unit | `npx vitest run src/mutation/mutation.test.ts -t "empty anchorTokens"` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | ALL | unit | `npx vitest run src/mutation/mutation.test.ts -t "mutated.*true"` | ❌ W0 | ⬜ pending |
| 07-03-03 | 03 | 2 | ALL | unit | `npx vitest run src/mutation/mutation.test.ts -t "reassembleContent"` | ❌ W0 | ⬜ pending |
| 07-03-04 | 03 | 2 | ALL | unit | `npx vitest run src/mutation/mutation.test.ts -t "transmission:mutated"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/mutation/mutation.test.ts` — stubs for MUTN-01, MUTN-02, MUTN-03, MUTN-04
- [ ] Agent SDK mock pattern — reuse `createMockQueryGenerator` helper from `transmission.test.ts`
- [ ] `reassembleContent` tests — verify [N] formatted content roundtrips correctly

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Small mutation reads as natural semantic drift | MUTN-01 | LLM output quality is subjective | Run simulation with mutation, read mutated transmissions, verify claims are vaguer but comprehensible |
| Large mutation reads as plausible inversion | MUTN-02 | LLM output quality is subjective | Run simulation with high large mutation rate, verify inverted claims read as confident statements |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
