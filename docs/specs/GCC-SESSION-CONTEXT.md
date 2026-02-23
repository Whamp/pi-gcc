# GCC Session Context — Design Decisions and Open Threads

**Source session:** `2026-02-22T19-52-11` (Opus 4.6 Thinking, high)
**Purpose:** Preserve discussion context that didn't make it into GCC-SPEC.md

---

## 1. Key Decisions Made (with rationale)

### 1.1 Paper Provides No Usable Implementation

The GCC paper is a conceptual framework, not an engineering spec. The GitHub repo (`theworldofagents/GCC`) is a thin npm wrapper around a closed-source Python MCP server (`aline-ai`) whose tools (`aline_init`, `aline_search`, `aline_show`) don't match the paper's COMMIT/BRANCH/MERGE/CONTEXT interface. The shipped product appears to be a simplified auto-commit session tracker, not the full GCC system. Implementation is from scratch.

### 1.2 Agent-Driven Memory (Option A) Over Auto-Enrichment (Option C)

Three options were debated:

- **(A) Agent provides everything** — agent calls tools, writes summaries, names branches
- **(B) Extension auto-generates everything** — hooks extract and summarize via LLM (like pi-automem)
- **(C) Agent triggers, extension enriches** — agent commits, extension auto-appends metadata (files changed, test results)

**Decision: Option A.** The user's reasoning: "the point of GCC is meant to be an agent managed memory. moving things out of its control or abstracting away could be confusing to it." The agent played out a scenario where Option C produces commit entries containing system-generated content the agent didn't write — when it reads back via `gcc_context`, it can't distinguish its own reasoning from machine artifacts. The mental model gets muddy.

The analogy that stuck: **"The agent is the author. The extension is the filing cabinet. The skill is the writing teacher."**

The extension's automatic behavior is limited to:

1. Injecting context at session start (orientation, not enrichment)
2. Catching unsaved work at session shutdown (safety net)
3. Preserving context before compaction
4. Maintaining log.md via `turn_end` hook (raw material, not interpretation)

### 1.3 GCC Memory vs Code — The Core Distinction

This was explicitly called out as "nuanced but very important." GCC commits are snapshots of the agent's **mind**, not the codebase:

- Commits capture "I decided X because Y" — not file diffs
- Branches are thought branches ("let me think about this differently") — not code branches
- Merges synthesize conclusions — not concatenate changes
- main.md is the agent's evolving understanding — not a changelog

The codebase already has git for version control. GCC is version control for **reasoning, decisions, and context**.

### 1.4 Log.md Is Independent from Pi Sessions

A significant debate explored whether log.md could be replaced by pi session JSONL files. The user identified the critical mismatch:

> "there is no guarantee that a pi session JSONL is a clean representation of every OTA since the last commit. maybe there are several pi sessions that aren't actually 'worthy' of a commit by the agent, maybe there are multiple gcc commits in a single pi session in which case log.md is getting reset each time."

The many-to-many relationship:

- Multiple pi sessions between GCC commits (work across days)
- Multiple GCC commits within a single pi session (productive streak)
- Some pi sessions have no GCC-worthy activity (quick questions)
- Compaction within a session destroys detail not yet committed

**Decision:** Log.md is maintained automatically by the extension's `turn_end` hook. It's a processed, human-readable OTA trace — NOT raw JSONL replication. It survives session boundaries, compaction, and model switches. It gets cleared after each `gcc_commit`.

### 1.5 Pure Scripted Logging (No Background LLM)

Debated whether the `turn_end` hook should use a small/cheap LLM for log processing. Rejected because:

1. **Log.md is raw material, not a finished product.** Intelligence is applied at commit time when the agent distills the log. Applying LLM twice (once to compress, once to distill) is wasteful.
2. **Accuracy > conciseness in a log.** Faithful recording gives better commit material. LLM summarization loses details.
3. **Practical concerns:** Cost per turn, latency, failure modes, non-determinism.
4. **Agent text is already its own summary.** Re-summarizing a summary is wasteful.

### 1.6 No Truncation, No Collapsing

Two strong user positions:

1. **Include thinking blocks** — "space is generally not a concern and is cheap AND the log.md gets reset after commits anyway."
2. **Don't collapse repetitive tool chains** — "why would we if you said they themselves reveal patterns. we would be removing signal."

The agent initially suggested collapsing `bash→bash→bash` into a single entry, then acknowledged this was contradictory — tool sequence patterns are signal, not noise.

### 1.7 Init as Script, Not Prompt Template

The user initially suggested `gcc_init` as a prompt template (`~/.pi/agent/prompts/gcc_init.md`). Later refined to a shell script in `skills/gcc/scripts/gcc-init.sh` because initialization is mostly mechanical (create directories, write template files). The agent's role is the project-specific part: writing `main.md` with actual goals and context.

### 1.8 Three-Layer Discovery

The discovery/instruction system uses three layers:

1. **Root AGENTS.md** (auto-loaded every session) — Brief section: "This project uses GCC. Current branch: X. Latest milestone: Y. Call `gcc_context` for full state."
2. **`.gcc/AGENTS.md`** (on demand) — Full protocol reference the agent reads when it needs deeper understanding
3. **Skill** (loaded when relevant) — General cognitive framework: when to commit, what constitutes a milestone, how to branch

Key constraint the user clarified: `.gcc/AGENTS.md` is NOT auto-discovered. Only root AGENTS.md is auto-loaded. The agent must explicitly read `.gcc/AGENTS.md`.

---

## 2. Departures from the GCC Paper

| Paper Design                         | Our Spec                                                                                         | Why                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Commands in system prompt only       | Extension tools + skill + AGENTS.md                                                              | Pi has real tool infrastructure; prompt-only is fragile           |
| Agent writes to log.md directly      | Extension maintains log.md via hooks                                                             | Agent shouldn't do bookkeeping; hooks handle it silently          |
| Flat COMMIT/BRANCH/MERGE commands    | `gcc_commit`, `gcc_branch`, `gcc_merge`, `gcc_context`, `gcc_switch` tools with typed parameters | Pi tools have structured parameters, not string commands          |
| `CONTEXT` with scroll_up/scroll_down | `gcc_context` with level enum + branch/commit/segment params                                     | Scrolling is an SWE-Agent artifact; pi agents read files directly |
| Log.md is agent-maintained           | Log.md is auto-maintained by `turn_end` hook                                                     | Reduces agent bookkeeping burden                                  |
| COMMIT creates a git commit          | COMMIT writes to .gcc files only                                                                 | GCC manages agent memory, not code; git is separate               |
| `.GCC/` directory                    | `.gcc/` directory                                                                                | Lowercase convention for dotfiles                                 |
| `commit.md` (singular) per branch    | `commits.md` (plural) per branch                                                                 | It's a log of many commits, not one                               |
| `gcc_status` proposed then merged    | Folded into `gcc_context` with `level: status`                                                   | Simpler tool surface                                              |

---

## 3. Design Rationale Not in Spec

### 3.1 pi-automem as Studied Anti-Pattern

The agent studied pi-automem (`github.com/Whamp/pi-automem`) as a reference implementation. pi-automem:

- Hooks `session_shutdown` to extract learnings via LLM (Gemini)
- Stores memories in AutoMem/FalkorDB+Qdrant for semantic search
- Provides `automem_store`/`automem_recall` tools

Identified as "more instructive as a pattern than as a direct foundation" — it's a flat memory store with no structure, no versioning, no hierarchy. GCC adds the structured skill layer that automem lacks.

### 3.2 Rolling Summary Is Critical

The agent emphasized this as "THE key insight" from the paper:

> "The rolling summary means the latest commit entry is always a self-contained summary of everything the branch has figured out — you get progressive compression for free."

Each commit re-synthesizes all prior progress into a fresh summary. Reading only the latest commit gives you the complete compressed history plus the latest contribution. Earlier commits are available for detail but not required for continuity.

### 3.3 95% Cache Efficiency Supports Cost-Free Context Injection

Session analysis showed pi's cache hit rate is 95%+ median. This means the `before_agent_start` hook injecting GCC state at session start has negligible cost impact — the injected content gets cached on subsequent turns.

### 3.4 Why GCC Branches Are Independent of Pi Session Branches

Pi's `/fork` and `/tree` branch the conversation tree. GCC branches are explicitly created by the agent for memory isolation. A pi session fork may signal a different line of thinking, but:

- The user noted: "a pi session branch could be a signal the agent chooses to use... but we shouldn't force this to be the case"
- The agent can switch between GCC branches without switching pi sessions
- A default `main` branch is created on initialization

---

## 4. Unresolved Topics

### 4.1 Tool Prefix

The agent proposed `gcc_` as the tool prefix and asked: "any feelings on the `gcc_` prefix? It could be `ctx_`, `mem_`, or something else entirely." **The user never answered this.** The spec uses `gcc_` throughout but this was never explicitly confirmed.

### 4.2 gcc_status Was Silently Merged

The agent proposed `gcc_status` as a separate tool from `gcc_context`. In the spec, it appears as `gcc_context` with `level: status` as the default behavior. This merge was never explicitly discussed or confirmed.

### 4.3 Session References in state.yaml

The spec includes a `sessions` list in `state.yaml` linking pi sessions to GCC branches. This was never validated in discussion — it was added during spec writing without explicit debate about whether it's worth tracking.

### 4.4 First-Time Discovery Flow

What happens the first time an agent encounters a project with `.gcc/` but hasn't been taught about GCC? The root AGENTS.md section says "call `gcc_context`" but the agent needs the extension installed to have that tool. The discovery/onboarding flow for new agents or new extension installs was not discussed.

---

## 5. Open Questions from the Spec (Never Discussed)

These appear in Section 14 of the spec but were never debated in the session:

1. **Commit hash format** — Short random hex (`a1b2c3d4`) or sequential numbering? Hashes feel more git-like but sequential is simpler for "show me commit 5."

2. **Log.md archival on commit** — Should cleared log entries be appended to an archive file (`.gcc/branches/<name>/log-archive.md`) or discarded entirely? Archive preserves drill-down capability but grows unboundedly.

3. **gcc_commit two-step flow** — The commit process is inherently two-step: (1) extension provides log.md to agent, (2) agent provides commit entry. Should this be two tool calls, or one tool call that returns log.md and expects a structured response?

4. **Root AGENTS.md update frequency** — Update after every commit (always current but noisy diffs), or only after merges and major roadmap changes?

5. **`.gcc/` in `.gitignore`?** — Default should probably be tracked (enables collaboration), but some users may want private memory.

---

## 6. User Preferences and Design Instincts

These are the user's stated values that should guide future decisions:

- **Agent autonomy over automation** — Trust the agent to make judgment calls. Don't automate away agency.
- **Signal preservation over conciseness** — Don't truncate, don't collapse, don't summarize prematurely. Raw material is cheap; lost signal is expensive.
- **Data-driven decisions** — The user requested empirical analysis of actual pi sessions before making verbosity/truncation decisions. Design choices should be grounded in measurements, not intuition.
- **Trust in frontier model intelligence** — "The models we are using in main pi agent sessions are very very smart." Design for capable models that can handle complexity, not dumbed-down interfaces.
- **Community package patterns** — This should be installable like any pi package, not require core changes.
- **The memory/code distinction matters deeply** — Repeatedly emphasized that GCC manages reasoning, not code.

---

## 7. Empirical Data Collected

Two analysis scripts were run against 98 pi sessions (6110 agent turns). Key numbers used to inform design:

**Sizing:**

- Median agent text per turn: 117 chars
- Median thinking per turn: 44 chars
- Combined (text + thinking): ~510 chars/turn median
- 20 turns between commits: ~10k chars (~2.5k tokens)
- 50 turns between commits: ~25k chars (~6k tokens)

**Patterns:**

- 45% of combined output is thinking blocks
- Sessions average 62 turns
- Median agentic depth: 4 turns/prompt; P90: 24; max: 164
- 7% of sessions use multiple models
- Cache efficiency: 95% median
- Tool results are the space hogs (read: 6k avg, bash: 1.8k, search: 14.4k)

**Model differences:**

- Claude Opus: minimal text during tool-use, substantial terminal responses
- GPT-5.3 Codex: almost no text during tool use, always thinks
- Gemini 3.1 Pro: largest thinking blocks (terminal median 2997 chars)

These confirm: full reasoning + thinking fits easily in log.md, model tagging is valuable, per-model branches are overkill.
