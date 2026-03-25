# Phase 10: Event Stream and Terminal Output - Research

**Researched:** 2026-03-25
**Domain:** Terminal UI / Event-Driven Display / CLI Output Formatting
**Confidence:** HIGH

## Summary

Phase 10 is the final phase of LINEAGE v1. All subsystems (mortality, roles, interaction, transmission, mutation, inheritance, generation management) are complete and tested (317 tests passing). The event bus infrastructure (`lineageBus` on EventEmitter3) already emits every event type that EVNT-01 requires. The work is purely additive: subscribe to existing events, format them with color and structure, and render them to the terminal in real-time.

The core challenge is not event emission (it already works) but event consumption: building a display layer that subscribes to `lineageBus`, formats each event with chalk-based color coding, manages spinner lifecycle during long agent SDK calls, and renders generation summaries using cli-table3. The display layer must be wired into the CLI entry point (`cli.ts`) before `runSimulation()` is called, and cleaned up after it completes.

**Primary recommendation:** Create a `src/display/` module with an `EventRenderer` class that subscribes to all lineageBus events, formats them with chalk, manages ora spinner lifecycle, and renders cli-table3 generation summaries. Wire it into cli.ts as a side-effect-only layer that does not alter simulation logic.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVNT-01 | Typed events emitted for: citizen:born, citizen:died, citizen:peak-transmission, generation:started, generation:ended, transmission:mutated, inheritance:composed | All 7 events already emitted by existing subsystems. Event types fully defined in `src/events/types.ts`. No new emit calls needed -- only verification that they fire correctly during integration. |
| EVNT-02 | Real-time event stream to terminal with color-coded formatting (births, deaths, transmissions, mutations) | Requires new display module subscribing to lineageBus. chalk ^5 for coloring, ora ^9 for spinners during agent calls. All libraries are ESM-only, compatible with project config. |
| EVNT-03 | Generation summary displayed at each generation boundary (who lived, who died, what was transmitted, what mutated) | Requires cli-table3 for tabular generation summaries. Data available from generation:ended event combined with accumulated state from citizen:born/citizen:died/citizen:peak-transmission/transmission:mutated events within that generation. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| EventEmitter3 | 5.0.4 | Typed event bus | Already the backbone -- `lineageBus` is an EventEmitter3 instance with full `LineageEvents` type map. Display layer subscribes via `.on()`. |

### Core (Need to Install)
| Library | Verified Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| chalk | 5.6.2 (latest) | Terminal string styling | ESM-only since v5. Handles `NO_COLOR` env var automatically. Chained styles (`chalk.bold.green()`) for visual hierarchy. CLAUDE.md specifies `^5.4.0`. |
| ora | 9.3.0 (latest) | Terminal spinner | Shows which citizen is thinking during 10-30s agent SDK calls. Auto-clears for log output, handles stream conflicts. CLAUDE.md specifies `^9.0.0`. |
| cli-table3 | 0.6.5 (latest) | Terminal tables | Generation summaries with citizen roster, death profiles, transmission counts. Supports chalk-colored cell content. CLAUDE.md specifies `^0.6.5`. |

### Supporting (Optional)
| Library | Verified Version | Purpose | When to Use |
|---------|-----------------|---------|-------------|
| log-update | 7.2.0 (latest) | Streaming line updates | CLAUDE.md lists `^6.0.0`. Current latest is 7.2.0. Only needed if real-time multi-line updating is required beyond what ora provides. For v1 hackathon, ora + console.log is sufficient. Recommend deferring unless spinner-log interleaving proves insufficient. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chalk | picocolors | 14x smaller, 2x faster -- but no chained styles, no RGB, no template literals. CLAUDE.md explicitly rejects this. |
| ora | manual process.stdout.write | Handles edge cases (clearing, NO_COLOR, cross-platform) that waste hackathon time to implement. |
| cli-table3 | console.table | No styling, no color, no column width control. Summaries need visual hierarchy. |
| log-update | ora alone | ora handles spinner-to-log transitions well. log-update adds complexity for marginal benefit in a linear event stream. |

**Installation:**
```bash
pnpm add chalk@^5.4.0 ora@^9.0.0 cli-table3@^0.6.5
```

**Note on log-update:** CLAUDE.md recommends it but it is not strictly necessary for v1. The event stream is linear (events happen one at a time during sequential execution), so ora's built-in log-interleaving plus console.log is sufficient. Install only if needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  display/
    index.ts              # Barrel export
    event-renderer.ts     # Core: subscribes to lineageBus, formats + prints events
    formatters.ts         # Pure functions: event data -> colored strings
    generation-summary.ts # cli-table3 generation summary table builder
    display.test.ts       # Tests for formatters and summary builder
```

### Pattern 1: Event Renderer (Subscriber Pattern)
**What:** A class that subscribes to `lineageBus` events in its constructor/attach method and writes formatted output to the terminal. Holds no simulation state -- only accumulated display state (current generation's citizens, transmissions, mutations) for building summaries.
**When to use:** Always. This is the core pattern for the entire phase.
**Key design:**
```typescript
// Conceptual pattern -- NOT copy-paste code
import { lineageBus } from '../events/index.js';
import chalk from 'chalk';
import ora from 'ora';

export class EventRenderer {
  private spinner: ReturnType<typeof ora> | null = null;
  private currentGeneration: GenerationDisplayState | null = null;

  attach(): void {
    lineageBus.on('simulation:started', this.onSimulationStarted.bind(this));
    lineageBus.on('generation:started', this.onGenerationStarted.bind(this));
    lineageBus.on('citizen:born', this.onCitizenBorn.bind(this));
    lineageBus.on('citizen:died', this.onCitizenDied.bind(this));
    lineageBus.on('citizen:peak-transmission', this.onPeakTransmission.bind(this));
    lineageBus.on('transmission:mutated', this.onTransmissionMutated.bind(this));
    lineageBus.on('inheritance:composed', this.onInheritanceComposed.bind(this));
    lineageBus.on('generation:ended', this.onGenerationEnded.bind(this));
    lineageBus.on('simulation:ended', this.onSimulationEnded.bind(this));
  }

  detach(): void {
    lineageBus.removeAllListeners(); // or track specific handlers
  }
}
```

### Pattern 2: Pure Formatters (Testable Formatting)
**What:** Pure functions that take event data and return colored strings. Separated from the renderer so they can be unit tested without mocking the terminal.
**When to use:** For every event type that needs formatted output.
**Key design:**
```typescript
// Pure formatter -- no side effects, fully testable
import chalk from 'chalk';

export function formatBirth(citizenId: string, role: string, generation: number): string {
  return `  ${chalk.green('+')} ${chalk.bold(citizenId.slice(0, 8))} born as ${chalk.cyan(role)} in generation ${generation}`;
}

export function formatDeath(citizenId: string, deathProfile: string, generation: number): string {
  return `  ${chalk.red('x')} ${chalk.bold(citizenId.slice(0, 8))} died (${chalk.yellow(deathProfile)}) in generation ${generation}`;
}
```

### Pattern 3: Generation Summary Table (Boundary Display)
**What:** At each `generation:ended` event, render a cli-table3 summary table showing who lived, died, transmitted, and what mutated. Requires accumulating display state during the generation.
**When to use:** At every generation boundary (EVNT-03).
**Key design:**
```typescript
import Table from 'cli-table3';
import chalk from 'chalk';

export function buildGenerationSummary(state: GenerationDisplayState): string {
  const table = new Table({
    head: [
      chalk.bold('Citizen'),
      chalk.bold('Role'),
      chalk.bold('Death'),
      chalk.bold('Transmitted'),
      chalk.bold('Mutated'),
    ],
    colWidths: [14, 18, 12, 14, 10],
  });
  // ... populate rows from accumulated state
  return table.toString();
}
```

### Pattern 4: Spinner Lifecycle Management
**What:** ora spinner starts when a long-running phase begins (INTERACTING, DYING, TRANSMITTING) and stops before log output. Prevents garbled terminal output from spinner + console.log conflict.
**When to use:** During INTERACTING phase (agent SDK calls), DYING phase (peak transmissions), TRANSMITTING phase (mutations).
**Critical detail:** ora's `.stop()` must be called before any `console.log()`, and `.start()` after. The event-driven nature means the spinner state must be managed carefully around event handler log output.

### Anti-Patterns to Avoid
- **Modifying simulation logic for display:** The display layer is purely additive. Never change `runGeneration()`, `runSimulation()`, or any subsystem to accommodate display needs. Subscribe to events only.
- **Global console.log interception:** Do not monkey-patch console.log. Use ora's built-in stream management.
- **Stateful formatters:** Keep formatters pure. Accumulate state in the EventRenderer class, not in formatting functions.
- **Synchronous heavy rendering in event handlers:** Event handlers fire synchronously on the bus. Keep rendering lightweight (string formatting, not disk I/O).
- **removeAllListeners() without care:** `lineageBus.removeAllListeners()` would also remove listeners from OTHER subsystems (e.g., mutation pipeline emits events that other code might listen to). Track and remove only display-specific listeners.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal colors | ANSI escape sequences | chalk ^5 | Handles NO_COLOR, 256-color/truecolor detection, chained styles. Manual ANSI codes are error-prone and unreadable. |
| Loading spinners | Custom spinner with setInterval | ora ^9 | Handles clearing, stream conflicts, cross-platform, graceful terminal resize. 28M weekly downloads. |
| Summary tables | Manual string padding/alignment | cli-table3 ^0.6.5 | Column alignment, word wrap, border styles, colored cells. Manual padding breaks on variable-length data. |
| NO_COLOR support | Manual env var checking | chalk (automatic) | chalk 5.x respects NO_COLOR, FORCE_COLOR, and TERM environment variables automatically. |

**Key insight:** The simulation waits on LLM calls (10-30s each). The display layer's performance is irrelevant -- clarity and reliability matter. Use established libraries that handle terminal edge cases.

## Common Pitfalls

### Pitfall 1: Spinner-Log Interleaving
**What goes wrong:** ora spinner is running when an event fires and the handler calls console.log(). The spinner line and log line get mixed, producing garbled output.
**Why it happens:** ora writes to stdout on an interval. console.log also writes to stdout. Without coordination, they interleave.
**How to avoid:** Stop the spinner before logging, restart after. Use `spinner.stop()` -> `console.log(formatted)` -> `spinner.start(newText)`. Alternatively, use `spinner.clear()` and `spinner.render()` for less flickering.
**Warning signs:** Broken/garbled lines in terminal output during citizen turn execution.

### Pitfall 2: Event Ordering Assumptions
**What goes wrong:** Display code assumes events fire in a specific order that doesn't match the generation runner's actual execution flow.
**Why it happens:** The generation runner has a specific state machine: BIRTHING (all citizens born) -> INTERACTING (turns run) -> DYING (peak transmissions + citizen:died) -> TRANSMITTING (mutation + write + citizen:peak-transmission).
**How to avoid:** Study the actual emission order in `generation-runner.ts`:
1. `generation:started` (once, at BIRTHING start)
2. `citizen:born` (N times, during BIRTHING via birthCitizen)
3. `citizen:died` (N times, during DYING after peak transmission execution)
4. `transmission:mutated` (0-N times, during TRANSMITTING via mutateTransmission)
5. `citizen:peak-transmission` (N times, during TRANSMITTING via writeTransmission)
6. `generation:ended` (once, after COMPLETE)
**Warning signs:** Summary table shows incomplete data, or events display in unexpected order.

### Pitfall 3: cli-table3 TypeScript Import
**What goes wrong:** `import Table from 'cli-table3'` fails because cli-table3 is a CommonJS package without proper ESM type exports.
**Why it happens:** cli-table3 0.6.5 is CJS. In an ESM project with `"type": "module"`, default imports from CJS packages can be tricky.
**How to avoid:** Use `import Table from 'cli-table3'` with allowSyntheticDefaultImports/esModuleInterop (which TypeScript 6 supports). If that fails, use `import { createRequire } from 'module'` pattern. Test the import early.
**Warning signs:** "does not provide an export named 'default'" error at runtime.

### Pitfall 4: Accumulating State for Generation Summary
**What goes wrong:** The generation summary (EVNT-03) needs to show "who lived, who died, what was transmitted, what mutated" -- but the event payloads don't carry all this information. citizen:born gives (id, role, gen) but citizen:died doesn't repeat the role. citizen:peak-transmission gives (citizenId, transmissionId) but not content.
**Why it happens:** Events are designed for signaling, not for carrying full display data.
**How to avoid:** The EventRenderer must maintain a display-state map during each generation: on citizen:born, record {id, role, generation}; on citizen:died, look up the citizen to add death profile; on citizen:peak-transmission, mark that citizen transmitted; on transmission:mutated, record the mutation type. Then build the summary table from this accumulated state.
**Warning signs:** Summary table has missing columns or "unknown" values.

### Pitfall 5: Detaching Listeners Safely
**What goes wrong:** Using `lineageBus.removeAllListeners()` in the display cleanup removes listeners that subsystems rely on (e.g., mutation pipeline emits transmission:mutated which the display listens to, but other code might also listen).
**Why it happens:** EventEmitter3's `removeAllListeners()` is nuclear -- it removes everything, not just display handlers.
**How to avoid:** Store references to bound handler functions and use `lineageBus.removeListener(event, handler)` for each one in `detach()`.
**Warning signs:** Subsystem tests fail after display integration, or events stop firing for non-display consumers.

## Code Examples

### Color Scheme for Event Types
```typescript
// Recommended color mapping for visual distinction
// Source: CLAUDE.md stack recommendation + terminal UX best practices
import chalk from 'chalk';

const COLORS = {
  birth: chalk.green,        // New life = green
  death: chalk.red,          // Death = red
  transmission: chalk.blue,  // Knowledge transfer = blue
  mutation: chalk.yellow,    // Mutation/corruption = yellow/warning
  generation: chalk.magenta, // Generation boundary = magenta (stands out)
  inheritance: chalk.cyan,   // Inherited knowledge = cyan
  simulation: chalk.bold,    // Simulation start/end = bold white
} as const;
```

### ora Spinner with Event-Safe Logging
```typescript
// Source: ora npm README pattern
import ora from 'ora';

// Start spinner for long operation
const spinner = ora('Citizen citizen-abc123 is thinking...').start();

// When an event needs to log:
spinner.stop();  // or spinner.clear()
console.log(formatBirth(citizenId, role, gen));
spinner.start('Next citizen thinking...');  // resume

// When operation completes:
spinner.succeed('Generation 1 complete');  // or spinner.stop()
```

### cli-table3 Generation Summary
```typescript
// Source: cli-table3 README
import Table from 'cli-table3';
import chalk from 'chalk';

function renderGenerationSummary(citizens: DisplayCitizen[]): void {
  const table = new Table({
    head: ['Citizen', 'Role', 'Death Profile', 'Transmitted', 'Mutated'],
    style: { head: ['cyan'] },
  });

  for (const c of citizens) {
    table.push([
      c.id.slice(0, 8),
      c.role,
      c.deathProfile,
      c.transmitted ? chalk.green('yes') : chalk.gray('no'),
      c.mutationType ?? chalk.gray('-'),
    ]);
  }

  console.log(table.toString());
}
```

### Wiring into cli.ts
```typescript
// In cli.ts action handler, BEFORE runSimulation:
import { EventRenderer } from './display/index.js';

const renderer = new EventRenderer();
renderer.attach();

const generations = await runSimulation(config);

renderer.detach();
```

## Event Emission Audit

Complete audit of all events required by EVNT-01 and their current emission status:

| Event | Required by EVNT-01 | Currently Emitted | Emitted By | Location |
|-------|---------------------|-------------------|------------|----------|
| citizen:born | Yes | Yes | birthCitizen() | src/mortality/citizen-lifecycle.ts:60 |
| citizen:died | Yes | Yes | runGeneration() | src/generation/generation-runner.ts:73 |
| citizen:peak-transmission | Yes | Yes | writeTransmission() | src/transmission/transmission-writer.ts:40 |
| generation:started | Yes | Yes | runGeneration() | src/generation/generation-runner.ts:57 |
| generation:ended | Yes | Yes | runGeneration() | src/generation/generation-runner.ts:97 |
| transmission:mutated | Yes | Yes | mutateTransmission() | src/mutation/mutation-pipeline.ts:56 |
| inheritance:composed | Yes | Yes | composeInheritance() | src/inheritance/inheritance-composer.ts:45,92 |

**Finding: ALL 7 required events are already emitted.** EVNT-01 is satisfied by the existing codebase. Phase 10 work for EVNT-01 is verification/testing only, not new emit() calls.

### Additional Events (Not Required by EVNT-01 but Available)
| Event | Emitted By | Display Use |
|-------|------------|-------------|
| simulation:started | runSimulation() | Display simulation banner with seed problem |
| simulation:ended | runSimulation() | Display final summary |
| state:saved | LineageStateManager.write() | Optional: show file write confirmations |
| state:loaded | LineageStateManager.read() | Optional: show file read confirmations |

## Event Emission Order per Generation

Critical for display logic -- the exact order events fire during one generation cycle:

```
simulation:started(seedProblem, config)       // Once at simulation start
  inheritance:composed(1, 0)                  // Before gen 1 (returns null layers)
  generation:started(1, 5)                    // Gen 1 begins
    citizen:born(id1, 'builder', 1)           // During BIRTHING
    citizen:born(id2, 'skeptic', 1)
    citizen:born(id3, 'archivist', 1)
    citizen:born(id4, 'elder-interpreter', 1)
    citizen:born(id5, 'observer', 1)
    // --- INTERACTING phase: no events, just agent SDK calls ---
    // --- DYING phase ---
    citizen:died(id1, 'old-age', 1)           // After each peak transmission
    citizen:died(id2, 'accident', 1)
    citizen:died(id3, 'old-age', 1)
    citizen:died(id4, 'old-age', 1)
    citizen:died(id5, 'old-age', 1)
    // --- TRANSMITTING phase ---
    transmission:mutated(tx2-mutated, 'small')  // Only for actually mutated ones
    state:saved(path)                           // After each writeTransmission
    citizen:peak-transmission(id1, tx1)         // After writeTransmission
    citizen:peak-transmission(id2, tx2-mutated)
    state:saved(path)
    citizen:peak-transmission(id3, tx3)
    // ... etc
    state:saved(generationsPath)                // Generation state file
  generation:ended(1)                           // Gen 1 complete
  // --- SUMMARY TABLE RENDERS HERE ---
  inheritance:composed(2, 2)                    // Before gen 2
  generation:started(2, 5)                      // Gen 2 begins
  // ... repeat cycle ...
simulation:ended(3)                             // After all generations
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chalk v4 (CJS) | chalk v5+ (ESM-only) | 2022 | Must import as ESM default import, `chalk.red()` etc. |
| ora v5 (CJS) | ora v9+ (ESM-only) | 2023 | Must import as ESM default import |
| cli-table (original) | cli-table3 | 2019 | cli-table3 is the maintained fork with color support |
| log-update v5 (CJS) | log-update v6+ (ESM-only) | 2023 | ESM-only. Latest is v7.2.0 but CLAUDE.md specifies ^6. |

**Deprecated/outdated:**
- chalk v4.x: CJS-only, incompatible with this ESM project
- ora v5-7: Older CJS versions, use v9+
- cli-table (original): Unmaintained, use cli-table3
- log-update v5: CJS, use v6+ for ESM

## Open Questions

1. **cli-table3 CJS/ESM interop**
   - What we know: cli-table3 is a CJS package. The project is ESM (`"type": "module"`). Node 24 with tsx should handle the interop.
   - What's unclear: Whether the default import pattern works cleanly or needs workarounds.
   - Recommendation: Test the import in an early task. If it fails, use `import { createRequire } from 'module'; const Table = createRequire(import.meta.url)('cli-table3');` as fallback.

2. **log-update: Install or Defer?**
   - What we know: CLAUDE.md lists it as MEDIUM confidence. Latest is v7.2.0 (CLAUDE.md says ^6.0.0). The event stream is linear (sequential execution), so ora + console.log may suffice.
   - What's unclear: Whether the spinner-log interleaving will be smooth enough without log-update's overwrite capability.
   - Recommendation: Start without log-update. Add it only if spinner/log interleaving is unsatisfactory during testing.

3. **Spinner granularity**
   - What we know: Agent SDK calls take 10-30s each. There are N citizens per generation, each doing a turn (INTERACTING) and a peak transmission (DYING).
   - What's unclear: Whether to show one spinner per phase ("Generation 1: Citizens interacting...") or per citizen ("citizen-abc123 is thinking...").
   - Recommendation: Per-citizen spinners for the INTERACTING and DYING phases (shows progress and which citizen is active). Phase-level spinner for TRANSMITTING (mutations are fast).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 24.7.0 | -- |
| pnpm | Package install | Yes | 10.28.1 | -- |
| chalk | EVNT-02 coloring | No (not installed) | -- | Install: `pnpm add chalk@^5.4.0` |
| ora | EVNT-02 spinners | No (not installed) | -- | Install: `pnpm add ora@^9.0.0` |
| cli-table3 | EVNT-03 summary tables | No (not installed) | -- | Install: `pnpm add cli-table3@^0.6.5` |
| EventEmitter3 | Event bus | Yes | 5.0.4 | -- |
| Vitest | Testing | Yes | 4.1.1 | -- |
| tsx | Development execution | Yes | 4.21.0 | -- |

**Missing dependencies with no fallback:**
- chalk, ora, cli-table3 must be installed via pnpm before implementation begins

**Missing dependencies with fallback:**
- log-update: Not needed for v1. ora + console.log is the fallback.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/display/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVNT-01 | All 7 event types fire during simulation lifecycle | integration | `npx vitest run src/display/display.test.ts -t "EVNT-01" -x` | No -- Wave 0 |
| EVNT-02 | Formatters produce correct chalk-colored strings for each event type | unit | `npx vitest run src/display/display.test.ts -t "EVNT-02" -x` | No -- Wave 0 |
| EVNT-02 | EventRenderer subscribes to all events and calls formatters | unit | `npx vitest run src/display/display.test.ts -t "renderer" -x` | No -- Wave 0 |
| EVNT-03 | Generation summary table built with correct columns from accumulated state | unit | `npx vitest run src/display/display.test.ts -t "EVNT-03" -x` | No -- Wave 0 |
| EVNT-03 | Summary renders at generation:ended with all citizen data | unit | `npx vitest run src/display/display.test.ts -t "summary" -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/display/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (317 existing + new display tests) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/display/display.test.ts` -- covers EVNT-01, EVNT-02, EVNT-03
- [ ] Package install: `pnpm add chalk@^5.4.0 ora@^9.0.0 cli-table3@^0.6.5`

## Project Constraints (from CLAUDE.md)

### Tech Stack (Locked)
- TypeScript 6.0.2, ESM-only (`"type": "module"`)
- EventEmitter3 5.0.4 for typed event bus (lineageBus singleton)
- Vitest 4.1.1 for testing
- pnpm for package management
- No build step -- tsx for dev, direct TS imports

### Display Libraries (Locked by CLAUDE.md)
- chalk ^5.4.0 for terminal colors (NOT picocolors, NOT chalk v4)
- ora ^9.0.0 for spinners (NOT manual process.stdout.write)
- cli-table3 ^0.6.5 for summary tables (NOT console.table)
- log-update ^6.0.0 is optional/deferred

### Avoid (Explicitly Forbidden)
- winston/pino (LINEAGE output IS the product, not JSON logs)
- blessed/terminal-kit (not a TUI app)
- inquirer/prompts (headless execution, no interactive prompts)
- ink (React for CLI -- massive overkill)

### Architecture Constraints
- lineageBus is standalone EventEmitter (not Genesis bus) for standalone operation
- No modification to existing subsystem code for display purposes
- Display is additive subscriber layer only

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/events/types.ts`, `src/events/bus.ts` -- complete LineageEvents type definition with all 7 EVNT-01 events
- Codebase inspection: `src/generation/generation-runner.ts`, `src/generation/simulation-runner.ts` -- verified event emission order
- Codebase inspection: `src/mortality/citizen-lifecycle.ts`, `src/mutation/mutation-pipeline.ts`, `src/transmission/transmission-writer.ts`, `src/inheritance/inheritance-composer.ts` -- verified all subsystem emit calls
- npm registry: chalk 5.6.2, ora 9.3.0, cli-table3 0.6.5, log-update 7.2.0 -- verified current versions
- CLAUDE.md stack specification -- locked library choices and version ranges

### Secondary (MEDIUM confidence)
- cli-table3 CJS/ESM interop -- Node 24 + tsx handles CJS default imports, but edge cases may exist

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries explicitly specified in CLAUDE.md with versions. npm versions verified.
- Architecture: HIGH -- event bus already exists and emits all required events. Display is purely additive.
- Pitfalls: HIGH -- identified from direct codebase inspection of event emission order and library compatibility.

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries, no fast-moving dependencies)
