---
phase: 2
slug: type-system-config-and-cli
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | FOUND-04 | unit | `npx vitest run src/schemas/schemas.test.ts -t "CitizenConfig" -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | FOUND-04 | unit | `npx vitest run src/schemas/schemas.test.ts -t "SimulationParameters" -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | FOUND-04 | unit | `npx vitest run src/schemas/schemas.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | FOUND-05 | unit | `npx vitest run src/events/events.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | FOUND-06 | unit | `npx vitest run src/state/state.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | CONF-01, CONF-02 | unit | `npx vitest run src/config/config.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | CONF-03, CONF-04 | unit | `npx vitest run src/cli.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/schemas/schemas.test.ts` — stubs for FOUND-04 (all schema validation)
- [ ] `src/events/events.test.ts` — stubs for FOUND-05 (LineageEvents bus)
- [ ] `src/state/state.test.ts` — stubs for FOUND-06 (state persistence roundtrip)
- [ ] `src/config/config.test.ts` — stubs for CONF-01, CONF-02 (config loading + validation)
- [ ] `src/cli.test.ts` — stubs for CONF-03, CONF-04 (CLI argument parsing)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `tsx src/index.ts "What is consciousness?"` parses seed and loads config | CONF-03, CONF-04 | E2E CLI execution requires spawned process | Run `npx tsx src/index.ts "What is consciousness?"` and verify no errors, seed problem parsed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
