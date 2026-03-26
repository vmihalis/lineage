---
phase: 6
slug: transmission-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/transmission/transmission.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/transmission/transmission.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | TRAN-01 | unit | `npx vitest run src/transmission/transmission.test.ts -t "buildPeakTransmissionPrompt"` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | TRAN-01 | unit | `npx vitest run src/transmission/transmission.test.ts -t "executePeakTransmission"` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | TRAN-02 | unit | `npx vitest run src/transmission/transmission.test.ts -t "extractAnchorTokens"` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | TRAN-02 | unit | `npx vitest run src/transmission/transmission.test.ts -t "fallback"` | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 1 | TRAN-03 | unit | `npx vitest run src/transmission/transmission.test.ts -t "writeTransmission"` | ❌ W0 | ⬜ pending |
| 06-01-06 | 01 | 1 | TRAN-03 | unit | `npx vitest run src/transmission/transmission.test.ts -t "event"` | ❌ W0 | ⬜ pending |
| 06-01-07 | 01 | 1 | TRAN-03 | unit | `npx vitest run src/transmission/transmission.test.ts -t "file path"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/transmission/transmission.test.ts` — stubs for TRAN-01, TRAN-02, TRAN-03
- [ ] Agent SDK mock pattern — reuse `createMockQueryGenerator` helper from `interaction.test.ts`

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
