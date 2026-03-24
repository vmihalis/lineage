# Domain Pitfalls

**Domain:** AI agent civilization simulator with multi-generational knowledge transmission
**Researched:** 2026-03-24

---

## Critical Pitfalls

Mistakes that cause rewrites, blown timelines, or fundamental simulation failure.

---

### Pitfall 1: The Broken Telephone Effect — Iterative LLM Generation Destroys Information

**What goes wrong:** When LLM output feeds into the next LLM as input across generations, information degrades rapidly and predictably. An ACL 2025 paper ("LLM as a Broken Telephone") demonstrated that distortion accumulates with each generation cycle, and higher temperature increases degradation exponentially. After 5-10 iterations, the original signal can be unrecognizable — not through your mutation pipeline, but through the LLM's own summarization tendencies. The LLM will flatten nuance, genericize specific claims, and converge on safe platitudes. Your carefully designed transmission system produces "wisdom" that reads like fortune cookies by Generation 5.

**Why it happens:** LLMs have inherent biases when reprocessing their own output: they smooth rough edges, prefer common phrasings, drop unusual specifics, and trend toward the mean of their training distribution. Each generation compounds this. This is not your mutation system — it is an additional, invisible, uncontrolled mutation layer operating on top of your designed mutations.

**Consequences:**
- Civilizations converge to the same bland outputs regardless of seed problem
- No meaningful knowledge drift or crystallization — just entropy toward generic text
- The "emergent mythology" promised in the PRD never emerges; it gets LLM-smoothed away
- Mutation pipeline effects become invisible against the larger background noise of LLM drift

**Prevention:**
- Use temperature 0 or near-0 for transmission writing (research shows temperature is the primary driver of iterative distortion)
- Design transmission prompts that demand specific, structured output (numbered claims, concrete examples, proper nouns) rather than prose summaries
- Include "anchor tokens" — specific formatted markers that resist paraphrasing (e.g., `[AXIOM-001]`, `[GEN-3-PEAK]`)
- Test the telephone game in isolation: run 10 generations of pure transmission with zero designed mutation and measure drift. If significant drift exists without your mutation pipeline, your mutation calibration work is meaningless
- Separate LLM-native drift from designed mutation by measuring both independently

**Detection:**
- Semantic similarity between Gen 1 transmissions and Gen N transmissions drops below 0.3 within 3-4 generations even with mutation rate at 0
- All civilizations produce similar-sounding transmissions regardless of seed problem
- Transmission word counts shrink generation over generation (LLMs summarize aggressively)

**Phase relevance:** Must be addressed in the transmission system design (early phase). This is the single highest risk to the project's core thesis.

**Confidence:** HIGH — Supported by ACL 2025 peer-reviewed research and reproducible experiments.

---

### Pitfall 2: Context-as-Lifespan Accounting Is Harder Than It Looks

**What goes wrong:** LINEAGE's core mechanic ties context window fill to agent aging. But tracking "how full is this agent's context?" with precision is non-trivial. The Claude Agent SDK reports token usage per-step, but tool calls, system prompts, cached tokens, and the SDK's own overhead all consume context in ways that are not straightforward to predict or track in real-time. You build the mortality engine assuming you can precisely say "this agent is at 43% context," but the actual number is off by 10-20%, causing agents to die at the wrong time, miss their peak transmission window, or overflow unexpectedly.

**Why it happens:**
- Token counting is an *estimate* per Anthropic's docs — "the actual number of input tokens used when creating a message may differ by a small amount"
- Tool definitions, system prompts, and Agent SDK framing consume tokens that are not part of "citizen thoughts" but count toward the window
- Prompt caching means some tokens are "free" on re-reads but still occupy context space
- Extended thinking tokens count toward context but are stripped from subsequent turns — the mental model of "context = aging" gets complicated
- Claude 4.6 models have context awareness built in (they receive budget updates like `Token usage: 35000/1000000`), but this is the model's internal tracking, not yours

**Consequences:**
- Agents die before writing peak transmission (the single most important artifact)
- Agents overflow context and crash instead of dying gracefully
- Peak transmission window (40-50% context) is actually 35% or 55% due to accounting errors
- Death profiles become unpredictable — "old age" agents die at different actual lifespans

**Prevention:**
- Use the Claude API's token counting endpoint (`/v1/messages/count_tokens`) to pre-compute prompt sizes before sending, not just post-hoc usage tracking
- Track cumulative `input_tokens + output_tokens` from the SDK's `message.message.usage` (deduplicating by message ID for parallel tool calls)
- Reserve a 15-20% buffer from your theoretical max context — if you want peak transmission at 40-50%, trigger it at 35-45% of reported usage
- Build a `ContextBudget` abstraction that separates "system overhead tokens" (tools, system prompt, SDK framing) from "citizen life tokens" (actual citizen input/output), and only age based on citizen life tokens
- Test context tracking accuracy empirically: run a citizen to completion 10 times and measure variance in actual vs. predicted context usage

**Detection:**
- Citizens producing peak transmissions with noticeably different amounts of "life experience" (some have 3 turns, some have 8)
- Simulation crashes with context overflow errors instead of triggering graceful death
- Death profiles don't match their designed distributions in practice

**Phase relevance:** Must be solved in the mortality engine phase, before transmission system can work correctly. Foundation dependency.

**Confidence:** HIGH — Based on official Anthropic documentation on token counting and context windows, plus known Agent SDK behavior.

---

### Pitfall 3: Cost Explosion From Uncontrolled Agent Calls

**What goes wrong:** Each citizen is a `query()` call to the Claude Agent SDK. With 5 citizens per generation, 3+ generations, and each citizen potentially making multiple tool calls (each of which triggers additional LLM inference), a single simulation run can consume hundreds of thousands of tokens. The "Affordable Generative Agents" paper found Stanford's original generative agent simulation cost thousands of dollars, and even optimized versions ran at $3-5/hour for 2-3 agents. LINEAGE with 5 citizens x 3 generations = 15 citizens minimum, each with substantial context. In a hackathon where you are iterating rapidly, costs compound fast.

**Why it happens:**
- Each citizen's context grows linearly (that is the design — context = life)
- Turn-based interaction means later citizens in a generation receive all previous citizens' output as input, making each successive citizen more expensive
- The archaeological archive (full history) is potentially enormous if any citizen requests it
- Tool calls within the Agent SDK trigger additional inference rounds that are invisible in naive cost estimates
- Iterating on prompt engineering during development means running the full simulation repeatedly

**Consequences:**
- OAuth subscription rate limits hit during development (even "unlimited" plans have throughput caps)
- Simulation takes 10-15 minutes per run instead of the demo target of 5-7 minutes
- Development velocity drops because each test run is expensive in time and tokens
- The 48-hour hackathon timeline becomes a cost/throughput bottleneck, not a coding bottleneck

**Prevention:**
- Use the `total_cost_usd` field on every `query()` result message to track spend per citizen and per generation — build this into the simulation from day one, not as an afterthought
- Implement a cost ceiling: abort simulation if cumulative cost exceeds a configurable threshold
- Use Haiku for development/testing citizens and only switch to Sonnet/Opus for demo runs — the Agent SDK's `modelUsage` breakdown supports per-model cost tracking
- Cache transmission content aggressively: once a citizen writes a peak transmission, store it as a string, don't re-derive it from the agent's context
- Limit tool availability for citizens. Most citizens need write-only tools (produce transmission). Only Archivists need read access to the archive. Fewer tools = fewer tool-call inference rounds
- Build a "dry run" mode that simulates the orchestration (generation lifecycle, death timing, mutation) without actual LLM calls, using canned responses for development
- Start with 3 citizens per generation and 2 generations for development; scale up only for demos

**Detection:**
- `total_cost_usd` per generation is increasing faster than linearly
- Simulation wall-clock time exceeds 2 minutes per generation
- Rate limit errors (429s) appearing during runs

**Phase relevance:** Must be addressed from the very first phase. Cost tracking should be in the generation manager skeleton. The dry-run mode should exist before any real LLM calls.

**Confidence:** HIGH — Based on "Affordable Generative Agents" research, Anthropic's Agent SDK cost tracking docs, and known rate limit behavior.

---

### Pitfall 4: Agent SDK Authentication Failures During Long-Running Simulations

**What goes wrong:** OAuth tokens for Claude expire after 8-12 hours. A full simulation run (especially during development with debugging pauses) can span hours. The Claude Code GitHub has multiple open issues about OAuth credentials being silently wiped on failed token refresh, tokens expiring mid-session, and concurrent sessions invalidating each other's tokens. A simulation that runs 15 citizens sequentially, with debugging pauses between generations, will hit token expiration.

**Why it happens:**
- OAuth tokens have a TTL of 8-12 hours per reported behavior
- The Agent SDK requires API key authentication and explicitly prohibits using Claude.ai subscription billing (Pro/Max OAuth tokens)
- Failed token refresh can silently replace valid credentials with empty data
- Multiple concurrent Claude Code sessions can invalidate each other's refresh tokens

**Consequences:**
- Simulation dies mid-generation with 401 errors, losing all in-progress citizen work
- State is partially written — some citizens have transmissions, others don't
- The hackathon demo fails live because auth expired between setup and presentation

**Prevention:**
- Use API key authentication, not OAuth, for the simulation itself. API keys don't expire. The PRD says "OAuth" but the Agent SDK supports API keys and they are more reliable for programmatic use
- If OAuth is required: implement retry-with-reauth logic that detects 401 errors and re-authenticates before retrying the failed citizen
- Save simulation state atomically after every citizen completion (not just generation boundaries), so a failed auth mid-generation loses at most one citizen's work
- For the demo: authenticate fresh immediately before starting the run, ensuring maximum TTL remaining
- Set the `ANTHROPIC_API_KEY` environment variable as the primary auth method, with OAuth as fallback only

**Detection:**
- 401 errors in simulation logs
- Citizens that start but produce no output
- Gaps in the generation (4 citizens instead of 5 with no death explanation)

**Phase relevance:** Must be solved in initial project setup / Agent SDK integration phase. Before any citizen runs.

**Confidence:** HIGH — Based on multiple confirmed GitHub issues against claude-code and agent-sdk repos, including documented incidents in March 2026.

---

### Pitfall 5: The 17x Error Amplification Trap in Multi-Agent Chains

**What goes wrong:** Research from DeepMind demonstrates that uncoordinated multi-agent systems ("bag of agents") amplify errors by up to 17.2x. In LINEAGE, agents within a generation operate in a chain: Citizen 1's output is Citizen 2's input context, which feeds Citizen 3, etc. A single citizen producing a confused or off-topic response poisons every subsequent citizen in that generation. Across generations, this compounds further — a bad Generation 2 collective transmission corrupts Generation 3's entire inheritance.

**Why it happens:**
- Turn-based interaction creates a linear chain where errors propagate forward
- LLMs are confident even when wrong — downstream citizens cannot distinguish good input from hallucinated input
- No verification mechanism exists between citizens (the Skeptic role is a tendency, not a filter)
- Context poisoning: once incorrect information enters a citizen's context, it influences all subsequent output from that citizen

**Consequences:**
- One confused citizen derails an entire generation
- The civilization quickly converges on confidently wrong conclusions
- Interesting signal from early citizens gets drowned out by accumulated noise
- The Skeptic role becomes useless because it is equally susceptible to context poisoning

**Prevention:**
- The Skeptic role should have explicit architectural authority, not just a system prompt tendency — Skeptic output should be a filter that downstream citizens see flagged as "contested claims"
- Implement structured handoffs between citizens: instead of passing raw prose, pass structured JSON with `{claims: [...], confidence: ..., contested_by: [...]}` that the next citizen's prompt explicitly processes
- Limit what each citizen sees from previous citizens — not the full output, but a structured summary. This reduces the surface area for error propagation
- The collective transmission should be computed from individual citizen transmissions by a non-LLM aggregation step (e.g., taking the intersection of claims present in 3+ individual transmissions)
- Monitor for "echo chambers" where all citizens in a generation produce near-identical output — this signals error amplification, not consensus

**Detection:**
- Semantic similarity between citizens within a generation is > 0.9 (they are all saying the same thing)
- Later citizens in a generation are longer than earlier ones (they are building on accumulated context, not adding new signal)
- Civilization metrics show knowledge diversity dropping to near-zero within 2-3 generations

**Phase relevance:** Must be addressed in the turn-based interaction design and the transmission system. The structured handoff pattern should be designed before building the generation manager.

**Confidence:** HIGH — Based on peer-reviewed research on multi-agent error amplification and documented failure modes from production multi-agent systems.

---

## Moderate Pitfalls

---

### Pitfall 6: Cancer Simulation Is a Prompt Engineering Tar Pit

**What goes wrong:** The PRD requires simulating cognitive decline where "reasoning degrades at a random point" and "responses fragment" without the agent noticing. This is an extraordinarily difficult prompt engineering problem. Either the degradation is too obvious (the agent produces garbage), or it is too subtle (the output is indistinguishable from normal output, making cancer meaningless as a simulation mechanic). Getting the calibration right can consume days of iteration — time you do not have in a 48-hour hackathon.

**Why it happens:**
- LLMs resist producing incoherent output — they are trained to be helpful and clear
- System prompt instructions like "gradually become less coherent" produce either no effect or dramatic incoherence with no middle ground
- Temperature manipulation is the obvious lever but it affects everything, not just "reasoning quality"
- The "agent may not notice" requirement is impossible to enforce — LLMs don't have metacognition about their own output quality

**Prevention:**
- Start with the simplest possible cancer implementation: at the cancer trigger point, inject corrupted claims into the citizen's context (e.g., flip a key claim from the inheritance). This corrupts output without requiring the LLM to "degrade" — it reasons correctly from incorrect premises
- Defer prompt-level cognitive decline to post-hackathon. For v1, cancer = corrupted input, not degraded reasoning
- If you must do prompt-level degradation: append increasingly long irrelevant text to the system prompt to dilute the model's attention, rather than asking it to "be less coherent." This exploits the "lost in the middle" effect documented in LLM research
- Pre-author 3-4 cancer degradation templates at different severity levels and test them in isolation before integrating. Do not iterate on cancer prompts within full simulation runs

**Detection:**
- Spending more than 2 hours on cancer prompt engineering during the hackathon
- Cancer citizens producing either perfect output or total garbage with nothing in between
- Unable to reliably distinguish cancer output from normal output in blind testing

**Phase relevance:** Should be a late-phase concern. Get the simulation running with simple cancer (corrupted input) first. Sophisticated degradation is a polish item.

**Confidence:** MEDIUM — Based on general LLM prompt engineering knowledge and the "LLM Brain Rot" research on cognitive decline modeling. No direct precedent for this exact use case.

---

### Pitfall 7: State Files Grow Unboundedly as Generations Accumulate

**What goes wrong:** The archaeological archive stores every transmission from every citizen across every generation, plus mutation history. With 5 citizens per generation producing structured transmissions (peak, elder, accident, collective), a 10-generation run produces 50+ transmission documents plus metadata. The state JSON files grow with O(generations x citizens), and reading/writing them with `JSON.parse()` / `JSON.stringify()` becomes slow. More critically, when this archive is included in an agent's prompt (Archivist role, "on request" inheritance layer), it can blow out the context window.

**Why it happens:**
- `JSON.parse()` loads the entire file into memory — a 200MB JSON file spikes Node.js memory to ~2GB
- The Genesis `StateManager` uses atomic writes (temp file + rename), which requires serializing the entire state on every write
- No pruning or compaction strategy for the archive
- The Archivist role is designed to access the full archive, meaning the largest state file gets loaded into the most expensive resource (an LLM context window)

**Consequences:**
- Simulation slows down noticeably in later generations as state reads/writes take longer
- Node.js OOM crashes on state writes for long simulations (10+ generations)
- Archivist citizens get a truncated or corrupted view of the archive because it exceeds context limits
- State files become unreadable/undebuggable by humans

**Prevention:**
- Separate state into multiple files: one per generation (e.g., `gen-001.json`, `gen-002.json`), plus an index file. Never load all generations into memory at once
- Implement a transmission summary index: a lightweight file listing transmission IDs, citizen IDs, generation numbers, and one-line summaries. Archivists query the index first, then load specific transmissions by ID
- Set a hard cap on archive size delivered to any single agent (e.g., max 50K tokens of archive context). The Archivist gets a budget, not the whole archive
- For the hackathon (3 generations), this won't be a problem. But design the data schema assuming 100 generations so you don't have to rewrite it

**Detection:**
- State file writes taking > 100ms
- Simulation memory usage growing linearly with generation count
- Agent prompts exceeding 100K tokens due to archive inclusion

**Phase relevance:** Address in data schema design (early phase). The per-generation file split costs almost nothing to implement upfront but is expensive to retrofit.

**Confidence:** HIGH — Based on documented Node.js JSON handling limitations and the project's explicit state management requirements.

---

### Pitfall 8: Mutation Calibration Requires Empirical Tuning, Not Theory

**What goes wrong:** The PRD specifies mutation rates as simulation parameters (0.0-1.0), with categories of small, large, generative, and cancer mutations. But there is no way to determine correct default values from first principles. A mutation rate of 0.2 might mean "barely noticeable" or "civilization-destroying" depending on what the mutation actually does to the text. Teams spend hours theorizing about ideal mutation rates when the only way to calibrate is to run the simulation and observe results — which requires the entire simulation to be working first, creating a chicken-and-egg problem.

**Why it happens:**
- Mutation operates on LLM-generated text, which has high information density but also high redundancy — the impact of a mutation depends on where it lands
- "Small mutation" vs. "large mutation" is undefined until you implement it — is changing one word small? One sentence? One claim?
- The interaction between mutation and the telephone effect (Pitfall 1) makes them impossible to reason about in isolation
- Genesis is supposed to tune these parameters, but for v1 LINEAGE runs standalone and needs sensible defaults

**Prevention:**
- Define mutations as operations on structured data, not prose. If transmissions are `{claims: [...], confidence: number, key_insight: string}`, then "small mutation" = flip one claim's confidence, "large mutation" = remove or invert a claim. This makes the mutation space discrete and testable
- Start with mutation rate 0.0 and verify the simulation produces interesting output without any mutation. If it does not, mutation won't save it — you have a transmission quality problem (Pitfall 1)
- Build a standalone mutation test harness: take a fixed transmission, apply mutations at different rates, and visually inspect the results. Do this before integrating mutations into the full pipeline
- Default to mutation rate 0.1 (conservative). It is easier to increase mutation than to debug why civilization knowledge collapsed

**Detection:**
- All transmissions look identical across generations (mutation too low)
- Transmissions become incoherent noise within 2 generations (mutation too high)
- Spending more than 1 hour debating mutation rate values without running experiments

**Phase relevance:** The mutation pipeline should be built after the transmission system is working. Calibration is an empirical activity that happens in integration testing, not in design.

**Confidence:** MEDIUM — Based on analogous calibration challenges in genetic algorithm research and the specific interaction with LLM text processing.

---

### Pitfall 9: 48-Hour Hackathon Scope Trap — Building the Interesting Parts First

**What goes wrong:** The most intellectually interesting parts of LINEAGE (cancer simulation, generative mutations, emergent mythology, Genesis integration) are also the hardest to implement and the least necessary for a working demo. Teams are drawn to work on the fascinating subsystems while neglecting the boring but critical plumbing (state management, generation lifecycle, basic citizen execution). At hour 36, you have a beautiful mutation pipeline and no way to run a generation.

**Why it happens:**
- The PRD is rich with compelling features that are individually fascinating
- The "boring" systems (state management, config loading, CLI argument parsing, generation loop) feel like they will be quick but always take 2-3x longer than estimated
- Agent SDK integration and authentication setup is an unknown-unknown time sink
- Prompt engineering iteration is time-consuming and unpredictable — one prompt might take 30 minutes, another might take 4 hours
- Successful hackathon projects typically complete the essential user journey in 40-50% of the total time

**Prevention:**
- Implement in strict dependency order: (1) Agent SDK auth working, (2) single citizen executes and produces output, (3) generation loop runs N citizens sequentially, (4) transmission written and stored, (5) next generation receives inheritance, (6) death profiles applied, (7) mutation applied, (8) cancer and fancy features
- Define "demo-ready" as: 3 generations of 3 citizens, with visible transmissions and at least one death. Everything else is polish
- Time-box every subsystem: 4 hours max for any single component. If it is not working in 4 hours, simplify the design and move on
- Build the generation loop with stub citizens first (citizens that return canned text). This lets you test the entire orchestration pipeline before any LLM calls
- Front-load Agent SDK setup — if auth doesn't work in the first 4 hours, you have a blocking problem that needs immediate resolution

**Detection:**
- More than 8 hours in without a single successful citizen execution
- Spending time on cancer/mutation/metrics before the generation loop works end-to-end
- "Just one more feature" mentality after hour 30

**Phase relevance:** This is a meta-pitfall that affects phase ordering in the roadmap. The roadmap must enforce a strict dependency chain where foundational systems are complete before interesting features are attempted.

**Confidence:** HIGH — Universal hackathon failure mode, well-documented.

---

### Pitfall 10: Genesis Schema Coupling Creates Fragile Dependencies

**What goes wrong:** LINEAGE extends Genesis schemas (`AgentConfigSchema.extend(...)`) and composes with the Genesis event bus. But Genesis is in active development — its Phase 2 is being refactored to use the Agent SDK. Any schema change in `@genesis/shared` breaks LINEAGE's build. During a hackathon where both projects might be worked on in parallel, this coupling becomes a constant source of broken builds and wasted time.

**Why it happens:**
- TypeScript imports are compile-time dependencies — if the shape changes, everything downstream breaks
- Genesis schemas may need to change to support its own Agent SDK migration
- Path-based imports (`/Users/memehalis/genesis`) mean LINEAGE builds depend on the exact state of the Genesis repo on disk
- No version pinning possible with path references

**Prevention:**
- Create a thin adapter layer in LINEAGE that imports from Genesis and re-exports wrapped types. LINEAGE code never imports from `@genesis/shared` directly — it imports from `@lineage/schemas` which wraps the Genesis types. If Genesis changes, you fix one file, not every file
- Pin the Genesis dependency to a specific commit hash during the hackathon. Do not pull Genesis updates unless absolutely necessary
- Define LINEAGE-specific schemas independently (using Zod directly) and write a compatibility test that verifies they extend Genesis schemas correctly. If the test breaks, you know immediately without debugging a cascade of type errors
- For the hackathon: consider whether you actually need the Genesis dependency at all for v1. If `@genesis/shared` provides StateManager + EventEmitter + Zod schemas, you can vendor those three things in under 100 lines of code and eliminate the dependency entirely

**Detection:**
- TypeScript compilation errors referencing `@genesis/shared` types
- Spending more than 30 minutes debugging type incompatibilities between the two projects
- Genesis changes causing LINEAGE tests to fail

**Phase relevance:** Must be decided in project setup. Either commit to the Genesis dependency with an adapter layer, or vendor the needed utilities. Do not leave this ambiguous.

**Confidence:** MEDIUM — Based on standard monorepo coupling risks. The specific Genesis dependency is a project-specific concern.

---

## Minor Pitfalls

---

### Pitfall 11: Rate Limit Throttling During Rapid Development Iteration

**What goes wrong:** Even with OAuth subscription or API key authentication, Claude has throughput rate limits (requests per minute, tokens per minute). Running 5 citizens sequentially means 5 `query()` calls in rapid succession, each potentially involving multiple tool-use rounds. During development, you are running the simulation repeatedly. Three test runs back-to-back can trigger rate limiting, adding artificial delays that slow development iteration.

**Prevention:**
- Add configurable delays between citizen executions (default 1-2 seconds) to smooth request patterns
- Use a lighter model (Haiku) for development iteration — it has higher rate limits and lower cost
- Build the dry-run mode (Pitfall 3) so most development iteration does not require LLM calls at all

**Confidence:** MEDIUM — Rate limit behavior depends on specific subscription tier and concurrent usage.

---

### Pitfall 12: Prompt Size Growth Within a Generation

**What goes wrong:** In turn-based interaction, Citizen 5 receives the output of Citizens 1-4 as context. If each citizen produces 2,000 tokens of output, Citizen 5 starts with 8,000 tokens of peer context plus inheritance plus system prompt. This means later citizens in a generation are significantly more expensive and have less remaining context for their own "life." The last citizen in a generation effectively has a shorter lifespan than the first, creating an unintended structural bias.

**Prevention:**
- Summarize previous citizens' output before injecting it into the next citizen's context. Each citizen sees a compressed view (500 tokens max) of each predecessor, not the full output
- Make the summarization non-LLM (rule-based extraction of key claims) to avoid additional API costs
- Track "peer context tokens" separately from "citizen life tokens" in the ContextBudget abstraction — do not count inherited context against lifespan

**Confidence:** HIGH — Direct consequence of the turn-based architecture specified in the PRD.

---

### Pitfall 13: Observer/Archivist Roles Produce Content That Crowds Out Signal

**What goes wrong:** The Observer "watches, records, writes history" and the Archivist "protects existing knowledge." In practice, these roles produce meta-commentary about what other citizens said rather than original contributions to the seed problem. This meta-commentary enters the transmission pool and gets inherited, meaning Generation 3 inherits not just Generation 2's ideas but also Generation 2's commentary about Generation 1's ideas about the seed problem. The signal-to-noise ratio drops with each generation.

**Prevention:**
- Archivists and Observers should write to a separate "meta-archive" that is not included in standard inheritance. It is available on request but not delivered by default
- Weight transmissions by role: Builder transmissions get full weight in inheritance, Observer transmissions get 0.25x weight
- For v1 hackathon: consider starting with only Builder and Skeptic roles. Add Observer/Archivist/Elder Interpreter as post-hackathon additions

**Confidence:** MEDIUM — Based on multi-agent system design principles. The specific interaction depends on prompt engineering quality.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Agent SDK Setup | Auth failure blocks everything (Pitfall 4) | API key auth, not OAuth. Test auth before writing any other code. 4-hour time-box. |
| Mortality Engine | Context tracking imprecision (Pitfall 2) | Build ContextBudget abstraction with 15% safety buffer. Test against actual SDK usage reporting. |
| Transmission System | Telephone effect destroys signal (Pitfall 1) | Low temperature, structured output format, anchor tokens. Test telephone game in isolation before integrating. |
| Mutation Pipeline | Calibration is empirical not theoretical (Pitfall 8) | Start at 0.0 mutation rate, verify simulation works without mutation first. Structured mutations on claims, not prose. |
| Turn-based Interaction | Error amplification chain (Pitfall 5) | Structured handoffs between citizens. Limit what each citizen sees. Skeptic has architectural authority. |
| Cancer Simulation | Prompt engineering tar pit (Pitfall 6) | Implement as "corrupted input" not "degraded reasoning." 2-hour time-box, then ship simplest version. |
| Generation Manager | Scope creep (Pitfall 9) | Build with stub citizens first. Generation loop must work before any fancy features. |
| State Management | Unbounded growth (Pitfall 7) | Per-generation file split from day one. Summary index for archive access. 50K token cap on any single agent's archive view. |
| Genesis Integration | Schema coupling fragility (Pitfall 10) | Adapter layer or vendor dependencies. Decide in first hour, not midway through. |
| Cost Management | Cost explosion (Pitfall 3) | Track `total_cost_usd` from first citizen call. Dry-run mode. Haiku for development. Cost ceiling config. |

---

## Sources

- [LLM as a Broken Telephone: Iterative Generation Distorts Information (ACL 2025)](https://arxiv.org/abs/2502.20258)
- [Agent Drift: Quantifying Behavioral Degradation in Multi-Agent LLM Systems](https://arxiv.org/abs/2601.04170)
- [Why Your Multi-Agent System is Failing: The 17x Error Trap](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- [Affordable Generative Agents (cost reduction strategies)](https://arxiv.org/html/2402.02053v1)
- [Claude Agent SDK Cost Tracking Documentation](https://platform.claude.com/docs/en/agent-sdk/cost-tracking)
- [Claude Token Counting API Documentation](https://platform.claude.com/docs/en/build-with-claude/token-counting)
- [Claude Context Windows Documentation](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [OAuth token expiration disrupts autonomous workflows (GitHub issue)](https://github.com/anthropics/claude-code/issues/12447)
- [OAuth credentials silently wiped on failed token refresh (GitHub issue)](https://github.com/anthropics/claude-code/issues/29896)
- [Context Poisoning in LLMs (Elasticsearch Labs)](https://www.elastic.co/search-labs/blog/context-poisoning-llm)
- [Multi-Agent LLM System Failures Research](https://arxiv.org/pdf/2503.13657)
- [LLMs Can Get "Brain Rot" — Cognitive Decline from Low-Quality Data](https://arxiv.org/abs/2510.13928)
- [Stanford Generative Agents Research](https://dl.acm.org/doi/10.1145/3586183.3606763)
- [Claude Rate Limits Documentation](https://platform.claude.com/docs/en/api/rate-limits)
