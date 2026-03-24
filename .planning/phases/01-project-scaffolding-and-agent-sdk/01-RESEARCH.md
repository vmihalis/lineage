# Phase 1: Project Scaffolding and Agent SDK - Research

**Researched:** 2026-03-24
**Domain:** TypeScript project scaffolding, Claude Agent SDK integration, Genesis monorepo compatibility
**Confidence:** HIGH

## Summary

Phase 1 bootstraps LINEAGE as a standalone TypeScript package that can later merge into the Genesis monorepo. The work divides into three concerns: (1) project structure matching Genesis conventions exactly (package.json, tsconfig, ESM, pnpm), (2) installing and configuring the Claude Agent SDK with working authentication, and (3) proving a single `query()` call produces output with a custom system prompt.

The Genesis monorepo (`/Users/memehalis/genesis/`) has been inspected directly. Its patterns are well-defined: ESM-only (`"type": "module"`), TypeScript 6 with `moduleResolution: "nodenext"`, Zod 4 schemas, EventEmitter3 bus singleton, atomic-write state management, and Vitest 4 for testing. LINEAGE must mirror these patterns exactly while declaring its own dependencies for standalone operation.

The Agent SDK (v0.2.81) is installed in Genesis and its API has been verified from the actual `sdk.d.ts` type definitions. Authentication uses `ANTHROPIC_API_KEY` (primary) or the Claude CLI's built-in OAuth flow. The SDK spawns a Claude Code subprocess -- it is not a thin HTTP wrapper. The `query()` function returns an `AsyncGenerator<SDKMessage>` that yields typed messages including `SDKAssistantMessage`, `SDKResultMessage`, and various status events.

**Primary recommendation:** Scaffold the project to match Genesis `packages/shared` and `packages/engine` conventions exactly, install Agent SDK + dev dependencies, create a minimal `src/index.ts` that proves `query()` works with a system prompt, and verify `@genesis/shared` imports resolve via the `file:` protocol.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Project scaffolded as TypeScript package with proper tsconfig extending Genesis patterns | Genesis root `tsconfig.json` inspected; `moduleResolution: "nodenext"`, `module: "nodenext"`, `verbatimModuleSyntax: true`, `noEmit: true`. Package-level tsconfigs extend root via `"extends": "../../tsconfig.json"`. LINEAGE standalone uses identical compilerOptions. |
| FOUND-02 | Claude Agent SDK installed and configured with working authentication | SDK v0.2.81 verified in Genesis `node_modules`. Auth via `ANTHROPIC_API_KEY` env var (primary) or Claude CLI OAuth. SDK spawns Claude Code subprocess. `query()` API fully documented from `sdk.d.ts`. |
| FOUND-03 | Single agent can be spawned via Agent SDK `query()` and produce output | `query({ prompt, options })` returns `AsyncGenerator<SDKMessage>`. Filter for `message.type === 'assistant'` to get text output. `options.systemPrompt` accepts a string. `options.permissionMode: 'dontAsk'` for headless. `options.maxTurns` controls turn count. |
</phase_requirements>

## Standard Stack

### Core (Phase 1 Only -- Subset of Full Stack)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | Language | Genesis root has `"typescript": "^6.0.0"`. Verified `tsc` available via Genesis. |
| `@anthropic-ai/claude-agent-sdk` | 0.2.81 | Agent execution | Verified from Genesis `node_modules`. Peer-depends on `zod ^4.0.0`. ESM (`"type": "module"`). |
| `zod` | 4.3.6 | Schema validation | Genesis `@genesis/shared` depends on `"zod": "^4.0.0"`. Agent SDK peer dependency. |
| `eventemitter3` | 5.0.4 | Typed event bus | Genesis shared: `"eventemitter3": "^5.0.0"`. Singleton pattern. |
| `nanoid` | 5.1.7 | ID generation | Genesis shared: `"nanoid": "^5.0.0"`. Used in atomic writes, IDs. |

### Development Tools (Install in Phase 1)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `tsx` | 4.21.0 | TypeScript execution without build | `npx tsx src/index.ts` to run. Agent SDK quickstart recommends tsx. |
| `@types/node` | 25.5.0+ | Node.js type definitions | Match Genesis root `"@types/node": "^25.5.0"`. Node 24.7.0 is installed. |
| `vitest` | 4.1.1 | Testing framework | Genesis root `"vitest": "^4.0.0"`. Test patterns verified from existing Genesis tests. |

### NOT Installing in Phase 1
| Library | Reason | Phase |
|---------|--------|-------|
| `commander` | CLI parsing not needed until Phase 2 (CONF-03, CONF-04) |
| `chalk` | Terminal coloring not needed until Phase 10 (EVNT-02) |
| `ora` | Spinners not needed until Phase 10 (EVNT-02) |
| `cli-table3` | Tables not needed until Phase 10 (EVNT-03) |
| `log-update` | Streaming display not needed until Phase 10 (EVNT-02) |

**Installation:**
```bash
# Initialize package
pnpm init

# Production dependencies
pnpm add @anthropic-ai/claude-agent-sdk@^0.2.81 zod@^4.0.0 eventemitter3@^5.0.0 nanoid@^5.0.0

# Development dependencies
pnpm add -D typescript@^6.0.0 tsx@^4.21.0 @types/node@^25.5.0 vitest@^4.0.0

# Genesis shared reference (standalone mode)
# Add to package.json manually:
#   "@genesis/shared": "file:../genesis/packages/shared"
```

**Version verification:** All versions confirmed via `npm view` on 2026-03-24:
- `@anthropic-ai/claude-agent-sdk`: 0.2.81
- `commander`: 14.0.3 (deferred)
- `tsx`: 4.21.0
- `chalk`: 5.6.2 (deferred)
- `ora`: 9.3.0 (deferred)

## Architecture Patterns

### Recommended Project Structure
```
lineage/
├── src/
│   └── index.ts           # Entry point -- proves Agent SDK works
├── package.json           # ESM, standalone deps, @genesis/shared via file:
├── tsconfig.json          # Extends Genesis patterns (or self-contained equivalent)
├── vitest.config.ts       # Project-level Vitest config (or rely on inline)
├── .gitignore
├── CLAUDE.md              # Already exists
└── .planning/             # Already exists
```

### Pattern 1: Package.json Configuration (Matching Genesis)
**What:** ESM-only TypeScript package with exports map pointing to source `.ts` files (no build step).
**When to use:** Always -- this is the Genesis convention.
**Example:**
```typescript
// Source: Direct inspection of /Users/memehalis/genesis/packages/shared/package.json
{
  "name": "lineage",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.81",
    "@genesis/shared": "file:../genesis/packages/shared",
    "zod": "^4.0.0",
    "eventemitter3": "^5.0.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "tsx": "^4.21.0",
    "typescript": "^6.0.0",
    "vitest": "^4.0.0"
  }
}
```

### Pattern 2: tsconfig.json (Matching Genesis Root)
**What:** TypeScript 6 with ESM module resolution, no emit, verbatim module syntax.
**When to use:** Always -- Genesis root tsconfig is the template.
**Example:**
```jsonc
// Source: Direct inspection of /Users/memehalis/genesis/tsconfig.json
{
  "compilerOptions": {
    "types": ["node"],
    "moduleResolution": "nodenext",
    "module": "nodenext",
    "target": "es2022",
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Pattern 3: Agent SDK query() Usage
**What:** The core pattern for spawning a Claude agent and streaming responses.
**When to use:** Every time a citizen agent needs to produce output.
**Example:**
```typescript
// Source: Agent SDK v0.2.81 sdk.d.ts + Genesis agent-runner.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKAssistantMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

async function runAgent(prompt: string, systemPrompt: string): Promise<string> {
  const textParts: string[] = [];

  const agentQuery = query({
    prompt,
    options: {
      systemPrompt,
      maxTurns: 1,                    // Single turn for Phase 1 proof
      permissionMode: 'dontAsk',      // Headless -- deny anything not in allowedTools
      tools: [],                       // No tools needed for simple text generation
      persistSession: false,           // Ephemeral -- no session files
    },
  });

  for await (const message of agentQuery) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if ('text' in block && typeof block.text === 'string') {
          textParts.push(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        // message.result contains the final text
        // message.usage has token counts (critical for Phase 3 mortality)
      }
    }
  }

  return textParts.join('\n');
}
```

### Pattern 4: Genesis Shared Imports (Standalone Mode)
**What:** Import types and utilities from `@genesis/shared` using the `file:` protocol reference.
**When to use:** Whenever LINEAGE needs Genesis types (AgentConfig, event bus, StateManager).
**Example:**
```typescript
// Source: Genesis packages/shared/src/index.ts barrel exports
import { bus } from '@genesis/shared';
import type { GenesisEvents } from '@genesis/shared';
import { AgentConfigSchema, type AgentConfig } from '@genesis/shared';
import { StateManager, atomicWrite } from '@genesis/shared';

// Subpath imports also available:
import { AgentConfigSchema } from '@genesis/shared/schemas';
import { bus } from '@genesis/shared/events';
import { StateManager } from '@genesis/shared/state';
```

### Pattern 5: Vitest Test Pattern (Matching Genesis)
**What:** Test file co-located with source, using vitest with vi.fn() mocks.
**When to use:** All tests.
**Example:**
```typescript
// Source: Genesis packages/shared/src/events/bus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Agent SDK Integration', () => {
  it('produces output with a system prompt', async () => {
    // Test implementation
  });
});
```

### Anti-Patterns to Avoid
- **CommonJS imports:** Never use `require()`. This is an ESM-only project (`"type": "module"`). Use `import`/`export` exclusively.
- **Missing `.js` extensions:** With `moduleResolution: "nodenext"`, relative imports MUST include the `.js` extension even for `.ts` files: `import { foo } from './bar.js'` (NOT `./bar` or `./bar.ts`).
- **`ts-node` or `node --loader`:** Use `tsx` exclusively. ts-node has ESM issues. Node native type stripping ignores tsconfig.
- **Build step:** Genesis pattern is no-build, direct TS imports via tsx. Do NOT add tsdown, tsup, or any bundler.
- **Zod v3:** Agent SDK peer-depends on `zod ^4.0.0`. Genesis is on Zod 4.3.6. Do NOT use Zod 3.
- **`@anthropic-ai/sdk` direct import for Agent SDK path:** The Agent SDK wraps Claude Code, not the raw API. Use `query()` from the agent SDK, not `Anthropic.messages.create()`. The direct SDK is only for the fallback path (which LINEAGE does not need in Phase 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent execution loop | Custom fetch-based API client with tool loop | `query()` from Agent SDK | SDK handles tool execution, retries, context management, auth, streaming. Genesis `AgentRunner.executeViaAgentSDK()` is 60 lines wrapping `query()`. |
| Authentication | Token management, OAuth flow, refresh logic | Agent SDK + Claude CLI built-in auth | SDK spawns Claude Code subprocess which handles all auth. Just set `ANTHROPIC_API_KEY` or let Claude CLI handle it. |
| Atomic file writes | Manual temp-file-then-rename | `atomicWrite()` from `@genesis/shared/state` | Genesis already has this with nanoid temp paths, error cleanup, and event emission. |
| Type-safe event bus | Custom EventEmitter subclass | `bus` singleton from `@genesis/shared/events` | Genesis singleton typed with `GenesisEvents` interface. LINEAGE extends it. |
| Project config boilerplate | Custom tsconfig, ESM setup | Copy Genesis patterns exactly | The patterns are proven and tested. Deviation causes resolution errors. |

**Key insight:** Phase 1 produces almost no custom code. Its primary output is configuration files (package.json, tsconfig.json) that exactly match Genesis conventions, plus a thin `src/index.ts` that proves the SDK works. Getting the configuration right IS the work.

## Common Pitfalls

### Pitfall 1: Missing .js Extension in Relative Imports
**What goes wrong:** TypeScript compiles but tsx crashes at runtime with `ERR_MODULE_NOT_FOUND`.
**Why it happens:** `moduleResolution: "nodenext"` requires explicit `.js` extensions on relative imports. TypeScript resolves `./foo.js` to `./foo.ts` at compile time, but the extension must be `.js` in the source.
**How to avoid:** Always write `import { x } from './module.js'` even when the file is `module.ts`. Configure ESLint or rely on `tsc --noEmit` to catch missing extensions.
**Warning signs:** Any relative import without a `.js` extension.

### Pitfall 2: Agent SDK Auth Failure
**What goes wrong:** `query()` throws "API key not found" or "authentication_failed" error.
**Why it happens:** The Agent SDK spawns a Claude Code subprocess. If neither `ANTHROPIC_API_KEY` is set nor the Claude CLI has an active OAuth session, auth fails.
**How to avoid:** Verify auth BEFORE writing complex code. Run `claude --version` to confirm CLI is installed (verified: 2.1.81). Set `ANTHROPIC_API_KEY` in `.env` or shell environment. The SDK also checks `~/.claude/` for OAuth tokens from `claude login`.
**Warning signs:** The `SDKAuthStatusMessage` (type `auth_status`) with `error` field set. Also `SDKAssistantMessage.error === 'authentication_failed'`.

### Pitfall 3: @genesis/shared Resolution with file: Protocol
**What goes wrong:** `pnpm install` fails or imports resolve to wrong location.
**Why it happens:** The `file:` protocol in package.json creates a symlink. If the relative path is wrong or Genesis hasn't had `pnpm install` run, the shared package's own dependencies (zod, eventemitter3, nanoid) may not be installed.
**How to avoid:** Ensure Genesis has been installed (`cd /Users/memehalis/genesis && pnpm install`). Use exact relative path: `"@genesis/shared": "file:../genesis/packages/shared"`. Verify with `ls -la node_modules/@genesis/shared` after install.
**Warning signs:** "Cannot find module '@genesis/shared'" at runtime. Missing `node_modules` in Genesis.

### Pitfall 4: Agent SDK Spawns a Subprocess (Not an HTTP Call)
**What goes wrong:** Expecting lightweight API calls but getting a full Claude Code process spawn per `query()`.
**Why it happens:** The Agent SDK is a wrapper around Claude Code CLI. Each `query()` starts a new Claude Code process.
**How to avoid:** Be aware that `query()` has startup overhead (1-3 seconds). Plan for this in later phases when multiple citizens need to be spawned. For Phase 1, one call is fine.
**Warning signs:** Slow first response, unexpected process spawning, stderr output from Claude Code process.

### Pitfall 5: Vitest Config Mismatch
**What goes wrong:** Tests don't run or pick up wrong config.
**Why it happens:** Genesis uses a workspace vitest config at the root with project entries. LINEAGE standalone needs its own vitest config, but must match the conventions.
**How to avoid:** Create a `vitest.config.ts` at LINEAGE root matching the Genesis project entry pattern: `test.include: ['src/**/*.test.ts']`. Use `vitest run` (not `vitest`) for CI.
**Warning signs:** `vitest` runs 0 tests, or picks up Genesis tests instead.

### Pitfall 6: verbatimModuleSyntax Requires Type-Only Imports
**What goes wrong:** TypeScript error: "This import is never used as a value and must use 'import type'".
**Why it happens:** `verbatimModuleSyntax: true` in tsconfig requires that type-only imports use `import type { X }` syntax. Regular `import { X }` is only for values.
**How to avoid:** Always use `import type { X }` for types and interfaces. Use `import { Schema, type InferredType }` for mixed imports.
**Warning signs:** TypeScript compilation errors about unused imports.

## Code Examples

### Minimal Agent SDK Proof of Concept (Phase 1 Target)
```typescript
// Source: Agent SDK quickstart + Genesis agent-runner.ts pattern
// File: src/index.ts

import { query } from '@anthropic-ai/claude-agent-sdk';

const systemPrompt = `You are a citizen of a civilization.
You have been given a problem to think about.
Respond with your thoughts on the matter.`;

const seedProblem = 'What is worth preserving across generations?';

console.log('LINEAGE - Starting agent...');
console.log(`Seed problem: ${seedProblem}`);
console.log('---');

const agentQuery = query({
  prompt: seedProblem,
  options: {
    systemPrompt,
    maxTurns: 1,
    permissionMode: 'dontAsk',
    tools: [],
    persistSession: false,
  },
});

for await (const message of agentQuery) {
  if (message.type === 'assistant' && message.message?.content) {
    for (const block of message.message.content) {
      if ('text' in block && typeof block.text === 'string') {
        console.log(block.text);
      }
    }
  } else if (message.type === 'result') {
    console.log('---');
    console.log(`Completed: ${message.subtype}`);
    if ('usage' in message) {
      console.log(`Tokens: input=${message.usage.input_tokens}, output=${message.usage.output_tokens}`);
    }
  }
}
```

### Genesis Shared Import Verification
```typescript
// File: src/verify-genesis.ts
// Proves @genesis/shared resolves correctly

import { bus } from '@genesis/shared';
import type { GenesisEvents } from '@genesis/shared';
import { AgentConfigSchema } from '@genesis/shared';

// Verify bus is an EventEmitter
console.log('Bus listeners:', bus.eventNames());

// Verify Zod schema works
const config = AgentConfigSchema.parse({
  id: 'test-citizen',
  name: 'Test Citizen',
  type: 'lineage-citizen',
  systemPrompt: 'You are a test citizen.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
console.log('Parsed config:', config.id, config.name);
```

### Test Pattern for Agent SDK (Mocked)
```typescript
// Source: Genesis agent-runner.test.ts pattern adapted
// File: src/index.test.ts

import { describe, it, expect, vi } from 'vitest';

// Mock the Agent SDK for unit tests -- actual SDK calls are integration tests
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(() => {
    // Return an async generator that yields a mock assistant message + result
    return (async function* () {
      yield {
        type: 'assistant' as const,
        message: {
          content: [{ type: 'text', text: 'Test response from mocked agent' }],
        },
        parent_tool_use_id: null,
        uuid: 'test-uuid',
        session_id: 'test-session',
      };
      yield {
        type: 'result' as const,
        subtype: 'success',
        result: 'Test response from mocked agent',
        is_error: false,
        num_turns: 1,
        duration_ms: 100,
        duration_api_ms: 50,
        total_cost_usd: 0.001,
        usage: { input_tokens: 10, output_tokens: 20 },
        modelUsage: {},
        permission_denials: [],
        stop_reason: 'end_turn',
        uuid: 'test-uuid',
        session_id: 'test-session',
      };
    })();
  }),
}));

describe('LINEAGE Agent', () => {
  it('should produce output from a query call', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const messages: unknown[] = [];

    for await (const msg of query({ prompt: 'test', options: {} })) {
      messages.push(msg);
    }

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ type: 'assistant' });
    expect(messages[1]).toMatchObject({ type: 'result', subtype: 'success' });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ts-node` for dev | `tsx` for dev execution | 2024+ | tsx is ESM-native, faster, no config needed |
| Zod v3 | Zod v4 | 2025 | Breaking change in API. Agent SDK requires `^4.0.0`. |
| `@anthropic-ai/sdk` + manual tool loop | Agent SDK `query()` with auto tool loop | 2025 | SDK handles entire agentic loop. `query()` replaces ~100 lines of manual tool dispatch. |
| TypeScript 5.x | TypeScript 6.0 | 2025 | `verbatimModuleSyntax` is now the default. Last JS-based TS release before Go-based TS7. |
| Vitest 2.x | Vitest 4.1.1 | 2025 | Ships with Vite 8 integration. `expect.schemaMatching()` for Zod validation. |
| `CLAUDE_CODE_OAUTH_TOKEN` | `ANTHROPIC_API_KEY` (primary) | 2025-2026 | Official docs now recommend API key as primary auth. OAuth still works via Claude CLI but is not the recommended path for third-party SDK usage. |

**Deprecated/outdated:**
- `ts-node`: Replaced by `tsx`. Slow, bad ESM support.
- `tsup`: Unmaintained, replaced by `tsdown`. But LINEAGE uses no bundler (Genesis pattern).
- Zod v3: Incompatible with Agent SDK peer dependency.
- Agent SDK `maxThinkingTokens` option: Deprecated in favor of `thinking: { type: 'adaptive' }`.

## Open Questions

1. **Authentication method for headless execution**
   - What we know: Agent SDK supports `ANTHROPIC_API_KEY` (recommended) and Claude CLI OAuth. Claude CLI v2.1.81 is installed. No `ANTHROPIC_API_KEY` was found in the current environment.
   - What's unclear: Whether the current Claude CLI session has a valid OAuth token that the Agent SDK subprocess will inherit, or whether an API key must be explicitly set.
   - Recommendation: Test both paths in Phase 1. Try running without `ANTHROPIC_API_KEY` first (relies on Claude CLI auth). If that fails, set `ANTHROPIC_API_KEY` in a `.env` file. Document the working auth method.

2. **@genesis/shared file: protocol with pnpm**
   - What we know: Genesis uses `"workspace:*"` for internal packages. LINEAGE standalone should use `"file:../genesis/packages/shared"`. Genesis has been installed (`pnpm-lock.yaml` exists).
   - What's unclear: Whether pnpm handles `file:` references correctly when the target package itself has workspace dependencies (zod, eventemitter3, nanoid).
   - Recommendation: Test the `file:` reference immediately after creating package.json. If it fails, fall back to copying the shared package types locally or using TypeScript path aliases.

3. **Agent SDK subprocess overhead**
   - What we know: `query()` spawns a Claude Code subprocess. There is startup overhead.
   - What's unclear: Exact startup time. Whether multiple sequential `query()` calls can reuse a session.
   - Recommendation: Not blocking for Phase 1 (single call). Document observed startup time for Phase 3+ planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 24.7.0 | -- |
| pnpm | Package management | Yes | 10.28.1 | -- |
| TypeScript | Type checking | Yes | 6.0.2 (via Genesis) | Install locally |
| tsx | TS execution | Yes | 4.21.0 | -- |
| Claude CLI | Agent SDK auth | Yes | 2.1.81 | ANTHROPIC_API_KEY env var |
| Genesis monorepo | @genesis/shared imports | Yes | At /Users/memehalis/genesis/ | Copy types locally |
| Vitest | Testing | Yes | 4.1.1 (via Genesis) | Install locally |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None -- all dependencies are available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (to be created in Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | TypeScript package compiles without errors | typecheck | `npx tsc --noEmit` | N/A (tsc, not test file) |
| FOUND-02 | Agent SDK installed, auth configured, query callable | integration | `npx vitest run src/index.test.ts -t "auth"` | Wave 0 |
| FOUND-03 | Single agent produces output via query() | unit (mocked) + integration | `npx vitest run src/index.test.ts -t "output"` | Wave 0 |
| SUCCESS-1 | `tsx src/index.ts` starts without errors | smoke | `npx tsx src/index.ts` (manual verification) | N/A |
| SUCCESS-2 | query() returns coherent response with system prompt | integration | Manual run + result inspection | N/A |
| SUCCESS-3 | OAuth/API key auth succeeds | integration | `npx tsx src/index.ts` (auth verified by successful response) | N/A |
| SUCCESS-4 | @genesis/shared imports resolve | typecheck + unit | `npx tsc --noEmit && npx vitest run src/verify-genesis.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green + successful manual `tsx src/index.ts` execution before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest project configuration (matching Genesis pattern)
- [ ] `src/index.test.ts` -- Agent SDK mock tests covering FOUND-02, FOUND-03
- [ ] `src/verify-genesis.test.ts` -- @genesis/shared import resolution test

## Sources

### Primary (HIGH confidence)
- Genesis monorepo direct inspection (`/Users/memehalis/genesis/`) -- package.json, tsconfig.json, vitest.config.ts, turbo.json, all package configs
- Genesis `@genesis/shared` source code -- schemas/agent.ts, events/bus.ts, events/types.ts, state/manager.ts, index.ts
- Genesis `@genesis/engine` source code -- runtime/agent-runner.ts, runtime/claude-client.ts, runtime/tool-registry.ts
- Agent SDK `sdk.d.ts` type definitions (v0.2.81) -- full API surface verified from installed package
- Agent SDK quickstart docs -- https://platform.claude.com/docs/en/agent-sdk/quickstart
- Agent SDK TypeScript reference -- https://platform.claude.com/docs/en/agent-sdk/typescript
- npm registry version checks -- all package versions verified 2026-03-24

### Secondary (MEDIUM confidence)
- Claude CLI version and auth state -- verified `claude --version` returns 2.1.81, but OAuth token state not directly inspectable

### Tertiary (LOW confidence)
- None -- all findings are from primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified from installed packages and npm registry
- Architecture: HIGH -- Genesis patterns inspected directly from source code, not documentation
- Pitfalls: HIGH -- derived from actual Genesis codebase patterns and Agent SDK type definitions

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- Agent SDK and Genesis patterns unlikely to change in 30 days)
