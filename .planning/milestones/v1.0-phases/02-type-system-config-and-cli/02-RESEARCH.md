# Phase 2: Type System, Config, and CLI - Research

**Researched:** 2026-03-24
**Domain:** Zod 4 schemas, EventEmitter3 typed events, state persistence, Commander CLI, simulation configuration
**Confidence:** HIGH

## Summary

Phase 2 transforms LINEAGE from a proof-of-concept into a properly typed, configurable simulation framework. The work falls into four domains: (1) Zod 4 schemas that define every entity in the simulation -- citizens, transmissions, generations, death profiles -- extending the Genesis AgentConfig schema; (2) typed LineageEvents that compose with the Genesis event bus without replacing it; (3) state persistence using the Genesis StateManager pattern with atomic writes and Zod validation; (4) a Commander-based CLI that accepts a seed problem and optional configuration overrides.

All core libraries are already installed except Commander (^14.0.0). Zod 4.3.6, EventEmitter3 5.0.4, and nanoid 5.1.7 are present in node_modules. The Genesis `@genesis/shared` package provides the `StateManager`, `atomicWrite`, `bus` singleton, `AgentConfigSchema`, and `GenesisEvents` interface that LINEAGE extends. Phase 1 already proved these imports resolve correctly.

The critical design decision is schema architecture: LINEAGE schemas must **extend** Genesis schemas (using Zod `.extend()` or spread syntax on `.shape`), not fork them. CitizenConfig extends AgentConfig. LineageEvents is a separate interface that gets composed with GenesisEvents on the bus. The entry point (`src/index.ts`) must be refactored from the Phase 1 proof-of-concept into a Commander CLI that parses arguments, loads config, validates with Zod, and bootstraps the simulation.

**Primary recommendation:** Define all schemas in `src/schemas/`, events in `src/events/`, state management in `src/state/`, config loading in `src/config/`, and CLI in `src/cli.ts`. Install Commander ^14.0.0 as the only new dependency. Use Zod `.extend()` on AgentConfigSchema.shape to create CitizenConfigSchema.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-04 | Zod schemas defined for CitizenConfig, SimulationParameters, and all core types extending @genesis/shared | Zod 4 `.extend()` on `AgentConfigSchema.shape`, `z.enum()` for roles/death profiles, `z.discriminatedUnion()` for transmission types |
| FOUND-05 | Typed LineageEvents defined and emitting on EventEmitter3 event bus | Separate `LineageEvents` interface, compose with `GenesisEvents` via intersection type on new bus instance |
| FOUND-06 | State persistence via JSON files with atomic writes (following Genesis StateManager pattern) | Reuse `StateManager` from `@genesis/shared` directly -- it already handles atomic writes, Zod validation, and event emission |
| CONF-01 | All simulation parameters as mutable JSON config validated with Zod | `SimulationParametersSchema` with `.default()` on every field for zero-config startup |
| CONF-02 | Parameters include: generationSize, deathProfileDistribution, mutationRate, largeMutationProbability, roleDistribution, gen1Protection, peakTransmissionWindow, inheritanceStagingRates, maxGenerations | Each parameter as a Zod field with sensible defaults; distribution objects use `z.record()` with enum keys |
| CONF-03 | Seed problem passed as CLI argument at launch | Commander positional argument `<seed-problem>` -- required, no default |
| CONF-04 | CLI entry point using Commander for argument parsing | `src/cli.ts` with Commander `program.argument('<seed-problem>').option('--config <path>')` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: TypeScript 6.0.2, ESM-only (`"type": "module"`), `verbatimModuleSyntax: true`
- **Schema compatibility**: Must extend Genesis schemas (`AgentConfigSchema`, etc.), not fork them
- **Event compatibility**: Must compose with Genesis event bus (`EventEmitter3`), not replace it
- **No build step**: Direct TS imports via tsx (Genesis pattern)
- **Zod 4 only**: Agent SDK peer-depends on `zod ^4.0.0`; Genesis is on Zod 4.3.6
- **Vitest 4**: All tests run with `vitest run`; test files colocated as `*.test.ts`
- **Import conventions**: `import type` required for type-only imports (verbatimModuleSyntax); `.js` extensions on relative imports (nodenext resolution)
- **No interactive prompts**: Simulation runs headlessly after receiving CLI args
- **No winston/pino**: Console output IS the product
- **No bundler**: tsx for development, no tsdown/tsup

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 | Schema validation for all types | Peer dep of Agent SDK. Genesis standard. `.extend()`, `.shape` spread, `z.infer<>` for type extraction. |
| EventEmitter3 | 5.0.4 | Typed event bus | Genesis singleton pattern. `new EventEmitter<EventMap>()` for type-safe emit/on. |
| nanoid | 5.1.7 | ID generation | Genesis pattern for citizen IDs, transmission IDs, generation IDs. `nanoid()` returns 21-char string. |
| @genesis/shared | file: protocol | StateManager, bus, AgentConfigSchema | Direct reuse of atomic writes, schema validation, event emission. |

### New Dependencies (Install in Phase 2)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| commander | 14.0.3 | CLI argument parsing | Single entry point: parse seed problem (positional), --generations, --config path, --output-dir |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Commander ^14 | yargs | Yargs more powerful but verbose. LINEAGE CLI is simple: one positional + few flags. Commander lighter. |
| Commander ^14 | process.argv manual parsing | No validation, no help generation, error-prone. Wastes hackathon time. |
| Reusing Genesis StateManager | Custom state class | StateManager already does atomic writes + Zod validation + event emission. Don't rebuild. |
| Separate LineageEvents bus | Merging into Genesis bus | LINEAGE should create its own bus for standalone operation. When combined into Genesis monorepo, buses can be composed. |

**Installation:**
```bash
pnpm add commander@^14.0.0
```

**Version verification:**
- `zod`: 4.3.6 (verified via npm registry and local node_modules -- current as of 2026-03-24)
- `commander`: 14.0.3 (verified via `npm view commander version` -- current as of 2026-03-24)
- `eventemitter3`: 5.0.4 (verified via npm registry and local node_modules -- current)
- `nanoid`: 5.1.7 (verified via npm registry and local node_modules -- current)

## Architecture Patterns

### Recommended Project Structure
```
src/
  schemas/           # All Zod schemas and inferred types
    citizen.ts       # CitizenConfig extending AgentConfig
    simulation.ts    # SimulationParameters with all config fields
    generation.ts    # Generation, GenerationPhase state machine
    transmission.ts  # Transmission types (peak, elder, accident)
    death-profile.ts # DeathProfile enum and distribution
    role.ts          # CitizenRole enum and distribution
    index.ts         # Barrel export of all schemas + types
  events/
    types.ts         # LineageEvents interface
    bus.ts           # Lineage event bus (new EventEmitter<LineageEvents>())
    index.ts         # Barrel export
  state/
    manager.ts       # LineageStateManager wrapping Genesis StateManager
    index.ts         # Barrel export
  config/
    defaults.ts      # Default SimulationParameters values
    loader.ts        # Load config from file, merge with defaults, validate
    index.ts         # Barrel export
  cli.ts             # Commander CLI entry point (NEW main entry)
  index.ts           # Library barrel export (schemas, events, types)
```

### Pattern 1: Schema Extension via Zod `.extend()`

**What:** CitizenConfig extends Genesis AgentConfigSchema by adding LINEAGE-specific fields (role, generationNumber, deathProfile, etc.) while inheriting all base fields.

**When to use:** Any LINEAGE type that IS-A Genesis type with extra fields.

**Example:**
```typescript
// Source: Zod 4 docs (https://zod.dev/api) + Genesis AgentConfigSchema
import { z } from 'zod';
import { AgentConfigSchema } from '@genesis/shared';

export const CitizenRoleSchema = z.enum([
  'builder',
  'skeptic',
  'archivist',
  'elder-interpreter',
  'observer',
]);

export const DeathProfileSchema = z.enum([
  'old-age',
  'accident',
]);

export const CitizenConfigSchema = AgentConfigSchema.extend({
  role: CitizenRoleSchema,
  generationNumber: z.number().int().positive(),
  deathProfile: DeathProfileSchema,           // hidden from citizen
  contextBudget: z.number().min(0).max(1).default(0),
  birthTimestamp: z.string().datetime(),
  deathTimestamp: z.string().datetime().optional(),
  transmissions: z.array(z.string()).default([]),  // transmission IDs
});

export type CitizenConfig = z.infer<typeof CitizenConfigSchema>;
```

### Pattern 2: Typed Event Bus with EventEmitter3

**What:** Define a LineageEvents interface mapping event names to listener signatures, then create a typed bus instance.

**When to use:** All LINEAGE event emission and subscription.

**Example:**
```typescript
// Source: EventEmitter3 TypeScript generics + Genesis bus.ts pattern
import { EventEmitter } from 'eventemitter3';

export interface LineageEvents {
  'citizen:born': (citizenId: string, role: string, generation: number) => void;
  'citizen:died': (citizenId: string, deathProfile: string, generation: number) => void;
  'citizen:peak-transmission': (citizenId: string, transmissionId: string) => void;
  'generation:started': (generationNumber: number, citizenCount: number) => void;
  'generation:ended': (generationNumber: number) => void;
  'transmission:mutated': (transmissionId: string, mutationType: string) => void;
  'inheritance:composed': (generationNumber: number, layerCount: number) => void;
  'simulation:started': (seedProblem: string, config: unknown) => void;
  'simulation:ended': (generationCount: number) => void;
  'state:saved': (filePath: string) => void;
  'state:loaded': (filePath: string) => void;
}

export const lineageBus = new EventEmitter<LineageEvents>();
```

### Pattern 3: SimulationParameters as Zod Schema with Full Defaults

**What:** Every simulation parameter has a sensible default so the simulation can run with zero config.

**When to use:** CONF-01, CONF-02 -- the config schema that drives the entire simulation.

**Example:**
```typescript
// Source: Requirements CONF-02
import { z } from 'zod';
import { CitizenRoleSchema, DeathProfileSchema } from './citizen.js';

export const SimulationParametersSchema = z.object({
  generationSize: z.number().int().min(1).max(20).default(5),
  maxGenerations: z.number().int().min(1).max(100).default(3),
  deathProfileDistribution: z.object({
    'old-age': z.number().min(0).max(1).default(0.7),
    'accident': z.number().min(0).max(1).default(0.3),
  }).default({}),
  mutationRate: z.number().min(0).max(1).default(0.3),
  largeMutationProbability: z.number().min(0).max(1).default(0.1),
  roleDistribution: z.object({
    'builder': z.number().min(0).max(1).default(0.3),
    'skeptic': z.number().min(0).max(1).default(0.2),
    'archivist': z.number().min(0).max(1).default(0.2),
    'elder-interpreter': z.number().min(0).max(1).default(0.15),
    'observer': z.number().min(0).max(1).default(0.15),
  }).default({}),
  gen1Protection: z.boolean().default(true),
  peakTransmissionWindow: z.object({
    min: z.number().min(0).max(1).default(0.4),
    max: z.number().min(0).max(1).default(0.5),
  }).default({}),
  inheritanceStagingRates: z.object({
    seedLayerAtBirth: z.boolean().default(true),
    recentLayerThreshold: z.number().min(0).max(1).default(0.25),
  }).default({}),
  outputDir: z.string().default('./output'),
  seedProblem: z.string().min(1),
});

export type SimulationParameters = z.infer<typeof SimulationParametersSchema>;
```

### Pattern 4: Commander CLI with Typed Options

**What:** Parse seed problem as required positional argument, flags for optional overrides, load and validate config.

**When to use:** CONF-03, CONF-04 -- the CLI entry point.

**Example:**
```typescript
// Source: Commander.js docs (https://github.com/tj/commander.js)
import { Command } from 'commander';

const program = new Command();

program
  .name('lineage')
  .description('A civilization simulator where every citizen is an AI agent')
  .version('0.0.0')
  .argument('<seed-problem>', 'The philosophical problem for the civilization to explore')
  .option('-g, --generations <count>', 'number of generations to simulate', '3')
  .option('-s, --size <count>', 'citizens per generation', '5')
  .option('-c, --config <path>', 'path to JSON config file')
  .option('-o, --output <dir>', 'output directory for state files', './output')
  .action(async (seedProblem: string, options: Record<string, string>) => {
    // 1. Load config from file if --config provided
    // 2. Merge CLI overrides onto config
    // 3. Validate with SimulationParametersSchema.parse()
    // 4. Bootstrap simulation
  });

program.parse();
```

### Pattern 5: State Persistence via Genesis StateManager

**What:** Reuse Genesis StateManager for read/write with Zod validation and atomic writes.

**When to use:** FOUND-06 -- persisting simulation state, generation state, citizen data.

**Example:**
```typescript
// Source: Genesis @genesis/shared/state/manager.ts (direct inspection)
import { StateManager } from '@genesis/shared';
import { SimulationParametersSchema } from '../schemas/simulation.js';
import type { SimulationParameters } from '../schemas/simulation.js';

const stateManager = new StateManager('./output');

// Write state (validates against schema before writing, emits 'state:written' event)
await stateManager.write(
  './output/simulation.json',
  simulationParams,
  SimulationParametersSchema,
  'simulation-parameters',
);

// Read state (parses JSON, validates against schema, returns typed data)
const loaded: SimulationParameters = await stateManager.read(
  './output/simulation.json',
  SimulationParametersSchema,
);
```

### Pattern 6: Config Loading with File + CLI Merge

**What:** Config can come from a JSON file, CLI flags, or both. CLI flags override file values. Everything validates through Zod.

**When to use:** When bootstrapping the simulation from `cli.ts`.

**Example:**
```typescript
import { readFile } from 'node:fs/promises';
import { SimulationParametersSchema } from '../schemas/simulation.js';

export async function loadConfig(
  seedProblem: string,
  options: { config?: string; generations?: string; size?: string; output?: string },
): Promise<SimulationParameters> {
  // Start with empty object -- Zod defaults fill everything
  let rawConfig: Record<string, unknown> = {};

  // Load from file if provided
  if (options.config) {
    const fileContent = await readFile(options.config, 'utf-8');
    rawConfig = JSON.parse(fileContent);
  }

  // CLI overrides take precedence
  if (options.generations) rawConfig.maxGenerations = parseInt(options.generations, 10);
  if (options.size) rawConfig.generationSize = parseInt(options.size, 10);
  if (options.output) rawConfig.outputDir = options.output;
  rawConfig.seedProblem = seedProblem;

  // Validate and fill defaults
  return SimulationParametersSchema.parse(rawConfig);
}
```

### Anti-Patterns to Avoid

- **Forking Genesis schemas:** Never copy AgentConfigSchema into LINEAGE code. Always import and `.extend()`.
- **Replacing the Genesis bus:** LINEAGE creates its own bus instance for standalone use. When integrated into Genesis, both buses are available -- do not monkey-patch GenesisEvents.
- **Inline validation:** Never use `JSON.parse()` without Zod validation. Always `schema.parse(JSON.parse(raw))`.
- **Mutable config objects:** Config should be parsed once at startup and treated as immutable during a simulation run. Pass by value, not reference.
- **Optional seedProblem:** The seed problem MUST be required (no default). It is the simulation's philosophical starting point.
- **Zod v3 patterns:** Do not use `z.nativeEnum()` (removed in Zod 4). Use `z.enum()` for all enums. Do not use `.merge()` on objects (deprecated in Zod 4) -- use `.extend()` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom temp-file-rename logic | `atomicWrite()` from `@genesis/shared` | Handles temp file cleanup, directory creation, rename-over pattern. Already tested in Genesis with concurrent write tests. |
| Schema validation + file I/O | Manual JSON.parse + type assertions | `StateManager` from `@genesis/shared` | Combines atomic write + Zod validation + event emission in one call. Already battle-tested. |
| CLI argument parsing | `process.argv` slicing | `commander` ^14 | Help generation, argument type coercion, error messages. 35M weekly downloads. |
| Event type safety | Manual type assertions on emit/on | `EventEmitter<LineageEvents>` generic | EventEmitter3 generics enforce correct argument types at compile time. Zero runtime cost. |
| ID generation | `Math.random().toString(36)` | `nanoid()` | Collision-resistant, URL-safe, 21-char IDs. Already in Genesis shared. |

**Key insight:** LINEAGE gets state management, atomic writes, and event bus infrastructure for free from Genesis shared. The work is defining the Zod schemas and wiring the CLI -- not building infrastructure.

## Common Pitfalls

### Pitfall 1: Zod `.extend()` vs Spread on `.shape`
**What goes wrong:** Using `.merge()` which is deprecated in Zod 4, or not understanding that `.extend()` creates a new schema (does not mutate the original).
**Why it happens:** Zod 3 docs still appear in search results and recommend `.merge()`.
**How to avoid:** Always use `BaseSchema.extend({ newField: z.string() })` or spread syntax `z.object({ ...BaseSchema.shape, newField: z.string() })`. Both are equivalent in Zod 4. Never use `.merge()`.
**Warning signs:** TypeScript error about `.merge` not being a function, or unexpected schema shape.

### Pitfall 2: Distribution Objects Not Summing to 1.0
**What goes wrong:** deathProfileDistribution or roleDistribution weights don't sum to 1.0, causing weighted random selection to be biased or broken.
**Why it happens:** Zod validates individual field ranges (0-1) but not cross-field invariants.
**How to avoid:** Add a `.refine()` on the distribution objects that checks the sum is approximately 1.0. Or normalize at runtime before use (divide each weight by the sum). Runtime normalization is more robust -- allows users to specify relative weights like `{ builder: 3, skeptic: 2 }` that get normalized.
**Warning signs:** Role distribution that never produces certain roles, or death profile that never fires.

### Pitfall 3: Forgetting `.js` Extensions on Relative Imports
**What goes wrong:** TypeScript compiles but tsx/node fails at runtime with `ERR_MODULE_NOT_FOUND`.
**Why it happens:** `moduleResolution: "nodenext"` requires `.js` extensions on relative imports even though source files are `.ts`. Package imports (e.g., `@genesis/shared`) do NOT need extensions.
**How to avoid:** Every relative import must end in `.js`: `import { foo } from './bar.js'`.
**Warning signs:** `ERR_MODULE_NOT_FOUND` at runtime but clean TypeScript compilation.

### Pitfall 4: Forgetting `import type` for Type-Only Imports
**What goes wrong:** TypeScript error: "This import is never used as a value and must use 'import type'".
**Why it happens:** `verbatimModuleSyntax: true` in tsconfig requires explicit `import type` for anything used only in type position.
**How to avoid:** Use `import type { Foo }` when importing interfaces, type aliases, or inferred types that are never referenced as runtime values.
**Warning signs:** Compilation errors mentioning `verbatimModuleSyntax`.

### Pitfall 5: Genesis Bus is a Singleton -- Don't Import It for LINEAGE Events
**What goes wrong:** Importing Genesis `bus` and emitting LINEAGE events on it creates a type error because GenesisEvents doesn't include LineageEvents.
**Why it happens:** Temptation to use the one bus for everything.
**How to avoid:** Create a separate `lineageBus` instance typed with `LineageEvents`. When LINEAGE is integrated into Genesis, the buses can be bridged. For standalone operation, the lineage bus is self-contained.
**Warning signs:** TypeScript errors about event names not existing on the bus type.

### Pitfall 6: Commander `parse()` Must Be Called Last
**What goes wrong:** Commander silently ignores options/arguments defined after `parse()`.
**Why it happens:** Commander processes arguments during `parse()`, not lazily.
**How to avoid:** Always define all `.argument()`, `.option()`, `.action()` BEFORE calling `.parse()`.
**Warning signs:** Options always undefined, arguments not captured.

### Pitfall 7: JSON Config File Read Without Existence Check
**What goes wrong:** `readFile` throws `ENOENT` if the config file doesn't exist, crashing the CLI.
**Why it happens:** User may not pass `--config` flag, or path may be wrong.
**How to avoid:** Only read config file if `--config` option is provided. Wrap in try/catch with helpful error message. Default config (via Zod defaults) should work without any config file.
**Warning signs:** Unhandled promise rejection at startup.

## Code Examples

Verified patterns from official sources:

### Zod 4 Schema with Defaults and Refinement
```typescript
// Source: https://zod.dev/api
import { z } from 'zod';

const DeathDistributionSchema = z.object({
  'old-age': z.number().min(0).max(1).default(0.7),
  'accident': z.number().min(0).max(1).default(0.3),
}).refine(
  (dist) => {
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1.0) < 0.01;
  },
  { message: 'Death profile distribution must sum to approximately 1.0' },
);
```

### EventEmitter3 Typed Bus Pattern
```typescript
// Source: EventEmitter3 index.d.ts + Genesis bus.ts
import { EventEmitter } from 'eventemitter3';

interface MyEvents {
  'data': (payload: string) => void;
  'error': (err: Error) => void;
}

const emitter = new EventEmitter<MyEvents>();
emitter.on('data', (payload) => { /* payload is string */ });
emitter.emit('data', 'hello'); // type-checked
// emitter.emit('data', 42);   // compile error: number not assignable to string
```

### Commander v14 Positional Argument + Options
```typescript
// Source: https://github.com/tj/commander.js
import { Command } from 'commander';

const program = new Command();

program
  .argument('<seed-problem>', 'philosophical question for the civilization')
  .option('-g, --generations <count>', 'max generations', '3')
  .option('-c, --config <path>', 'config file path')
  .action((seedProblem, opts) => {
    console.log(`Seed: ${seedProblem}`);
    console.log(`Generations: ${opts.generations}`);
  });

program.parse(process.argv);
```

### Genesis StateManager Read/Write Roundtrip
```typescript
// Source: Genesis @genesis/shared/src/state/manager.ts (direct code inspection)
import { StateManager } from '@genesis/shared';
import { z } from 'zod';

const Schema = z.object({ id: z.string(), value: z.number() });
const manager = new StateManager('./data');

// Write: validates with Zod, writes atomically, emits 'state:written'
await manager.write('./data/test.json', { id: 'x', value: 42 }, Schema, 'test');

// Read: parses JSON, validates with Zod, returns typed result
const data = await manager.read('./data/test.json', Schema);
// data.id is string, data.value is number -- fully typed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod 3 `.merge()` | Zod 4 `.extend()` or spread `.shape` | Zod 4.0 (2025) | `.merge()` deprecated; use `.extend()` for object composition |
| Zod 3 `z.nativeEnum()` | Zod 4 `z.enum()` handles TS enums | Zod 4.0 (2025) | Unified enum API |
| Zod 3 `z.promise()` | Zod 4: await before parse | Zod 4.0 (2025) | `z.promise()` deprecated |
| Commander <12 `opts()` untyped | Commander 14 TypeScript generics | Commander 14 (2025) | Type-safe option access |
| `ts-node` for execution | `tsx` ^4 | 2024-2025 | Faster, better ESM support |

**Deprecated/outdated:**
- `z.merge()`: Deprecated in Zod 4. Use `.extend()` instead.
- `z.nativeEnum()`: Removed in Zod 4. Use `z.enum()` for all enum patterns.
- `z.promise()`: Deprecated in Zod 4. Await values before parsing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (exists from Phase 1) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-04 | CitizenConfig schema validates correct citizen data and rejects malformed input | unit | `npx vitest run src/schemas/schemas.test.ts -t "CitizenConfig" -x` | Wave 0 |
| FOUND-04 | SimulationParameters schema validates all config fields with defaults | unit | `npx vitest run src/schemas/schemas.test.ts -t "SimulationParameters" -x` | Wave 0 |
| FOUND-04 | All schemas (Generation, Transmission, DeathProfile, Role) validate correctly | unit | `npx vitest run src/schemas/schemas.test.ts -x` | Wave 0 |
| FOUND-05 | LineageEvents typed bus emits and receives events with correct payload types | unit | `npx vitest run src/events/events.test.ts -x` | Wave 0 |
| FOUND-06 | State can be persisted to JSON and loaded back with identical data | unit | `npx vitest run src/state/state.test.ts -x` | Wave 0 |
| CONF-01 | Config from JSON file is validated with Zod and rejects invalid config | unit | `npx vitest run src/config/config.test.ts -t "validation" -x` | Wave 0 |
| CONF-02 | All simulation parameters have defaults and are accessible after parse | unit | `npx vitest run src/config/config.test.ts -t "defaults" -x` | Wave 0 |
| CONF-03 | Seed problem parsed from CLI argument | unit | `npx vitest run src/cli.test.ts -t "seed problem" -x` | Wave 0 |
| CONF-04 | Commander CLI accepts seed problem, --generations, --config, --output flags | unit | `npx vitest run src/cli.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/schemas/schemas.test.ts` -- covers FOUND-04 (all schema validation)
- [ ] `src/events/events.test.ts` -- covers FOUND-05 (LineageEvents bus)
- [ ] `src/state/state.test.ts` -- covers FOUND-06 (state persistence roundtrip)
- [ ] `src/config/config.test.ts` -- covers CONF-01, CONF-02 (config loading + validation)
- [ ] `src/cli.test.ts` -- covers CONF-03, CONF-04 (CLI argument parsing)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | Yes | 24.7.0 | -- |
| pnpm | Package install | Yes | 10.28.1 | -- |
| tsx | Runtime execution | Yes | ^4.21.0 (via npx) | -- |
| Zod 4 | Schema validation | Yes | 4.3.6 | -- |
| EventEmitter3 | Event bus | Yes | 5.0.4 | -- |
| nanoid | ID generation | Yes | 5.1.7 | -- |
| commander | CLI parsing | No (not installed) | -- | Install: `pnpm add commander@^14.0.0` |
| @genesis/shared | StateManager, bus, schemas | Yes | file: protocol | -- |
| Vitest | Testing | Yes | 4.1.1 | -- |

**Missing dependencies with no fallback:**
- None -- all missing deps can be installed.

**Missing dependencies with fallback:**
- `commander` 14.0.3 -- not installed yet. Install with `pnpm add commander@^14.0.0`.

## Open Questions

1. **Distribution validation strategy: refine vs normalize?**
   - What we know: deathProfileDistribution and roleDistribution should sum to ~1.0. Zod `.refine()` can validate this. Runtime normalization is an alternative.
   - What's unclear: Should invalid distributions be rejected (strict) or auto-normalized (forgiving)?
   - Recommendation: Use runtime normalization (divide by sum). More forgiving for users, allows relative weights like `{ builder: 3, skeptic: 2 }`. Add a `.refine()` warning if sum deviates more than 50% from 1.0 to catch obvious typos.

2. **Where should seedProblem live in the type system?**
   - What we know: seedProblem comes from CLI, is stored in SimulationParameters, and is passed to every citizen agent.
   - What's unclear: Should it be a field in SimulationParameters or a separate top-level entity?
   - Recommendation: Include in SimulationParameters as a required field (`z.string().min(1)`, no default). This keeps config self-contained and serializable.

3. **Generation state schema: how much to define now vs Phase 9?**
   - What we know: Phase 9 (Generation Manager) needs INIT/BIRTHING/INTERACTING/DYING/TRANSMITTING/COMPLETE states.
   - What's unclear: Should Phase 2 define the full GenerationPhase enum and Generation schema, or just stub it?
   - Recommendation: Define the GenerationPhase enum and basic Generation schema now. Other phases will need to reference these types. The schema can evolve but the core structure should exist.

## Sources

### Primary (HIGH confidence)
- Zod 4 official API docs -- https://zod.dev/api (`.extend()`, `.shape`, `z.enum()`, `z.discriminatedUnion()`, `z.refine()`)
- Commander.js GitHub -- https://github.com/tj/commander.js (v14.0.3, positional arguments, typed options)
- Genesis `@genesis/shared` source code -- `/Users/memehalis/genesis/packages/shared/src/` (direct inspection of StateManager, bus, AgentConfigSchema, GenesisEvents)
- EventEmitter3 TypeScript definitions -- `/Users/memehalis/lineage/node_modules/eventemitter3/index.d.ts` (generic `EventEmitter<EventTypes>` pattern)
- npm registry versions -- `npm view zod version` (4.3.6), `npm view commander version` (14.0.3), `npm view eventemitter3 version` (5.0.4), `npm view nanoid version` (5.1.7)

### Secondary (MEDIUM confidence)
- DeepWiki Zod schema composition -- https://deepwiki.com/colinhacks/zod/4.3-composition-and-manipulation (extend vs merge patterns)
- BetterStack Commander.js guide -- https://betterstack.com/community/guides/scaling-nodejs/commander-explained/ (v14 TypeScript patterns)

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries are installed and verified, versions confirmed against npm registry
- Architecture: HIGH -- patterns directly observed in Genesis shared codebase; Zod 4 API verified against official docs
- Pitfalls: HIGH -- Zod 3->4 migration pitfalls verified against official docs; ESM import issues confirmed by existing Phase 1 patterns

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable libraries, unlikely to change in 30 days)
