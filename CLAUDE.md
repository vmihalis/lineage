<!-- GSD:project-start source:PROJECT.md -->
## Project

**LINEAGE**

A civilization simulator where every citizen is an AI agent that lives, thinks, produces, ages, and dies — passing transmissions forward to the next generation. Citizens work turn-based within their generation, each building on what the previous citizen produced. Over generations, knowledge drifts, mutates, crystallizes, and occasionally corrupts — producing emergent mythology, wisdom traditions, and cultural character that no single agent designed. LINEAGE runs as a standalone simulation package that will eventually plug into Genesis (a self-modifying agentic engine) as the civilization layer beneath its god layer.

**Core Value:** Mortality changes what a mind produces. The simulation must demonstrate that urgency, loss, and the knowledge of ending create different thinking than comfort and infinite time.

### Constraints

- **Tech stack**: TypeScript — must match Genesis exactly for monorepo compatibility
- **Timeline**: 48-hour hackathon — ship working demo
- **Agent execution**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) with OAuth — no per-token API billing
- **Schema compatibility**: Must extend Genesis schemas, not fork them
- **Event compatibility**: Must compose with Genesis event bus, not replace it
- **Combination target**: Must be movable into Genesis monorepo as `packages/lineage/` with minimal friction
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies (Inherited from Genesis -- DO NOT REINSTALL)
| Technology | Installed Version | Purpose | Why |
|------------|-------------------|---------|-----|
| TypeScript | 6.0.2 | Language | Must match Genesis. Last JS-based release before Go-based TS7. Full ESM support with `verbatimModuleSyntax`. |
| Zod | 4.3.6 | Schema validation | Peer dependency of Claude Agent SDK (`^4.0.0`). Genesis already on Zod 4. Schemas extend `@genesis/shared` types. |
| EventEmitter3 | 5.0.4 | Typed event bus | Genesis event bus singleton. LINEAGE composes `LineageEvents` with `GenesisEvents`, shares the same `bus` instance. |
| nanoid | 5.1.7 | ID generation | Already in Genesis shared for atomic write temp files. Use for citizen IDs, transmission IDs, generation IDs. |
| Vitest | 4.1.1 | Testing | Genesis root config. LINEAGE adds a project entry to the workspace vitest config. Schema matching with `expect.schemaMatching()` is perfect for Zod-validated state. |
| Turbo | 2.8.20 | Monorepo task orchestration | Genesis build system. LINEAGE hooks into `turbo run test`, `turbo run typecheck`. |
| pnpm | 10.28.1 | Package manager | Genesis uses pnpm workspaces. LINEAGE will be a workspace package. |
### Core Technologies (LINEAGE-Specific -- INSTALL THESE)
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| `@anthropic-ai/claude-agent-sdk` | ^0.2.81 | Agent execution | The execution layer for all citizen agent calls. `query()` returns async generator for streaming messages. Supports `systemPrompt`, `maxTurns`, `allowedTools`, `permissionMode`, custom MCP tools via `tool()`. Already in `@genesis/engine` -- LINEAGE declares its own dep for standalone operation. | HIGH |
| `commander` | ^14.0.0 | CLI argument parsing | 35M weekly downloads. v14 has first-class TypeScript generics for options/arguments. Lightweight, minimal API. The seed problem, generation count, and config path need to come from CLI args. | HIGH |
| `chalk` | ^5.4.0 | Terminal string styling | ESM-only since v5, which is perfect since the project is `"type": "module"`. Handles `NO_COLOR` automatically. Rich color support for birth/death/transmission/mutation events. 5.6.2 is latest but `^5.4.0` is safe. | HIGH |
| `ora` | ^9.0.0 | Terminal spinner | For long-running agent `query()` calls (each citizen turn can take 10-30s). Shows which citizen is thinking, auto-clears for log output. 9.3.0 is latest. ESM-only, pairs with chalk. | HIGH |
| `cli-table3` | ^0.6.5 | Terminal tables | For generation summaries: citizen roster, death profiles, transmission counts, metrics. 4500+ dependents. Stable (no API changes needed). Supports colored cell content via chalk. | MEDIUM |
| `log-update` | ^6.0.0 | Streaming line updates | For real-time event stream display. Overwrites previous output for status updates, persists completed events to scrollback. Works alongside ora for multi-line dynamic output. | MEDIUM |
### Development Tools
| Tool | Version | Purpose | Notes | Confidence |
|------|---------|---------|-------|------------|
| `tsx` | ^4.21.0 | TypeScript execution | `npx tsx src/cli.ts` for running without build step. The Claude Agent SDK quickstart recommends `npx tsx`. Node 24 has native type stripping, but tsx handles path aliases and is more reliable for development. | HIGH |
| `@types/node` | ^25.5.0 | Node.js type definitions | Match Genesis. Node 24.7.0 is installed. | HIGH |
### NOT Installing (Build Tooling)
## Installation
# In lineage/ project root (or as workspace package)
# Dev dependencies (inherited from Genesis root, but declare if standalone)
## Alternatives Considered
| Recommended | Alternative | Why Not the Alternative |
|-------------|-------------|------------------------|
| `commander` ^14 | `yargs` | Yargs is more powerful for complex middleware/validation but verbose. LINEAGE CLI is simple: one positional arg (seed problem) and a few flags (--generations, --config). Commander is lighter and has better TS generics in v14. |
| `commander` ^14 | `citty` | Promising (from UnJS ecosystem) but immature. <1% of Commander's adoption. Not worth the risk for a 48-hour hackathon. |
| `chalk` ^5 | `picocolors` | Picocolors is 14x smaller and 2x faster for single-style ops. But LINEAGE needs chained styles (`chalk.bold.red()`), RGB colors for severity levels, and template literals. Picocolors is too minimal. Already a transitive dep in Genesis anyway. |
| `chalk` ^5 | `ansis` | Fastest for multi-style ops and supports truecolor. But chalk's API is more widely known, better documented, and the performance difference is irrelevant for a simulation that waits on LLM calls. |
| `ora` ^9 | Manual `process.stdout.write` | Ora handles stream conflicts (clearing spinner for log output, re-rendering after), cross-platform terminal quirks, and `NO_COLOR`. Reinventing this wastes hackathon time. |
| `cli-table3` ^0.6 | `console.table` | Built-in `console.table` has no styling, no color support, no column width control. Generation summaries need visual hierarchy. |
| `log-update` ^6 | `ink` (React for CLI) | Ink is a full React renderer for terminals. Massive overkill for event streaming. LINEAGE output is linear event logs with occasional summary blocks, not an interactive TUI. |
| No bundler | `tsdown` ^0.20 | tsdown (Rolldown-powered, successor to tsup) is the current best bundler for TS libraries. But Genesis pattern is no-build with direct TS imports. Adding a build step creates friction with the monorepo combination target. |
| `tsx` for dev | Node native `--experimental-strip-types` | Node 24 has stable type stripping, but it ignores `tsconfig.json`, requires explicit `.ts` extensions everywhere, and can't handle decorators or enums. tsx is more reliable and what the Agent SDK docs recommend. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `ts-node` | Slow, requires separate tsconfig for execution, problematic with ESM. tsx is the modern replacement. | `tsx` |
| `chalk` v4.x | CommonJS-only. This project is ESM (`"type": "module"`). v4 is unmaintained. | `chalk` ^5 |
| `inquirer` / `prompts` | Interactive prompts are wrong for a simulation CLI. The simulation runs headlessly after receiving args. No human interaction during execution. | `commander` for args, headless execution |
| `blessed` / `terminal-kit` | Full TUI frameworks. LINEAGE is not an interactive terminal app. It's a headless simulation with streaming log output. | `chalk` + `ora` + `cli-table3` |
| `winston` / `pino` | Structured logging frameworks for production services. LINEAGE is a CLI simulation -- its output IS the product (human-readable event stream). JSON log files would be anti-pattern. | Direct `console.log` with chalk formatting |
| `tsup` | Unmaintained, superseded by tsdown. But neither is needed -- no build step in this architecture. | No bundler (direct TS imports) |
| `jest` | Vitest is already the Genesis standard. Jest has worse ESM support, slower execution, requires more config. | `vitest` |
| Zod v3 | Claude Agent SDK peer-depends on `zod ^4.0.0`. Genesis is on Zod 4.3.6. Using v3 would cause peer dependency conflicts. | `zod` ^4 (already installed) |
## Stack Patterns by Variant
- LINEAGE declares all deps in its own `package.json`
- Imports `@genesis/shared` via path reference: `"@genesis/shared": "file:../genesis/packages/shared"`
- Runs with `npx tsx src/cli.ts "What is worth preserving?"`
- LINEAGE at `packages/lineage/` with `"@genesis/shared": "workspace:*"`
- Dev deps come from Genesis root
- Vitest project entry added to root `vitest.config.ts`
- Turbo handles task orchestration
- Import `@genesis/engine` for AgentRunner patterns
- Expose `SimulationParameters` and `CivilizationMetrics` on the event bus
- No new dependencies needed -- integration is at the schema/event level
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@anthropic-ai/claude-agent-sdk` ^0.2.81 | `zod` ^4.0.0 | Peer dependency. Must use Zod 4, not Zod 3. |
| `@anthropic-ai/claude-agent-sdk` ^0.2.81 | Node.js >=18.0.0 | Engine requirement. We have Node 24.7.0. |
| `chalk` ^5.4.0 | ESM only | Requires `"type": "module"` in package.json (we have this). |
| `ora` ^9.0.0 | ESM only | Same ESM requirement. Pairs with chalk for colored spinners. |
| `log-update` ^6.0.0 | ESM only | Same ESM requirement. |
| `commander` ^14.0.0 | Node.js >=20 | We have Node 24.7.0. Good. |
| `vitest` ^4.1.1 | `vite` ^8.0.0 | Vitest 4 ships with Vite 8 integration. Already in Genesis. |
| `typescript` ^6.0.0 | `"module": "nodenext"` | Last JS-based TypeScript. moduleResolution must be nodenext for ESM. |
## Agent SDK Usage Pattern
- **`systemPrompt`**: Different prompt per agent role (Builder, Skeptic, Archivist, Elder Interpreter, Observer)
- **`maxTurns`**: Implements mortality -- agents with fewer turns die younger
- **`permissionMode: "dontAsk"`**: Headless execution, denies anything not in allowedTools
- **Async generator streaming**: Track context consumption in real-time for death profile triggers
- **`tool()` + `createSdkMcpServer()`**: Custom MCP tools for citizens to access inheritance archive, write transmissions
- **`agents` option**: Define citizen roles as subagents for cleaner orchestration
## Sources
- Claude Agent SDK npm package (v0.2.81) -- verified from installed `node_modules` in Genesis [HIGH]
- Claude Agent SDK TypeScript Reference -- https://platform.claude.com/docs/en/agent-sdk/typescript [HIGH]
- Claude Agent SDK Quickstart -- https://platform.claude.com/docs/en/agent-sdk/quickstart [HIGH]
- Genesis monorepo `package.json` files -- direct inspection of `/Users/memehalis/genesis/` [HIGH]
- Commander.js v14 -- https://github.com/tj/commander.js (35M weekly downloads, latest 14.0.3) [HIGH]
- Chalk v5 -- https://github.com/chalk/chalk (ESM-only, v5.6.2 latest) [HIGH]
- Ora v9 -- https://github.com/sindresorhus/ora (28M weekly downloads, v9.3.0 latest) [HIGH]
- Vitest 4.1 blog -- https://vitest.dev/blog/vitest-4-1 (v4.1.1 latest) [HIGH]
- cli-table3 -- https://github.com/cli-table/cli-table3 (v0.6.5, stable) [MEDIUM]
- log-update -- https://github.com/sindresorhus/log-update (v6, ESM) [MEDIUM]
- tsx -- https://tsx.is/ (v4.21.0 latest) [HIGH]
- Node.js native TypeScript -- https://nodejs.org/en/learn/typescript/run-natively (stable in Node 24) [HIGH]
- TypeScript 6.0 -- https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ [HIGH]
- picocolors vs chalk comparison -- https://dev.to/webdiscus/comparison-of-nodejs-libraries-to-colorize-text-in-terminal-4j3a [MEDIUM]
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
