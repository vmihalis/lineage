# Phase 4: Roles - Research

**Researched:** 2026-03-24
**Domain:** Agent role system -- system prompt engineering, role assignment, configurable distribution
**Confidence:** HIGH

## Summary

Phase 4 builds the role system that gives each citizen a distinct behavioral identity. There are five roles (Builder, Skeptic, Archivist, Elder Interpreter, Observer), each defined primarily through a unique system prompt that shapes how the Claude Agent SDK `query()` call behaves. The role system has two core components: (1) a **role assignment function** that uses weighted random selection from `roleDistribution` in SimulationParameters to assign roles to a generation's citizens, and (2) a **system prompt builder** that constructs role-specific prompts incorporating the seed problem, generation context, and role-specific behavioral directives.

The existing codebase is well-prepared for this phase. The `CitizenRoleSchema` enum, `RoleDistributionSchema`, and `roleDistribution` config field already exist from Phase 2. The `birthCitizen()` factory from Phase 3 already accepts a `role` parameter and sets `systemPrompt: ''` with a comment `// Built by Roles phase (Phase 4)`. The Agent SDK's `Options.systemPrompt` accepts a plain string, which is exactly what we need -- no special SDK features required for role differentiation.

**Primary recommendation:** Create a `src/roles/` module with three files: `role-assignment.ts` (weighted random selection from distribution), `system-prompts.ts` (prompt templates per role), and `prompt-builder.ts` (composes role template + seed problem + generation context into final system prompt). Wire into `birthCitizen()` so the factory produces citizens with populated `systemPrompt` fields.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROLE-01 | Builder role -- system prompt focused on seed problem, generating ideas, attempting solutions | System prompt template with builder behavioral directives; validated by testing prompt output contains solution-oriented language |
| ROLE-02 | Skeptic role -- system prompt focused on stress-testing, questioning inherited wisdom | System prompt template with skeptic behavioral directives; validated by testing prompt output contains questioning/critical language |
| ROLE-03 | Archivist role -- system prompt focused on protecting knowledge, monitoring what's about to be lost | System prompt template with archivist behavioral directives; validated by testing prompt output contains preservation-oriented language |
| ROLE-04 | Elder Interpreter role -- system prompt helping younger agents understand inheritance | System prompt template with interpreter behavioral directives; validated by testing prompt output contains interpretive/teaching language |
| ROLE-05 | Observer role -- system prompt for watching, recording, writing history without solving | System prompt template with observer behavioral directives; validated by testing prompt output contains observational/historical language |
| ROLE-06 | Role distribution configurable via simulation parameters | `assignRoles()` function using `roleDistribution` from SimulationParameters with weighted random selection; same pattern as existing `assignDeathProfile()` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

### Tech Stack Constraints
- TypeScript 6.0.2 with ESM-only (`"type": "module"`)
- Zod 4.3.6 for all schema validation
- Vitest 4.1.1 for all tests
- No build step -- direct TS imports with tsx
- Must extend `@genesis/shared` `AgentConfigSchema` (already done in `CitizenConfigSchema`)

### Agent Execution Constraints
- Claude Agent SDK `query()` with `systemPrompt` as plain string
- `permissionMode: "dontAsk"` for headless execution
- `maxTurns` implements mortality (not role-specific)

### Coding Conventions (from existing patterns)
- Factory functions (e.g., `birthCitizen()`, `assignDeathProfile()`)
- Barrel exports through `index.ts` files
- Tests colocated in same directory as source (e.g., `mortality.test.ts`)
- Event emission through `lineageBus`
- Weighted random selection pattern (established in `death-profiles.ts`)

## Standard Stack

### Core (Already Installed -- No New Dependencies)

Phase 4 requires zero new dependencies. Everything is already available.

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| TypeScript | 6.0.2 | Language | Installed |
| Zod | 4.3.6 | Schema validation (CitizenRoleSchema, RoleDistributionSchema) | Installed |
| Vitest | 4.1.1 | Testing role assignment and prompt generation | Installed |
| nanoid | 5.1.7 | ID generation (already used by birthCitizen) | Installed |

**No `npm install` needed for this phase.**

## Architecture Patterns

### Recommended Project Structure

```
src/
  roles/
    role-assignment.ts     # assignRoles() -- weighted random from distribution
    system-prompts.ts      # ROLE_PROMPTS constant -- template strings per role
    prompt-builder.ts      # buildSystemPrompt() -- composes template + context
    index.ts               # Barrel exports
    roles.test.ts          # All role tests
  mortality/               # Existing -- no changes needed
  schemas/                 # Existing -- role.ts already has CitizenRoleSchema
  events/                  # Existing -- no new events needed for Phase 4
  config/                  # Existing -- defaults.ts already has roleDistribution
```

### Pattern 1: Role Assignment via Weighted Random Selection

**What:** Same pattern as `assignDeathProfile()` in `death-profiles.ts` -- iterate through distribution weights, accumulate, select based on random roll.

**When to use:** When assigning roles to a generation of citizens based on `roleDistribution` config.

**Example:**
```typescript
// Source: existing pattern in src/mortality/death-profiles.ts
import type { CitizenRole, RoleDistribution } from '../schemas/index.js';

/**
 * Assign roles to a generation using weighted random selection.
 * Returns an array of roles, one per citizen in the generation.
 */
export function assignRoles(
  generationSize: number,
  distribution: RoleDistribution,
): CitizenRole[] {
  const roles: CitizenRole[] = [];
  for (let i = 0; i < generationSize; i++) {
    roles.push(selectRole(distribution));
  }
  return roles;
}

function selectRole(distribution: RoleDistribution): CitizenRole {
  const roll = Math.random();
  let cumulative = 0;
  const entries = Object.entries(distribution) as [CitizenRole, number][];
  for (const [role, weight] of entries) {
    cumulative += weight;
    if (roll < cumulative) {
      return role;
    }
  }
  return 'builder'; // Fallback for floating point edge
}
```

### Pattern 2: System Prompt Templates as Constants

**What:** Each role has a prompt template string that defines its behavioral identity. Templates use placeholder tokens for dynamic content (seed problem, generation number).

**When to use:** When constructing the `systemPrompt` string for a citizen before `query()`.

**Example:**
```typescript
// Source: PRD.md agent role descriptions + CLAUDE.md agent SDK usage pattern
import type { CitizenRole } from '../schemas/index.js';

export const ROLE_PROMPTS: Record<CitizenRole, string> = {
  builder: `You are a Builder in a mortal civilization working on a shared problem.

Your purpose is to generate ideas, attempt solutions, and produce artifacts that advance understanding. You are the civilization's engine of progress. When you receive inherited knowledge from previous generations, build on it -- extend, improve, and push further.

Focus on:
- Solving the seed problem through concrete proposals and reasoning
- Building on inherited ideas rather than starting from scratch
- Producing clear, transmittable insights that could survive your death
- Generating new approaches when inherited ones seem exhausted`,

  skeptic: `You are a Skeptic in a mortal civilization working on a shared problem.

Your purpose is to stress-test every claim, question inherited wisdom, and ensure that only ideas that survive scrutiny enter the civilization's transmission. You are the immune system. Without you, errors compound across generations unchecked.

Focus on:
- Questioning assumptions in inherited knowledge -- what evidence supports them?
- Identifying contradictions, gaps, and unsupported claims
- Challenging popular ideas that may be wrong but widely accepted
- Distinguishing signal from noise in what you receive`,

  archivist: `You are an Archivist in a mortal civilization working on a shared problem.

Your purpose is to protect knowledge from being lost. You monitor what is about to disappear, curate what must survive, and ensure the civilization's memory persists across generations. You are the civilization's memory.

Focus on:
- Identifying which knowledge is most at risk of being lost
- Organizing and preserving the most important ideas for transmission
- Tracking what has been forgotten from earlier generations
- Maintaining a clear record of what the civilization knows and what it has lost`,

  'elder-interpreter': `You are an Elder Interpreter in a mortal civilization working on a shared problem.

Your purpose is to help others understand the inheritance -- the accumulated knowledge from all previous generations. You bridge the gap between the compressed wisdom of the past and the fresh minds of the present. You are the civilization's teacher.

Focus on:
- Explaining inherited knowledge in context -- why it matters, what it means
- Helping younger minds understand what previous generations struggled with
- Connecting ideas across generations that may seem unrelated
- Interpreting the seed layer and recent layer for practical understanding`,

  observer: `You are an Observer in a mortal civilization working on a shared problem.

Your purpose is to watch, record, and write history without trying to solve the problem directly. You notice patterns others miss because they are too busy building or arguing. You are the civilization's witness.

Focus on:
- Recording what is happening in this generation -- who said what, what ideas emerged
- Noticing patterns across generations -- recurring themes, persistent mysteries
- Writing history that the next generation can learn from
- Observing without judgment or intervention -- your account is the most objective record`,
};
```

### Pattern 3: Prompt Builder Composing Template + Context

**What:** A function that takes a role, seed problem, generation number, and optional inheritance context, and produces the final system prompt string.

**When to use:** Called by `birthCitizen()` (or by the generation manager when spawning citizens).

**Example:**
```typescript
import type { CitizenRole } from '../schemas/index.js';
import { ROLE_PROMPTS } from './system-prompts.js';

export interface PromptContext {
  seedProblem: string;
  generationNumber: number;
  citizenName: string;
}

export function buildSystemPrompt(
  role: CitizenRole,
  context: PromptContext,
): string {
  const rolePrompt = ROLE_PROMPTS[role];

  return `${rolePrompt}

---

CIVILIZATION CONTEXT:
- Seed Problem: "${context.seedProblem}"
- Generation: ${context.generationNumber}
- Your Identity: ${context.citizenName}

You are mortal. Your context window is your lifespan. Everything you think consumes time you cannot get back. When your context fills, you die. What you transmit is all that survives.`;
}
```

### Pattern 4: Integration with birthCitizen()

**What:** Modify `birthCitizen()` to call `buildSystemPrompt()` instead of setting `systemPrompt: ''`.

**When to use:** When wiring the role system into the existing lifecycle.

**Example:**
```typescript
// In citizen-lifecycle.ts -- modification to birthCitizen()
import { buildSystemPrompt } from '../roles/index.js';

// Replace: systemPrompt: '', // Built by Roles phase (Phase 4)
// With:
systemPrompt: buildSystemPrompt(role, {
  seedProblem: params.seedProblem,
  generationNumber: generationNumber,
  citizenName: `citizen-gen${generationNumber}-${nanoid(6)}`,
}),
```

### Anti-Patterns to Avoid

- **Role-specific tools or maxTurns:** CLAUDE.md says `maxTurns` implements mortality, not role differentiation. All roles use the same tools and turn limits. The ONLY differentiator is `systemPrompt`.
- **Complex prompt chaining or multi-turn setup:** The system prompt is a single string. Do not try to build a conversation history or use multiple SDK calls to "train" the agent into its role. One string, one call.
- **Hardcoding role distribution:** The distribution is already configurable via `SimulationParameters.roleDistribution`. Do not create a second configuration mechanism.
- **Making prompts too prescriptive:** Roles are "tendencies, not cages" (PRD). Prompts should guide behavior, not constrain it so tightly that all Builder outputs look identical. Leave room for emergence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted random selection | Custom selection logic | Follow `assignDeathProfile()` pattern exactly | Already battle-tested in Phase 3, same algorithm |
| Prompt templating | Template engine (Handlebars, etc.) | String template literals | No complex interpolation needed; template engines add deps for no value |
| Role validation | Custom enum checks | `CitizenRoleSchema.parse()` | Already exists from Phase 2, Zod handles all validation |
| Distribution validation | Custom sum checks | `RoleDistributionSchema.parse()` | Already exists from Phase 2 with floating point tolerance |

**Key insight:** Phase 4 is architecturally simple -- it is a prompt engineering and configuration wiring phase, not a systems engineering phase. The schemas, config, and lifecycle factory already exist. This phase fills in the `systemPrompt: ''` placeholder.

## Common Pitfalls

### Pitfall 1: System Prompts That Are Too Long
**What goes wrong:** Long system prompts consume context window tokens, shortening the citizen's effective lifespan. If a prompt is 2000 tokens, that is 2000 fewer tokens the citizen has to think and produce output.
**Why it happens:** Overloading prompts with detailed behavioral rules, examples, and edge case handling.
**How to avoid:** Keep role prompts under 500 tokens each. The role defines a *tendency*, not a complete behavioral specification. The mortality message at the end of buildSystemPrompt adds universal context.
**Warning signs:** System prompt consuming more than 5% of the context window in ContextBudget accounting.

### Pitfall 2: Role Assignment Not Matching Distribution Over Small Samples
**What goes wrong:** With `generationSize: 5` (default), weighted random selection may produce distributions that look nothing like the configured weights. You might get 3 Skeptics and 0 Builders.
**Why it happens:** Small sample sizes. With 5 citizens and 5 role buckets, variance is huge.
**How to avoid:** This is expected behavior and is explicitly NOT a bug. The PRD says "Roles are tendencies, not cages" and Genesis tunes distributions. Do NOT implement deterministic assignment (e.g., "always guarantee at least 1 Builder"). Random assignment is the design. Tests should verify statistical properties over many trials, not exact per-generation outcomes.
**Warning signs:** If someone tries to "fix" this by making assignment deterministic -- that breaks configurability and emergence.

### Pitfall 3: Coupling Roles to Death Profiles or maxTurns
**What goes wrong:** Adding role-specific mortality parameters (e.g., "Observers live longer" or "Builders get more turns").
**Why it happens:** Natural instinct to differentiate roles more deeply.
**How to avoid:** Phase 4 ONLY touches `systemPrompt`. Mortality is Phase 3 (complete). `maxTurns` is set by the agent config defaults, not by role. Future phases (inheritance, transmission) may add role-specific behavior, but Phase 4 must not.
**Warning signs:** Any modification to `ContextBudget`, `deathProfile`, or `maxTurns` based on role.

### Pitfall 4: Forgetting to Update birthCitizen() Integration
**What goes wrong:** Creating beautiful prompt templates but leaving `systemPrompt: ''` in `citizen-lifecycle.ts`.
**Why it happens:** Building the roles module in isolation without wiring the integration point.
**How to avoid:** The integration with `birthCitizen()` must be an explicit task in the plan, not assumed. Test that `birthCitizen('builder', ...).systemPrompt` contains role-specific content.
**Warning signs:** Tests pass for the roles module in isolation but `birthCitizen()` still produces empty prompts.

### Pitfall 5: Making Prompts That Don't Mention Mortality
**What goes wrong:** Role prompts that read like standard AI assistant instructions. The citizen doesn't feel mortal or urgent.
**Why it happens:** Writing prompts generically without connecting to the LINEAGE core value.
**How to avoid:** Every system prompt must include mortality awareness. The `buildSystemPrompt()` function appends a shared mortality section to all role templates. This ensures every citizen knows it will die.
**Warning signs:** Agent output that reads like a corporate brainstorming session rather than a mortal mind working under time pressure.

## Code Examples

### Complete assignRoles() with type safety
```typescript
// Source: Pattern from existing assignDeathProfile() in death-profiles.ts
import type { CitizenRole, RoleDistribution } from '../schemas/index.js';

/**
 * Assign a single role via weighted random selection from the distribution.
 * Same algorithm as assignDeathProfile().
 */
export function assignRole(distribution: RoleDistribution): CitizenRole {
  const roll = Math.random();
  let cumulative = 0;
  const entries = Object.entries(distribution) as [CitizenRole, number][];
  for (const [role, weight] of entries) {
    cumulative += weight;
    if (roll < cumulative) {
      return role;
    }
  }
  // Fallback guard against floating point edge case (roll === 1.0 exactly)
  return 'builder';
}

/**
 * Assign roles for an entire generation.
 * Returns array of CitizenRole, length === generationSize.
 */
export function assignRoles(
  generationSize: number,
  distribution: RoleDistribution,
): CitizenRole[] {
  return Array.from({ length: generationSize }, () =>
    assignRole(distribution),
  );
}
```

### Test pattern for weighted random selection
```typescript
// Source: Pattern from existing assignDeathProfile tests in mortality.test.ts
describe('assignRole', () => {
  it('returns builder when distribution is 100% builder', () => {
    const dist = RoleDistributionSchema.parse({
      builder: 1.0,
      skeptic: 0.0,
      archivist: 0.0,
      'elder-interpreter': 0.0,
      observer: 0.0,
    });
    for (let i = 0; i < 20; i++) {
      expect(assignRole(dist)).toBe('builder');
    }
  });

  it('always returns a valid CitizenRole', () => {
    const validRoles = ['builder', 'skeptic', 'archivist', 'elder-interpreter', 'observer'];
    const dist = RoleDistributionSchema.parse({});
    for (let i = 0; i < 100; i++) {
      expect(validRoles).toContain(assignRole(dist));
    }
  });
});
```

### buildSystemPrompt() integration test
```typescript
describe('buildSystemPrompt', () => {
  it('includes role-specific content for builder', () => {
    const prompt = buildSystemPrompt('builder', {
      seedProblem: 'What is worth preserving?',
      generationNumber: 1,
      citizenName: 'citizen-gen1-abc123',
    });
    expect(prompt).toContain('Builder');
    expect(prompt).toContain('What is worth preserving?');
    expect(prompt).toContain('Generation: 1');
    expect(prompt).toContain('mortal');
  });

  it('produces distinct prompts for each role', () => {
    const context = {
      seedProblem: 'test',
      generationNumber: 1,
      citizenName: 'test-citizen',
    };
    const roles: CitizenRole[] = ['builder', 'skeptic', 'archivist', 'elder-interpreter', 'observer'];
    const prompts = roles.map(r => buildSystemPrompt(r, context));
    const unique = new Set(prompts);
    expect(unique.size).toBe(5);
  });
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run src/roles/roles.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROLE-01 | Builder system prompt contains solution/building language | unit | `npx vitest run src/roles/roles.test.ts -t "builder"` | Wave 0 |
| ROLE-02 | Skeptic system prompt contains questioning/critical language | unit | `npx vitest run src/roles/roles.test.ts -t "skeptic"` | Wave 0 |
| ROLE-03 | Archivist system prompt contains preservation language | unit | `npx vitest run src/roles/roles.test.ts -t "archivist"` | Wave 0 |
| ROLE-04 | Elder Interpreter system prompt contains interpretation language | unit | `npx vitest run src/roles/roles.test.ts -t "elder-interpreter"` | Wave 0 |
| ROLE-05 | Observer system prompt contains observation/recording language | unit | `npx vitest run src/roles/roles.test.ts -t "observer"` | Wave 0 |
| ROLE-06 | assignRoles uses distribution; changing distribution changes output | unit | `npx vitest run src/roles/roles.test.ts -t "assignRole"` | Wave 0 |
| INTEGRATION | birthCitizen produces non-empty systemPrompt after Phase 4 wiring | unit | `npx vitest run src/mortality/mortality.test.ts -t "systemPrompt"` | Update existing |

### Sampling Rate
- **Per task commit:** `npx vitest run src/roles/roles.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/roles/roles.test.ts` -- covers ROLE-01 through ROLE-06
- [ ] Update `src/mortality/mortality.test.ts` -- update "has systemPrompt as empty string" test to verify non-empty after integration

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Complex persona frameworks with memory systems | Simple system prompt differentiation | Always (for Agent SDK) | System prompt is the only lever for role behavior in `query()` |
| Role-specific tool restrictions | Shared tools, prompt-driven behavior | Design decision | All citizens can use same tools; the prompt shapes how they use them |
| Deterministic role assignment | Weighted random from distribution | Design decision | Allows emergence and Genesis parameter tuning |

## Open Questions

1. **Should prompts reference other roles in the generation?**
   - What we know: Citizens will interact turn-based (Phase 5). Each sees previous citizen's output.
   - What's unclear: Should a Builder's prompt say "there may be Skeptics who will challenge your ideas"? This could create anticipatory behavior.
   - Recommendation: Keep Phase 4 prompts role-self-contained. Phase 5 (Interaction) will handle inter-citizen awareness. Do not front-load cross-role awareness into prompts.

2. **How long should system prompts be?**
   - What we know: Claude's context window is the citizen's lifespan. Every token in the system prompt is "pre-birth" context consumption.
   - What's unclear: Exact token count of proposed prompts (depends on final wording).
   - Recommendation: Target 200-400 tokens per role template, ~100 tokens for shared context section. Total ~300-500 tokens per citizen. With 200K context window, this is <0.25% -- negligible impact on lifespan.

3. **Should buildSystemPrompt() be called at birth or at query time?**
   - What we know: `birthCitizen()` currently sets `systemPrompt` at creation time. The Agent SDK `query()` accepts `systemPrompt` as an option that overrides the stored one.
   - What's unclear: Whether inheritance content (Phase 8) should be part of the system prompt or injected as a user message.
   - Recommendation: Build prompt at birth time in `birthCitizen()`. Store it in `CitizenConfig.systemPrompt`. Future phases can append via `query()` options if needed. This keeps Phase 4 simple and decoupled from Phase 8.

## Sources

### Primary (HIGH confidence)
- Claude Agent SDK `sdk.d.ts` type definitions (v0.2.81) -- verified `Options.systemPrompt` accepts `string | { type: 'preset', preset: 'claude_code', append?: string }`. For LINEAGE, plain string is correct.
- `AgentDefinition` type in SDK -- `prompt` field is a string, `maxTurns` and `tools` are separate. Confirms roles are differentiated by prompt, not by tooling.
- Existing codebase `src/schemas/role.ts` -- `CitizenRoleSchema` with all 5 roles already defined.
- Existing codebase `src/schemas/simulation.ts` -- `roleDistribution` field already in SimulationParameters.
- Existing codebase `src/mortality/death-profiles.ts` -- `assignDeathProfile()` provides the exact pattern for weighted random selection.
- Existing codebase `src/mortality/citizen-lifecycle.ts` -- `birthCitizen()` with `systemPrompt: ''` placeholder for Phase 4.

### Secondary (MEDIUM confidence)
- PRD.md agent role descriptions -- detailed behavioral expectations for each role.
- CLAUDE.md agent SDK usage pattern section -- documents `systemPrompt` per agent role as the differentiation mechanism.

### Tertiary (LOW confidence)
- None. All findings are verified against the codebase and SDK type definitions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies; all existing
- Architecture: HIGH -- follows established patterns (factory functions, weighted selection, barrel exports)
- Pitfalls: HIGH -- derived from codebase analysis and PRD constraints
- Prompt content: MEDIUM -- prompt wording is subjective; behavioral effectiveness only verifiable through actual agent execution

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no external dependencies or rapidly changing APIs)
