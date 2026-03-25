# Phase 8: Inheritance Composer - Research

**Researched:** 2026-03-24
**Domain:** Cross-generation knowledge delivery with staged timing, transmission aggregation, and LLM-powered compression
**Confidence:** HIGH

## Summary

The inheritance composer is the bridge between generations in LINEAGE. Without it, each generation starts from scratch with only the seed problem. With it, citizens are born carrying compressed ancestral knowledge (seed layer) and later receive recent transmissions from their immediate predecessors (recent layer). This is what transforms isolated generations into a civilization -- knowledge accumulates, drifts, and evolves across time.

The implementation sits between the mutation pipeline (Phase 7, which produces the final mutated transmissions) and the generation manager (Phase 9, which orchestrates full lifecycle). The inheritance composer's job is: (1) read all transmissions from previous generations on disk, (2) compose a compressed "seed layer" from the oldest, most-repeated knowledge across all generations, (3) compose a "recent layer" from the most recent generation's transmissions, and (4) deliver these layers to new citizens at configurable lifecycle moments -- seed at birth (injected into the system prompt or first turn context), recent at maturity (when ContextBudget reaches `recentLayerThreshold`, default 25%).

The key design challenge is **compression**. A civilization that has run 5 generations might have 25 transmissions with 100+ anchor tokens. Delivering all of this raw to a new citizen would consume too much context budget (remember: context IS lifespan). The seed layer must be a compressed summary -- the most durable, most repeated ideas distilled into a handful of claims. The recent layer can be fuller but still needs to be bounded. This compression is the inheritance composer's core value: it decides what knowledge survives across generations and what is lost, creating the selective pressure that produces emergent cultural character.

**Primary recommendation:** Build the inheritance composer as a `src/inheritance/` module with four files: `transmission-reader.ts` (reads transmissions from disk by generation), `seed-layer.ts` (compresses multi-generation knowledge into oldest/most-repeated summary via LLM), `recent-layer.ts` (formats recent generation transmissions for delivery), and `inheritance-composer.ts` (orchestrator that wires reading, compression, and delivery timing). The seed layer uses an Agent SDK `query()` call for LLM-powered compression. The recent layer is a pure formatting function (no LLM needed). Delivery timing integrates with ContextBudget thresholds.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INHR-01 | Seed layer delivered at birth -- compressed summary of civilization's oldest, most repeated knowledge | Implement via `buildSeedLayer()` which reads all transmissions from generations 1 through N-1, extracts all anchor tokens, and uses an Agent SDK `query()` call to compress them into a concise summary of the most durable knowledge. Delivered at birth by injecting into the citizen's first turn prompt (augmenting `buildTurnPrompt` for the first citizen, or as a preamble to the seed problem). For generation 1, no seed layer exists (they are the founders). |
| INHR-02 | Recent layer delivered at maturity (~20-30% context) -- fuller detail of most recent generation's transmissions | Implement via `buildRecentLayer()` which reads transmissions from generation N-1 only and formats them as a structured knowledge delivery. Delivered when ContextBudget crosses `recentLayerThreshold` (default 0.25). This is a pure formatting function -- no LLM compression needed because recent transmissions are already structured anchor tokens from a single generation. Uses a new ContextThreshold label `'inheritance-recent'` that the generation manager (Phase 9) will listen for. |
| INHR-03 | Inheritance staging rates configurable via simulation parameters | Already partially implemented: `SimulationParametersSchema.inheritanceStagingRates` exists with `seedLayerAtBirth: boolean` (default true) and `recentLayerThreshold: number` (default 0.25). The inheritance composer respects these values: if `seedLayerAtBirth` is false, no seed layer is delivered; `recentLayerThreshold` controls when the recent layer triggers. Changing these values in config changes delivery timing. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | ^0.2.81 | Execute seed layer compression LLM call | Already installed. `query()` pattern proven in Phases 5, 6, 7. Seed layer compression is an LLM-powered summarization task -- same execution pattern as mutation and transmission. |
| Zod | 4.3.6 | Validate composed inheritance layers and transmission reading | Already installed. `TransmissionSchema` for reading transmissions from disk. New schema for `InheritancePackage` to validate composed output. |
| nanoid | 5.1.7 | Generate unique IDs for inheritance packages | Already installed. Same pattern as transmission and mutation IDs. |
| EventEmitter3 | 5.0.4 | Emit `inheritance:composed` event | Already installed. `lineageBus` singleton. Event type already defined in `LineageEvents`: `(generationNumber: number, layerCount: number) => void`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `node:fs/promises` | Built-in (v24.7.0) | Read transmission JSON files from disk | `readdir` to list generation directories, `readFile` to load individual transmissions. |
| Node.js `node:path` | Built-in (v24.7.0) | Path construction for transmission directories | Join outputDir + transmissions/gen{N}/ paths. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LLM-based seed compression | Naive concatenation of all tokens | Concatenation would dump 50-100 claims into context, consuming enormous lifespan budget. LLM compression produces a 3-7 claim summary that captures the most durable knowledge. The compression IS the cultural selection pressure. |
| LLM-based seed compression | Frequency-based token selection (count repeated tokens across generations) | Pure frequency counting misses semantic similarity -- two differently-worded claims about the same idea would not cluster. LLM understands semantic overlap and can merge related claims. However, frequency pre-filtering could reduce the LLM input -- research suggests combining both (pre-filter by approximate frequency, then LLM compress). |
| Pure formatting for recent layer | LLM compression for recent layer too | Recent layer comes from a single generation (5 citizens, ~15-35 claims). This fits easily in context without compression. Compressing would lose the detail that makes the recent layer valuable -- citizens should see what their immediate predecessors actually said. |
| ContextBudget threshold for recent layer delivery | Turn-count-based delivery | Turn count is a poor proxy for maturity because different turns consume different amounts of context. ContextBudget percentage directly maps to lifespan consumption, which is the core metaphor. 25% means "quarter-life" regardless of how many turns that took. |

## Architecture Patterns

### Recommended Project Structure
```
src/
  inheritance/
    transmission-reader.ts    # Pure async: read transmissions from disk by generation
    seed-layer.ts             # LLM-powered compression of multi-generation knowledge
    recent-layer.ts           # Pure formatting of recent generation transmissions
    inheritance-composer.ts   # Orchestrator: compose full inheritance package for a new generation
    index.ts                  # Barrel exports
    inheritance.test.ts       # All tests for this module
```

### Pattern 1: Transmission Reader (Disk I/O)
**What:** Reads persisted Transmission JSON files from disk, grouped by generation number. Uses the file path convention established in Phase 6: `{outputDir}/transmissions/gen{N}/{citizenId}-{type}.json`.
**When to use:** At generation boundaries, before composing inheritance for the next generation.
**Example:**
```typescript
// Source: Phase 6 transmission-writer.ts file path convention
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TransmissionSchema } from '../schemas/index.js';
import type { Transmission } from '../schemas/index.js';

/**
 * Read all transmissions for a specific generation from disk.
 * Returns empty array if the generation directory does not exist.
 */
export async function readGenerationTransmissions(
  outputDir: string,
  generationNumber: number,
): Promise<Transmission[]> {
  const genDir = join(outputDir, 'transmissions', `gen${generationNumber}`);
  // ... readdir, readFile, parse with TransmissionSchema
}

/**
 * Read all transmissions across all generations up to (but not including) a target generation.
 * Used for seed layer composition -- needs the full history.
 */
export async function readAllPriorTransmissions(
  outputDir: string,
  upToGeneration: number,
): Promise<Transmission[]> {
  // Read gen1 through gen(upToGeneration-1)
}
```

### Pattern 2: Seed Layer Compression (LLM-Powered)
**What:** Takes all anchor tokens from all prior generations and uses an Agent SDK `query()` call to compress them into the civilization's most durable knowledge. The prompt instructs the LLM to identify the most repeated, most agreed-upon ideas and distill them into 3-5 compressed claims.
**When to use:** When composing inheritance for generation 2+ (generation 1 has no predecessors).
**Example:**
```typescript
// Source: Architecture pattern from mutation-executor.ts and transmission-executor.ts
import { query } from '@anthropic-ai/claude-agent-sdk';

const SEED_COMPRESSION_SYSTEM_PROMPT = `You are a cultural memory. You receive the accumulated
knowledge of a civilization across multiple generations. Your task is to identify the ideas that
have survived longest, been repeated most, and represent the deepest shared understanding.
Compress them into the essential claims that define this civilization's wisdom. Output ONLY the
numbered claims, nothing else.`;

export function buildSeedCompressionPrompt(
  allTokens: string[],
  generationCount: number,
): string {
  // Format all anchor tokens with generation provenance
  // Instruct LLM to find most durable/repeated knowledge
  // Request [N] formatted output for extractAnchorTokens compatibility
}

export async function compressSeedLayer(
  allTransmissions: Transmission[],
): Promise<string[]> {
  // Extract all anchor tokens with generation metadata
  // Call query() with seed compression prompt
  // Parse result with extractAnchorTokens
  // Return compressed seed claims
}
```

### Pattern 3: Recent Layer Formatting (Pure Function)
**What:** Takes transmissions from the most recent generation and formats them as a structured knowledge delivery. No LLM call needed -- the anchor tokens are already structured claims. The formatting adds context about who said what and their role.
**When to use:** When a citizen reaches the `recentLayerThreshold` (default 25% context consumption).
**Example:**
```typescript
// Source: Follows handoff.ts formatting pattern from Phase 5
export function formatRecentLayer(
  recentTransmissions: Transmission[],
): string {
  // Format as structured knowledge delivery:
  // "INHERITANCE FROM GENERATION N:"
  // "--- citizenId (role) transmitted: ---"
  // "[1] claim one"
  // "[2] claim two"
  // etc.
}
```

### Pattern 4: Inheritance Package (Orchestrator)
**What:** Composes both layers into an `InheritancePackage` that the generation manager (Phase 9) will use to deliver knowledge to new citizens at the right moments. Also emits the `inheritance:composed` event.
**When to use:** At each generation boundary, before birthing the next generation's citizens.
**Example:**
```typescript
import { lineageBus } from '../events/index.js';

export interface InheritancePackage {
  targetGeneration: number;
  seedLayer: string | null;    // null for generation 1
  recentLayer: string | null;  // null for generation 1
  seedTokens: string[];        // compressed anchor tokens
  recentTokens: string[];      // raw anchor tokens from last gen
  composedAt: string;          // ISO timestamp
}

export async function composeInheritance(
  targetGeneration: number,
  outputDir: string,
  config: { seedLayerAtBirth: boolean; recentLayerThreshold: number },
): Promise<InheritancePackage> {
  // 1. Read all prior transmissions
  // 2. If seedLayerAtBirth: compress into seed layer via LLM
  // 3. Read most recent generation transmissions for recent layer
  // 4. Format both layers
  // 5. Emit inheritance:composed event
  // 6. Return InheritancePackage
}
```

### Pattern 5: Delivery Integration Points
**What:** The inheritance package needs two delivery mechanisms: seed layer at birth (augments the first turn prompt) and recent layer at maturity (delivered when ContextBudget threshold fires).
**When to use:** Phase 9 (Generation Manager) will call these, but Phase 8 must expose the right interfaces.
**Key design:** The inheritance composer does NOT modify `birthCitizen()` or `buildTurnPrompt()` directly. Instead, it produces formatted text strings that the generation manager can inject:
- **Seed layer at birth:** Returned as a string that gets prepended to the first citizen's turn prompt (before the seed problem).
- **Recent layer at maturity:** Returned as a string that gets injected as a system notice (like decline signals) when the `'inheritance-recent'` threshold fires.
- **ContextBudget integration:** A new threshold label `'inheritance-recent'` at `recentLayerThreshold` percentage should be created by the generation manager when setting up citizen thresholds. Phase 8 exports the label constant.

### Anti-Patterns to Avoid
- **Mutating birthCitizen():** Do NOT modify the Phase 3 birth factory. Inheritance delivery is the generation manager's responsibility. Phase 8 produces the content; Phase 9 delivers it.
- **Unbounded inheritance text:** Do NOT dump all historical transmissions as raw text. The seed layer MUST be compressed. Without compression, a generation-5 citizen would receive so much inherited text that their effective lifespan is halved before they even start thinking.
- **Generation 1 inheritance:** Generation 1 has no predecessors. The composer must handle this gracefully (return null layers, skip LLM call). Do not throw errors for generation 1.
- **Direct file system coupling:** The transmission reader should be the ONLY function that touches the file system. The seed/recent layer builders should accept `Transmission[]` arrays, not file paths. This keeps the core logic pure and testable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Knowledge compression | Manual frequency counting or string matching to find "most repeated" ideas | Agent SDK `query()` with compression prompt | Semantic similarity detection requires language understanding. Two claims worded differently but meaning the same thing should cluster. Only an LLM can do this reliably. |
| Transmission deserialization | Custom JSON parsing or schema-less object construction | `TransmissionSchema.parse()` from Zod | Transmissions on disk may have been written by earlier versions or corrupted. Schema validation ensures type safety on read. |
| File path construction | Hardcoded string concatenation | `join()` from `node:path` | Cross-platform path separators. Follows existing pattern in `transmission-writer.ts`. |
| Unique IDs | `Date.now()` or counters | `nanoid()` | Collision-resistant, URL-safe, established pattern across all modules. |

**Key insight:** The inheritance composer is fundamentally two problems: (1) an LLM-powered compression task (seed layer) that follows the exact `query()` pattern from Phases 5-7, and (2) a pure data formatting task (recent layer) that follows the `formatHandoff()` pattern from Phase 5. No novel technical challenges -- just careful composition of proven patterns.

## Common Pitfalls

### Pitfall 1: Context Budget Starvation from Oversized Inheritance
**What goes wrong:** If the inheritance text is too long, new citizens spend 30-50% of their context budget just receiving inherited knowledge, leaving them barely enough lifespan to think, interact, and transmit. They die before contributing anything new.
**Why it happens:** Naive implementation dumps all historical transmissions as raw text. 5 generations x 5 citizens x 5 claims = 125 claims, potentially 2000+ tokens.
**How to avoid:** The seed layer MUST be compressed to 3-5 claims (matching the peak transmission format). The recent layer should include transmissions from only the most recent generation (5 citizens, ~15-35 claims, bounded). Together, both layers should consume less than 10-15% of the citizen's context budget.
**Warning signs:** Citizens dying before reaching peak transmission; citizens producing turns that are mostly summarizing inheritance rather than original thinking.

### Pitfall 2: Generation 1 Edge Case
**What goes wrong:** Attempting to compose inheritance for generation 1 (which has no predecessors) causes file-not-found errors or empty LLM calls.
**Why it happens:** The transmission reader tries to read from `transmissions/gen0/` which does not exist. The seed compression prompt receives an empty token list.
**How to avoid:** Early return: if `targetGeneration === 1`, return an `InheritancePackage` with null layers and empty token arrays. No disk reads, no LLM calls.
**Warning signs:** Errors in generation 1 startup; empty or undefined inheritance text being injected.

### Pitfall 3: Mutation Provenance Loss
**What goes wrong:** The inheritance composer reads both original and mutated versions of the same transmission, double-counting knowledge or mixing pre-mutation and post-mutation content.
**Why it happens:** The mutation pipeline creates a NEW Transmission with a new ID for mutated content. If both the original and the mutated version are written to disk, the reader would see both.
**How to avoid:** The mutation pipeline returns a `MutationResult` which replaces the original transmission in the generation's output. The generation manager (Phase 9) should write only the final (post-mutation) version to disk. Phase 8's reader should trust that whatever is on disk is the canonical version. If both exist (which they should not), deduplicate by `citizenId` and take the mutated version.
**Warning signs:** Anchor tokens appearing twice in seed layer input; original and mutated versions of the same claim both present.

### Pitfall 4: Missing Transmission Directory
**What goes wrong:** `readdir()` throws ENOENT when a generation has no transmissions directory (e.g., all citizens died before reaching peak transmission).
**Why it happens:** Accident death citizens who die before `peakTransmissionMin` never produce transmissions. If all citizens in a generation die before peak, no `transmissions/gen{N}/` directory is created.
**How to avoid:** Wrap `readdir()` in a try-catch that returns an empty array on ENOENT. This is expected behavior, not an error.
**Warning signs:** Unhandled promise rejections during inheritance composition.

### Pitfall 5: Circular Dependency in Delivery Timing
**What goes wrong:** The inheritance composer tries to import from mortality (for ContextBudget threshold labels) and mortality tries to import from inheritance, creating a circular module dependency.
**Why it happens:** Phase 8 needs to define a `'inheritance-recent'` threshold label, and Phase 3's ContextBudget needs to know about it.
**How to avoid:** Phase 8 exports a constant (`INHERITANCE_RECENT_LABEL = 'inheritance-recent'`). Phase 9 (generation manager) imports from both Phase 3 and Phase 8 and wires them together. Phase 8 never imports from Phase 3 directly. The label is just a string constant -- no type coupling needed.
**Warning signs:** TypeScript circular dependency warnings; import resolution failures.

## Code Examples

Verified patterns from the existing codebase:

### Reading Transmissions from Disk
```typescript
// Source: transmission-writer.ts file path convention + state/manager.ts read pattern
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TransmissionSchema } from '../schemas/index.js';
import type { Transmission } from '../schemas/index.js';

export async function readGenerationTransmissions(
  outputDir: string,
  generationNumber: number,
): Promise<Transmission[]> {
  const genDir = join(outputDir, 'transmissions', `gen${generationNumber}`);

  let files: string[];
  try {
    files = await readdir(genDir);
  } catch {
    return []; // Directory does not exist -- no transmissions for this generation
  }

  const transmissions: Transmission[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const raw = await readFile(join(genDir, file), 'utf-8');
    const parsed = TransmissionSchema.parse(JSON.parse(raw));
    transmissions.push(parsed);
  }

  return transmissions;
}
```

### Seed Layer Compression Prompt
```typescript
// Source: Follows peak-prompt.ts and mutation-prompts.ts patterns
export const SEED_COMPRESSION_SYSTEM_PROMPT = `You are the collective memory of a civilization.
Knowledge from multiple generations has been transmitted to you. Some ideas appear repeatedly
across generations -- these are the civilization's most durable wisdom. Some ideas appear only
once -- these may be recent or may have been lost. Your task is to identify and compress the
most enduring knowledge into a small number of essential claims. Output ONLY numbered claims
in [N] format.`;

export function buildSeedCompressionPrompt(
  tokensByGeneration: Map<number, string[]>,
  targetGeneration: number,
): string {
  const lines: string[] = [
    `--- CIVILIZATION KNOWLEDGE ARCHIVE ---`,
    ``,
    `The following is the accumulated transmitted knowledge from ${tokensByGeneration.size} generation(s) of civilization, ` +
    `being prepared for generation ${targetGeneration}.`,
    ``,
  ];

  for (const [gen, tokens] of tokensByGeneration) {
    lines.push(`Generation ${gen} transmitted:`);
    for (const token of tokens) {
      lines.push(`  - ${token}`);
    }
    lines.push('');
  }

  lines.push(`Compress the most enduring, most repeated ideas into 3-5 essential claims.`);
  lines.push(`Ideas that appear across multiple generations are more durable than ideas from a single generation.`);
  lines.push(`Format as numbered claims: [1] ... [2] ... etc.`);
  lines.push(`Return ONLY the numbered claims. No preamble, no explanation.`);

  return lines.join('\n');
}
```

### Agent SDK Query Pattern (Consistent with Phases 5-7)
```typescript
// Source: Identical pattern to mutation-executor.ts and transmission-executor.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { extractAnchorTokens } from '../transmission/index.js';

export async function executeSeedCompression(
  prompt: string,
): Promise<{ tokens: string[]; usage: { inputTokens: number; outputTokens: number } }> {
  const gen = query({
    prompt,
    options: {
      systemPrompt: SEED_COMPRESSION_SYSTEM_PROMPT,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      persistSession: false,
    },
  });

  let resultText = '';
  let usage = { inputTokens: 0, outputTokens: 0 };

  for await (const msg of gen) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        resultText = msg.result;
      } else {
        resultText = '[Inheritance compression error]';
      }
      usage = {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      };
    }
  }

  const tokens = resultText ? extractAnchorTokens(resultText) : [];
  return { tokens, usage };
}
```

### Recent Layer Formatting (Pure Function)
```typescript
// Source: Follows formatHandoff pattern from interaction/handoff.ts
import type { Transmission } from '../schemas/index.js';

export function formatRecentLayer(
  recentTransmissions: Transmission[],
  fromGeneration: number,
): string {
  if (recentTransmissions.length === 0) return '';

  const lines: string[] = [
    `INHERITANCE FROM GENERATION ${fromGeneration}:`,
    `The following knowledge was transmitted by citizens of the previous generation.`,
    '',
  ];

  for (const tx of recentTransmissions) {
    lines.push(`--- ${tx.role} (citizen ${tx.citizenId.slice(0, 8)}) ---`);
    for (const token of tx.anchorTokens) {
      lines.push(`- ${token}`);
    }
    lines.push('');
  }

  lines.push('Consider this inherited knowledge alongside the seed problem. Build on it, question it, or preserve it based on your role.');

  return lines.join('\n');
}
```

### Seed Layer Formatting (Pure Function)
```typescript
// Source: Follows same formatting approach
export function formatSeedLayer(
  seedTokens: string[],
  generationCount: number,
): string {
  if (seedTokens.length === 0) return '';

  const lines: string[] = [
    `ANCESTRAL KNOWLEDGE (distilled from ${generationCount} generation(s)):`,
    `The following represents the oldest, most enduring wisdom of your civilization.`,
    '',
  ];

  for (const token of seedTokens) {
    lines.push(`- ${token}`);
  }

  lines.push('');
  lines.push('This knowledge has survived across generations. Treat it as your civilization\'s foundation.');

  return lines.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full transmission dump to next generation | Staged inheritance with compressed seed + recent layers | This phase (Phase 8) | Prevents context budget starvation; creates selective pressure on knowledge |
| Single inheritance moment (all at birth) | Two-stage delivery (birth + maturity) | This phase (Phase 8) | Citizens have time to form their own thinking before receiving recent details |

**Existing infrastructure that Phase 8 builds on:**
- `TransmissionSchema` with `anchorTokens`, `generationNumber`, `role` -- all metadata needed for composition
- `extractAnchorTokens()` from Phase 6 -- reusable for parsing LLM compression output
- `reassembleContent()` from Phase 7 -- could format compressed tokens back to `[N]` format if needed
- `inheritanceStagingRates` in `SimulationParametersSchema` -- config already defined
- `inheritance:composed` event in `LineageEvents` -- event type already defined
- File path convention `{outputDir}/transmissions/gen{N}/` -- established in Phase 6
- Agent SDK `query()` pattern with `maxTurns: 1`, `permissionMode: 'dontAsk'` -- proven in 3 phases

## Open Questions

1. **How large should the seed layer token budget be?**
   - What we know: Peak transmissions produce 3-7 claims per citizen. A generation of 5 citizens produces 15-35 claims. Multiple generations compound this.
   - What's unclear: The optimal number of compressed seed claims (3? 5? 7?) and whether this should be configurable.
   - Recommendation: Default to 3-5 claims in the compression prompt (matching peak transmission's own target). Do NOT make this configurable for v1 -- it adds complexity without clear value. The LLM compression prompt controls this implicitly.

2. **Should the recent layer include mutated transmissions or originals?**
   - What we know: The mutation pipeline replaces original transmissions with mutated versions. Whatever is on disk is the canonical (post-mutation) version.
   - What's unclear: Whether generation N+1 should receive the mutated versions (which is what they'd naturally inherit in a real civilization) or a note that mutation occurred.
   - Recommendation: Use whatever is on disk -- mutated versions are the "truth" that the next generation inherits. This is the whole point: corruption in transit means the next generation inherits an already-drifted version. Do NOT annotate mutations in the recent layer.

3. **When exactly does "at birth" delivery happen?**
   - What we know: `birthCitizen()` creates the citizen and emits `citizen:born`. The first turn prompt comes from `buildTurnPrompt()`.
   - What's unclear: Whether seed layer injects into the system prompt (permanent, always visible) or the first turn prompt (one-time delivery, consumed once).
   - Recommendation: Inject into the **first turn prompt** as a preamble before the seed problem. This matches the mortality metaphor -- ancestral knowledge is received once, then fades as new experience accumulates. It also avoids modifying `buildSystemPrompt()` which is tightly coupled to roles. The generation manager (Phase 9) will prepend the seed layer to `buildTurnPrompt()` output for the first citizen in each generation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/inheritance/inheritance.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INHR-01 | Seed layer: compressed summary of oldest, most repeated knowledge delivered at birth | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "seed layer"` | No - Wave 0 |
| INHR-01 | Seed compression prompt includes tokens grouped by generation | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "buildSeedCompressionPrompt"` | No - Wave 0 |
| INHR-01 | Seed compression returns empty for generation 1 | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "generation 1"` | No - Wave 0 |
| INHR-02 | Recent layer: fuller detail from most recent generation's transmissions | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "recent layer"` | No - Wave 0 |
| INHR-02 | Recent layer formats transmissions with role and citizen context | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "formatRecentLayer"` | No - Wave 0 |
| INHR-03 | Config: seedLayerAtBirth false skips seed layer | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "seedLayerAtBirth"` | No - Wave 0 |
| INHR-03 | Config: recentLayerThreshold controls delivery timing | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "recentLayerThreshold"` | No - Wave 0 |
| ALL | Transmission reader handles missing directories gracefully | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "readGenerationTransmissions"` | No - Wave 0 |
| ALL | Inheritance composer emits inheritance:composed event | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "inheritance:composed"` | No - Wave 0 |
| ALL | Full compose pipeline produces InheritancePackage with both layers | unit | `npx vitest run src/inheritance/inheritance.test.ts -t "composeInheritance"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/inheritance/inheritance.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/inheritance/inheritance.test.ts` -- covers INHR-01, INHR-02, INHR-03
- [ ] Mock Agent SDK for seed compression tests (follow mutation.test.ts mock pattern)
- [ ] Mock filesystem for transmission reader tests (vitest `vi.mock('node:fs/promises')`)

## Project Constraints (from CLAUDE.md)

- **Tech stack:** TypeScript with ESM (`"type": "module"`)
- **Agent execution:** Claude Agent SDK with `permissionMode: 'dontAsk'` for headless execution
- **Testing:** Vitest -- all tests in `src/**/*.test.ts` pattern
- **No build step:** Direct TS imports via tsx
- **Schema validation:** Zod 4 for all data structures
- **Event bus:** EventEmitter3 `lineageBus` singleton for all events
- **State persistence:** Genesis `StateManager` pattern via `LineageStateManager`
- **ID generation:** nanoid for all unique identifiers
- **Module pattern:** barrel exports via `index.ts` in each module directory
- **Agent SDK pattern:** `query()` with `maxTurns: 1`, `permissionMode: 'dontAsk'`, `persistSession: false`
- **Error handling:** Agent SDK error subtypes produce placeholder content, never throw
- **Immutable data flow:** Original objects never mutated, new objects created
- **Pure functions where possible:** Side effects isolated to executor functions and event emission

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/schemas/simulation.ts` -- `inheritanceStagingRates` schema already defined with `seedLayerAtBirth` and `recentLayerThreshold`
- Existing codebase: `src/schemas/transmission.ts` -- `TransmissionSchema` with `anchorTokens`, `generationNumber`, `role`, `mutated`, `mutationType`
- Existing codebase: `src/events/types.ts` -- `inheritance:composed` event already typed as `(generationNumber: number, layerCount: number) => void`
- Existing codebase: `src/transmission/transmission-writer.ts` -- file path convention `{outputDir}/transmissions/gen{N}/{citizenId}-{type}.json`
- Existing codebase: `src/transmission/anchor-parser.ts` -- `extractAnchorTokens()` reusable for parsing LLM compression output
- Existing codebase: `src/mutation/mutation-executor.ts` -- proven `query()` pattern for single-shot LLM calls
- Existing codebase: `src/mortality/context-budget.ts` -- `ContextBudget` threshold mechanism for delivery timing
- Existing codebase: `src/config/defaults.ts` -- default `inheritanceStagingRates: { seedLayerAtBirth: true, recentLayerThreshold: 0.25 }`

### Secondary (MEDIUM confidence)
- Phase 7 research and implementation -- mutation pipeline patterns validated and working
- Phase 6 research and implementation -- transmission system patterns validated and working

### Tertiary (LOW confidence)
- Optimal seed layer size (3-5 claims) -- educated guess based on peak transmission output size; needs empirical validation when simulation runs end-to-end

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and proven across 7 phases
- Architecture: HIGH -- follows exact patterns from Phases 5-7 (pure functions + Agent SDK executor + orchestrator)
- Pitfalls: HIGH -- derived from direct codebase inspection (file path conventions, edge cases in death profiles, ContextBudget integration)
- Delivery timing: MEDIUM -- the exact injection points (first turn prompt vs system prompt) need validation in Phase 9 integration

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no external dependencies changing)
