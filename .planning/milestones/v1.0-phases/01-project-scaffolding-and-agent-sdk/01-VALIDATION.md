---
phase: 1
slug: project-scaffolding-and-agent-sdk
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green + successful manual `tsx src/index.ts` execution
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FOUND-01 | typecheck | `npx tsc --noEmit` | N/A (tsc) | ⬜ pending |
| 1-01-02 | 01 | 1 | FOUND-02 | integration | `npx vitest run src/index.test.ts -t "auth"` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | FOUND-03 | unit + integration | `npx vitest run src/index.test.ts -t "output"` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | SUCCESS-4 | typecheck + unit | `npx tsc --noEmit && npx vitest run src/verify-genesis.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest project configuration (matching Genesis pattern)
- [ ] `src/index.test.ts` — Agent SDK mock tests covering FOUND-02, FOUND-03
- [ ] `src/verify-genesis.test.ts` — @genesis/shared import resolution test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `tsx src/index.ts` starts without errors | SUCCESS-1 | Smoke test requires runtime execution | Run `npx tsx src/index.ts`, verify no error output |
| query() returns coherent response with system prompt | SUCCESS-2 | Requires live API call | Run `npx tsx src/index.ts`, verify response contains expected content |
| OAuth/API key auth succeeds | SUCCESS-3 | Auth verified by successful API response | Run `npx tsx src/index.ts`, verify no auth errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
