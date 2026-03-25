---
phase: 8
slug: inheritance-composer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.1 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run src/inheritance/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/inheritance/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | INHR-01 | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "readGenerationTransmissions"` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | INHR-01 | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "buildSeedCompressionPrompt"` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | INHR-02 | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "formatRecentLayer"` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | INHR-03 | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "configurable"` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | INHR-01 | integration | `npx vitest run src/inheritance/inheritance.test.ts -t "compressSeedLayer"` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | INHR-02 | integration | `npx vitest run src/inheritance/inheritance.test.ts -t "composeInheritance"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/inheritance/inheritance.test.ts` — test stubs for INHR-01, INHR-02, INHR-03
- [ ] Existing test infrastructure covers framework needs

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Seed layer compression produces meaningful 3-5 claim summary | INHR-01 | LLM output quality is subjective; automated tests verify format only | Review seed layer output for semantic compression quality in integration test output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
