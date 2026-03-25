---
phase: 10
slug: event-stream-and-terminal-output
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/display/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/display/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | EVNT-02 | unit | `npx vitest run src/display/display.test.ts -t "EVNT-02" -x` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | EVNT-03 | unit | `npx vitest run src/display/display.test.ts -t "EVNT-03" -x` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | EVNT-01 | integration | `npx vitest run src/display/display.test.ts -t "EVNT-01" -x` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | EVNT-02 | unit | `npx vitest run src/display/display.test.ts -t "renderer" -x` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | EVNT-03 | unit | `npx vitest run src/display/display.test.ts -t "summary" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pnpm add chalk@^5.4.0 ora@^9.0.0 cli-table3@^0.6.5` — install display libraries
- [ ] `src/display/display.test.ts` — test stubs for EVNT-01, EVNT-02, EVNT-03

*Wave 0 installs display dependencies and creates test infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Color-coded terminal output is visually distinguishable | EVNT-02 | Color rendering depends on terminal emulator capabilities | Run `npx tsx src/cli.ts "test"` and visually confirm births (green), deaths (red), transmissions (blue), mutations (yellow) are distinct |
| Spinner-log interleaving is clean (no garbled output) | EVNT-02 | Terminal rendering artifacts cannot be detected programmatically | Run simulation and observe spinner stops cleanly before log output, restarts after |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
