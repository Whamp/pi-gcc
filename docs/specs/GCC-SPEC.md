# GCC — Git Context Controller for Pi

## Design Specification

**Date:** 2026-02-22
**Status:** Draft
**Based on:** [Git Context Controller paper](https://arxiv.org/html/2508.00031v1) (Wu, 2025)

---

## 1. Overview

GCC is a structured context management system for the [pi coding agent](https://github.com/badlogic/pi-mono). It gives agents version-controlled memory — persistent, navigable, and organized — that survives across sessions, compactions, and model switches.

GCC treats agent memory like a git repository. Commits capture what the agent learned and decided. Branches isolate exploratory lines of thinking. Merges synthesize conclusions. The agent owns its memory: it decides when to commit, what to name branches, and how to summarize its understanding.

**What GCC manages is agent memory, not code.** A GCC commit captures "I decided X because Y" — not file diffs. The codebase already has git for that. GCC is version control for reasoning, decisions, and context.

### 1.1 Problems Solved

1. **Cross-session continuity** — Agent picks up where it left off without re-explanation.
2. **Long-horizon project scaffolding** — Structured milestones, branching explorations, and an evolving roadmap across many sessions.
3. **Multi-resolution context retrieval** — Navigate from high-level roadmap down to fine-grained reasoning traces. Compaction no longer means lost detail.
4. **Multi-agent handoff** — New agents, different models, or subagents inherit structured project memory with minimal overhead.

### 1.2 Design Principles

- **Agent-driven memory.** The agent decides when to commit, what to summarize, when to branch. No automatic enrichment or summarization of the agent's own memory entries.
- **Automatic logging.** The raw OTA (Observation-Thought-Action) trace between commits is maintained automatically by extension hooks — the agent never writes to log.md directly.
- **Full fidelity.** Agent reasoning and thinking blocks are logged without truncation or collapsing. Patterns in tool sequences are signal, not noise.
- **Portable artifacts.** The `.gcc/` directory contains plain-text files readable by any agent, any model, any human. No dependency on pi internals.
- **Separation of concerns.** The extension handles mechanics (file I/O, hook processing, retrieval). The skill teaches judgment (when to commit, how to write good memory, when to branch).

---

## 2. Architecture

GCC is a pi community package consisting of:

| Component   | Type                                     | Purpose                              |
| ----------- | ---------------------------------------- | ------------------------------------ |
| Extension   | TypeScript (`extensions/gcc.ts`)         | Tools, event hooks, file management  |
| Skill       | Markdown (`skills/gcc/SKILL.md`)         | Cognitive instructions for the agent |
| Init script | Shell (`skills/gcc/scripts/gcc-init.sh`) | One-time mechanical project setup    |

### 2.1 Extension

Registers tools the agent calls to manage its memory. Hooks into pi's session lifecycle to maintain the OTA log automatically and inject context at session start.

### 2.2 Skill

Loaded into the agent's context when relevant. Teaches the agent:

- What constitutes a meaningful commit (milestone in understanding, not just activity)
- When to branch (exploring an alternative line of thinking)
- When to merge (synthesizing conclusions from an exploration)
- How to write good memory entries (decisions and rationale, not implementation details)

### 2.3 Init Script (`skills/gcc/scripts/gcc-init.sh`)

A shell script in the skill's `scripts/` subdirectory that handles the mechanical setup: creating the `.gcc/` directory structure, writing template files (`AGENTS.md`, `state.yaml`, empty `log.md`), and appending the GCC section to root `AGENTS.md`. Run once per project by the agent.

The agent's role in initialization is the project-specific part: writing `main.md` with actual goals, milestones, and context based on conversation with the user. The skill instructs the agent to run the init script first, then author `main.md`.

---

## 3. File System

```
<project>/
├── AGENTS.md              # Existing file; GCC appends a section on init
└── .gcc/
    ├── AGENTS.md           # Full GCC protocol reference for agents
    ├── main.md             # Evolving project understanding and roadmap
    └── branches/
        └── <branch-name>/
            ├── commits.md      # Milestone memory snapshots (appended)
            ├── log.md          # OTA trace since last commit (auto-maintained)
            └── metadata.yaml   # Structured context the agent wants to remember
```

### 3.1 Root AGENTS.md Section

The extension appends a brief section to the project's root `AGENTS.md` on initialization. This is auto-loaded every session, so the agent always knows GCC exists. Contains:

- One-line statement that this project uses GCC
- Current branch name and latest milestone summary
- Instruction to call `gcc_context` for full project state

Updated by the extension after commits and merges to keep the summary current.

### 3.2 `.gcc/AGENTS.md`

Full protocol reference. Documents the GCC tools, file structure, and conventions. The agent reads this on demand when it needs deeper understanding of the GCC system. Not auto-loaded — requires the agent to read the file.

### 3.3 `main.md` — Project Roadmap

The agent's evolving understanding of the project. Contains:

- Project goals and intent
- Key milestones (completed and planned)
- Current state and priorities
- Important decisions and their rationale

Shared across all branches. Updated by the agent after commits, merges, or when the roadmap shifts. This is the highest-resolution view — a new agent reading only `main.md` should understand the project's purpose, state, and direction.

### 3.4 `commits.md` — Branch Memory

Each branch maintains a `commits.md` file. Each time the agent calls `gcc_commit`, a new entry is appended with three blocks:

```markdown
---

## Commit <hash> | <timestamp>

### Branch Purpose

Why this branch exists. The question being explored or the goal being pursued.
Inherited from the BRANCH command and optionally refined.

### Previous Progress Summary

Rolling compression of all prior commits on this branch.
Re-synthesized each commit by combining the previous summary with the latest contribution.
The latest commit entry always contains a self-contained summary of the full branch history.

### This Commit's Contribution

What was just learned, decided, or understood.
Focuses on reasoning, decisions, and insights — not implementation details.
```

The rolling summary is critical: the agent re-synthesizes all prior progress into a fresh summary with each commit. Reading only the latest commit entry gives you the complete compressed history of the branch plus the latest contribution. Earlier commits are available for detail but not required for continuity.

### 3.5 `log.md` — OTA Trace

Fine-grained reasoning trace maintained **automatically** by the extension via the `turn_end` hook. The agent never writes to this file directly.

Each agent turn appends an entry:

```markdown
## Turn <n> | <timestamp> | <provider/model>

**Thought**: <agent's text output — full, no truncation>
**Thinking**: <extended thinking/chain-of-thought block — full, no truncation>
**Action**: <tool-name>(key-arg), <tool-name>(key-arg), ...
**Observation**: <tool-name>: <compact result summary — success/fail, key detail>
```

Design rules for log.md:

- **Full reasoning text.** No truncation of the agent's text or thinking blocks. These are the raw signal.
- **Full tool sequences.** No collapsing of repetitive tool chains. `bash→bash→bash` is a pattern, not noise.
- **Model-tagged.** Each entry records which model produced it. Different models reason differently; the committing agent should know the provenance of each thought.
- **Compact tool results.** Tool output is summarized (tool name, success/fail, key metrics like line count or exit code) — not the full output, which lives in the session JSONL.
- **Reset on commit.** When the agent calls `gcc_commit`, the extension reads log.md, provides it to the agent for distillation, then clears/archives it for the next commit cycle.

#### Log.md vs Pi Session JSONL

Log.md and session JSONL are related but serve different purposes:

| Aspect        | log.md                       | Session JSONL                 |
| ------------- | ---------------------------- | ----------------------------- |
| Scope         | Since last GCC commit        | Single pi session             |
| Persistence   | Survives session boundaries  | Per-session file              |
| Content       | Processed OTA entries        | Raw entries with full content |
| Maintained by | Extension hook (automatic)   | Pi core (automatic)           |
| Purpose       | Raw material for GCC commits | Pi's conversation history     |

Key: there is no 1:1 mapping between sessions and commits. Multiple sessions can occur between commits. Multiple commits can occur within a session. Some sessions may have no GCC-worthy activity. Log.md tracks OTA cycles since the last commit, regardless of session boundaries.

### 3.6 `metadata.yaml` — Structured Context

Agent-managed structured metadata. Default sections include:

- `file_structure`: Project file layout and per-file responsibilities
- `env_config`: Environment, dependencies, build configuration
- Additional sections added by the agent as needed

Updated on demand — typically during or after a commit when the agent detects structural changes.

---

## 4. Tools

All tools are agent-driven. The agent provides all summaries, names, and content. The extension handles file I/O and state management.

### 4.1 `gcc_commit`

**Purpose:** Checkpoint a milestone in the agent's understanding.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `summary` | string | yes | What was learned/decided in this commit |
| `update_roadmap` | boolean | no | Whether to also update main.md (agent prompted if true) |

**Behavior:**

1. Read the current branch's `log.md` (all OTA entries since last commit)
2. Return log contents to the agent
3. Agent provides the three-block commit entry (branch purpose, progress summary, this contribution) in its next assistant response
4. Extension captures that response in the `agent_end` hook and appends the entry to `commits.md` with a generated hash and timestamp
5. Extension clears `log.md` for the next cycle
6. If `update_roadmap` is true, agent is prompted to revise `main.md`
7. Extension updates the root `AGENTS.md` GCC section with latest milestone

**Returns:** The current log.md contents so the agent can distill them into the commit. After the agent provides its commit content, the extension finalizes the commit in `agent_end` and resets the log (no additional follow-up agent turn required).

### 4.2 `gcc_branch`

**Purpose:** Create a new memory branch to explore an alternative line of thinking.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Branch name (descriptive, kebab-case) |
| `purpose` | string | yes | Why this branch exists — the question or hypothesis |

**Behavior:**

1. Create `.gcc/branches/<name>/` directory
2. Initialize empty `log.md`
3. Initialize `commits.md` with the branch purpose
4. Initialize empty `metadata.yaml`
5. Set `<name>` as the current active branch (tracked in `.gcc/state.yaml`)
6. Begin appending OTA entries to this branch's `log.md`

**Notes:**

- GCC branches are independent from pi session branches (`/fork`, `/tree`). A pi session fork may signal a different line of thinking, but GCC branches are explicitly created by the agent for memory isolation.
- The agent can switch between GCC branches without switching pi sessions.
- A default branch (e.g., `main`) is created on initialization.

### 4.3 `gcc_merge`

**Purpose:** Synthesize conclusions from a branch back into the current branch.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch` | string | yes | Name of the branch to merge into the current branch |
| `synthesis` | string | yes | Agent's summary of what was learned and how it integrates |

**Behavior:**

1. Automatically call `gcc_context --branch <branch>` to surface the branch's commit history
2. Agent provides synthesis (what was learned, what's being kept/discarded)
3. Extension appends a merge commit to the current branch's `commits.md`
4. Extension updates `main.md` with the branch outcome and its impact on the roadmap
5. Extension updates root `AGENTS.md` GCC section
6. Merged branch directory is retained (not deleted) for reference

### 4.4 `gcc_context`

**Purpose:** Multi-resolution retrieval of project memory.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `level` | enum | no | One of: `status`, `branch`, `commit`, `log`, `metadata` |
| `branch` | string | no | Branch name to inspect (default: current) |
| `commit` | string | no | Specific commit hash to view |
| `segment` | string | no | Metadata segment to retrieve (e.g., `file_structure`) |

**Behavior by level:**

**`status`** (default when called with no args):

- Returns main.md content (roadmap, goals, current state)
- Lists all branches with their purpose and latest commit summary
- Shows current active branch

**`branch`**:

- Returns the branch's purpose and the latest commit entry (which contains the rolling progress summary)
- Lists recent commits with hashes and one-line summaries

**`commit`**:

- Returns the full commit entry for a specific hash

**`log`**:

- Returns the current log.md contents (OTA trace since last commit)

**`metadata`**:

- Returns the specified segment from metadata.yaml, or lists available segments

### 4.5 `gcc_switch`

**Purpose:** Switch the active GCC branch.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch` | string | yes | Branch name to switch to |

**Behavior:**

1. Validate the branch exists
2. Update active branch in `.gcc/state.yaml`
3. Begin appending OTA entries to the new branch's `log.md`
4. Return the new branch's latest commit summary for orientation

---

## 5. State File

`.gcc/state.yaml` tracks runtime state:

```yaml
active_branch: main
initialized: "2026-02-22T14:00:00Z"
last_commit:
  branch: main
  hash: a1b2c3d4
  timestamp: "2026-02-22T15:30:00Z"
  summary: "Decided on event sourcing for state sync"
```

> **Deferred (v1):** The original design included a `sessions` list in `state.yaml` linking pi sessions to GCC branches. This is deferred because: (a) it requires YAML list serialization, which adds complexity to the minimal YAML parser for an informational-only feature, and (b) no tool or hook depends on session tracking data. Can be added in a future version with a full YAML library if needed.

---

## 6. Event Hooks

The extension hooks into pi's session lifecycle for three purposes: automatic OTA logging, context injection at session start, and safety-net capture at session shutdown.

### 6.1 `turn_end` — OTA Logging

After each agent turn, the extension receives a `TurnEndEvent`:

```typescript
{
  type: "turn_end";
  turnIndex: number;           // 0-based turn index
  message: AgentMessage;       // The assistant's message (guard for role === "assistant")
  toolResults: ToolResultMessage[];  // Tool results for this turn
}
```

The `AssistantMessage` contains `content: (TextContent | ThinkingContent | ToolCall)[]`, plus `provider`, `model`, and `timestamp` (epoch ms). Tool results are separate in `toolResults`, each with `toolName`, `content`, `details`, and `isError`.

The extension:

1. Guards that `message.role === "assistant"` (skips non-assistant messages)
2. Extracts text content from `TextContent` items in `message.content`
3. Extracts thinking from `ThinkingContent` items in `message.content`
4. Extracts tool calls from `ToolCall` items in `message.content` (name + key arguments)
5. Extracts tool results from `toolResults` (name, success/fail, compact summary from `details`)
6. Tags the entry with `message.provider/message.model`
7. Uses `turnIndex + 1` for the display turn number
8. Uses `new Date(message.timestamp).toISOString()` for the timestamp
9. Appends the formatted OTA entry to the active branch's `log.md`

Processing rules:

- **No truncation** of agent text or thinking
- **No collapsing** of repetitive tool sequences
- **Compact tool results** — use structured `details` field (file path, line count, exit code), not full output content
- **Skip turns with no meaningful content** — e.g., aborted turns, error-only turns with no reasoning

### 6.2 `before_agent_start` — Context Injection

At the start of each agent turn cycle (after user sends a prompt), the extension receives a `BeforeAgentStartEvent`:

```typescript
{
  type: "before_agent_start";
  prompt: string;
  systemPrompt: string;
}
```

The handler returns a `BeforeAgentStartEventResult` to inject context:

```typescript
{
  message: {
    customType: "gcc_context_injection",
    content: "...",     // Markdown string with GCC state
    display: false,     // Not shown in UI, only sent to LLM
  }
}
```

The extension:

1. Checks if `.gcc/` exists in the project (via `state.isInitialized`)
2. If yes, builds a context injection message containing:
   - Current branch name and purpose
   - Latest commit summary (the rolling progress summary from the most recent commit)
   - Any uncommitted log.md entries count ("12 turns since last commit")
3. Returns the message as a `BeforeAgentStartEventResult`
4. This ensures the agent always has GCC orientation without calling `gcc_context`

### 6.3 `session_start` — Session Registration

When a new pi session starts:

1. Check for `.gcc/` directory
2. If present, display notification with current GCC state

> **Note:** Session-to-branch tracking in `state.yaml` is deferred for v1. See section 5.

### 6.4 `session_shutdown` — Safety Net

When a pi session ends:

1. If there are uncommitted OTA entries in log.md, notify the user
2. Do NOT auto-commit — the agent owns its memory
3. Log.md persists to disk regardless — it will be there next session

### 6.5 `session_before_compact` — Compaction Awareness

Before pi compacts the session, the extension can inject GCC context into the compaction's `customInstructions` so the compaction summary preserves GCC orientation:

```typescript
SessionBeforeCompactEvent = {
  type: "session_before_compact";
  preparation: CompactionPreparation;
  customInstructions?: string;
  signal: AbortSignal;
}

SessionBeforeCompactResult = {
  cancel?: boolean;
  compaction?: CompactionResult;
}
```

The extension:

1. If GCC is not initialized, skip (return nothing).
2. Does NOT cancel or override compaction.
3. Injects a custom instruction string by appending to `event.customInstructions`:
   `"GCC memory system active on branch '<name>'. N uncommitted turns in .gcc/branches/<name>/log.md. Latest commit: <summary>."`
   This helps the compaction summary retain awareness of GCC state.

> **Note:** The extension does not provide a custom `compaction` result and does not cancel compaction. It only mutates `event.customInstructions` (when present) to add a GCC reminder.

### 6.6 `resources_discover` — Skill Registration

After `session_start`, pi fires `resources_discover` to collect additional resource paths:

```typescript
ResourcesDiscoverEvent = {
  type: "resources_discover";
  cwd: string;
  reason: "startup" | "reload";
}

ResourcesDiscoverResult = {
  skillPaths?: string[];
  promptPaths?: string[];
  themePaths?: string[];
}
```

The extension returns `{ skillPaths: [gccSkillDir] }` where `gccSkillDir` is resolved relative to the extension's source file using `import.meta.url` (not `__dirname`, which is unavailable in ESM).

### 6.7 State Lifecycle

The extension manages shared state (`GccState`, `BranchManager`, `CommitFlowManager`) across all hooks and tools:

- **Module-level variables:** `let state: GccState | null`, `let branches: BranchManager | null`, `const commitFlow = new CommitFlowManager()`. Initialized to `null`.
- **`session_start`:** Creates `GccState` and `BranchManager` using `ctx.cwd`. Calls `state.load()`. If `.gcc/` exists and state is initialized, shows a notification. If `.gcc/` doesn't exist, state remains with `isInitialized === false`.
- **`resources_discover`:** Does not depend on state. Returns skill paths unconditionally.
- **Tools:** Guard with an error message if `state` is null or `state.isInitialized` is false (e.g., `"GCC not initialized. Run the gcc-init.sh script first."`).
- **`before_agent_start` / `turn_end` / `agent_end`:** Skip silently (return `undefined`) if `state` is null or not initialized.
- **`session_shutdown`:** Skip silently if state is null.

### 6.8 Commit Flow Integration

The 2-step commit flow spans the `gcc_commit` tool and the `agent_end` hook:

1. **`gcc_commit` tool execute:** Calls `executeGccCommit(params, state, branches)` to get log content. Also calls `commitFlow.setPendingCommit(params.summary)` to arm the flow. Returns log content to the agent.
2. **Agent responds** with the three commit blocks (`### Branch Purpose`, etc.).
3. **`agent_end` hook:** Calls `commitFlow.handleAgentEnd(event.messages)`. If it returns `{ summary, commitContent }`, calls `finalizeGccCommit(summary, commitContent, state, branches, projectDir)` to write the commit.
4. **Notification:** After finalization, calls `ctx.ui.notify("GCC commit written: <hash>", "info")` to inform the user. Does NOT use `pi.sendMessage({ deliverAs: "followUp" })` because the agent has already finished — a follow-up message would trigger an unnecessary extra turn. A UI notification is sufficient.

### 6.9 Tool Execute Wrapper Pattern

All tool functions (`executeGccCommit`, `executeGccBranch`, etc.) return plain `string` results. The `registerTool` execute handler wraps them:

```typescript
execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => ({
  content: [
    { type: "text", text: toolFunction(params, state, branches, ctx.cwd) },
  ],
  details: {},
});
```

### 6.10 ESM Path Resolution

This project uses ESM (`"type": "module"`). `__dirname` is not available. Use:

```typescript
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

This applies to `resources_discover` when resolving the `skills/gcc` directory path.

---

## 7. Skill

The GCC skill (`skills/gcc/SKILL.md`) teaches the agent when and how to use GCC tools effectively. It is loaded into context when the agent's task matches its description.

### 7.1 Skill Description (for auto-discovery)

```
Use when working on a project with GCC (Git Context Controller) memory management.
Guides the agent on when to commit memory milestones, when to branch for exploratory
thinking, how to write effective memory entries, and how to use multi-resolution
context retrieval.
```

### 7.2 Skill Content Outline

**When to commit:**

- You've reached a stable understanding or decision
- You've completed an exploration and have a conclusion
- You're about to change direction significantly
- A meaningful amount of work has accumulated (use judgment, not a fixed interval)
- Before ending a session if significant progress was made

**How to write good commits:**

- Focus on decisions and rationale, not implementation details
- Capture "why" more than "what" — the code captures "what"
- The rolling progress summary should be self-contained — a new agent reading only the latest commit should understand the full branch history
- Be specific: "Chose PostgreSQL over MongoDB because ACID compliance is required for financial transactions" not "Chose database"
- See [Appendix A](#appendix-a-reference-prompts-for-commit-writing) for detailed instructions on writing each commit block

**When to branch:**

- You want to explore an alternative approach without contaminating current thinking
- You're prototyping something uncertain
- You want to compare two design hypotheses

**When to merge:**

- A branch has reached a conclusion (positive or negative)
- The branch's findings should inform the main line of thinking
- Include what was learned even if the approach was abandoned

**When to use context retrieval:**

- Starting a new session on an existing project — call `gcc_context` first
- Before making a decision that might conflict with earlier reasoning
- When you need to recall the rationale behind a previous decision

---

## 8. Initialization Flow

Initialization is split between a script (mechanical) and the agent (project-specific).

### 8.1 Init Script (`gcc-init.sh`)

Located at `skills/gcc/scripts/gcc-init.sh`. The agent runs this via bash. The script:

1. Creates `.gcc/` directory structure:
   - `.gcc/branches/main/` directory
   - `.gcc/branches/main/log.md` — empty
   - `.gcc/branches/main/commits.md` — header only
   - `.gcc/branches/main/metadata.yaml` — empty template
   - `.gcc/state.yaml` — initialized with `active_branch: main`

2. Writes `.gcc/AGENTS.md` from a bundled template (full GCC protocol reference)

3. Appends GCC section to root `AGENTS.md` (creates if doesn't exist):

   ```markdown
   ## GCC — Git Context Controller

   This project uses GCC for agent memory management.
   Current branch: main | Latest milestone: (initial setup)
   Call `gcc_context` to load full project state.
   See `.gcc/AGENTS.md` for the full GCC protocol reference.
   ```

4. Is idempotent — safe to run again without clobbering existing content

### 8.2 Agent Writes `main.md`

After the script runs, the skill instructs the agent to author `.gcc/main.md` — the project roadmap. This is the one part that requires the agent's understanding of the project: goals, milestones, current state, priorities. The agent writes this based on its current context and conversation with the user.

### 8.3 `.gitignore` Considerations

Default: track `.gcc/` in git (enables cross-agent collaboration). User can choose to gitignore it if memory is private.

---

## 9. Data Flow

```
User prompt
    │
    ▼
Agent reasons, calls tools
    │
    ├──► turn_end hook ──► append OTA entry to .gcc/branches/<active>/log.md
    │                       (automatic, full fidelity, model-tagged)
    │
    ▼
Agent decides to commit
    │
    ▼
gcc_commit(summary)
    │
    ├──► Extension reads log.md, returns to agent
    ├──► Agent writes three-block commit entry
    ├──► Extension appends to commits.md
    ├──► Extension clears log.md
    ├──► Extension updates root AGENTS.md section
    └──► Agent optionally updates main.md

Agent decides to explore
    │
    ▼
gcc_branch(name, purpose)
    │
    ├──► Extension creates branch directory
    ├──► OTA logging switches to new branch
    └──► Agent works on branch, commits as needed

Agent concludes exploration
    │
    ▼
gcc_merge(branch, synthesis)
    │
    ├──► Extension loads branch history via gcc_context
    ├──► Agent provides synthesis
    ├──► Extension writes merge commit
    └──► Extension updates main.md and root AGENTS.md

New session starts
    │
    ▼
before_agent_start hook
    │
    ├──► Inject current branch + latest commit summary
    └──► Agent has immediate GCC orientation
```

---

## 10. Edge Cases

### 10.1 Log.md Exceeds Context Window

Based on session analysis (98 sessions, 6110 turns), log.md with full reasoning + thinking averages ~510 chars/turn. Even at 50 turns between commits, log.md would be ~25k chars (~6k tokens) — well within any modern context window.

For extreme cases (200+ turns without a commit):

- The `gcc_commit` tool should warn the agent if log.md exceeds a threshold (e.g., 100k chars)
- The agent can choose to commit more frequently or summarize selectively
- The skill teaches that committing regularly is good practice

### 10.2 Multiple Sessions Between Commits

Log.md persists on disk. When a new session starts, the extension checks for existing uncommitted entries in log.md and continues appending. The `before_agent_start` hook injects the uncommitted entry count so the agent knows work has accumulated.

### 10.3 Session Compaction

Pi's compaction summarizes old messages and discards detail. GCC's log.md is external to the session — compaction doesn't affect it. The `session_before_compact` hook optionally notes GCC state in the compaction summary.

### 10.4 Model Switches Mid-Session

Each OTA entry in log.md is tagged with provider/model. When the agent reads log.md at commit time, it can see which model produced which reasoning. No special handling needed — model diversity is captured naturally.

### 10.5 Concurrent Agents (Subagents)

If subagents are active, they operate in their own sessions. The main agent's GCC state is unaffected. Subagent output reaches the main agent through tool results, which are captured in log.md's Observation field.

Future extension: subagents could have their own GCC branches, merged back by the orchestrator. Not in scope for v1.

### 10.6 Abandoned Branches

Branches are never auto-deleted. An abandoned branch's commits and log remain for reference. The agent can note abandonment reasons in a final commit before switching away.

---

## 11. Empirical Basis

Design decisions informed by analysis of 98 pi sessions (6110 agent turns, 679 user messages, $264.71 total cost):

| Metric                                | Value                  | Implication                                               |
| ------------------------------------- | ---------------------- | --------------------------------------------------------- |
| Median agent text per turn            | 117 chars              | Full reasoning fits easily in log.md                      |
| Median thinking per turn              | 44 chars               | Including thinking adds minimal overhead                  |
| Thinking as % of combined output      | 45%                    | Significant reasoning signal; must include                |
| Median agentic depth                  | 4 turns/prompt         | Moderate OTA volume between user interactions             |
| P90 agentic depth                     | 24 turns/prompt        | Deep chains exist but log stays manageable                |
| Sessions with model switching         | 7%                     | Tag entries with model; per-model branches unnecessary    |
| Log.md est. (20 turns, with thinking) | ~10k chars (~2.5k tok) | Well within context limits                                |
| Log.md est. (50 turns, with thinking) | ~25k chars (~6k tok)   | Still comfortable                                         |
| Cache efficiency                      | 95% median             | Adding GCC context injection has negligible cost impact   |
| Median session duration               | 13 min                 | Sessions are short; cross-session memory matters          |
| Mean session duration                 | 97 min                 | Some sessions are long; within-session commits matter too |

---

## 12. Package Structure

```
pi-gcc/
├── package.json
├── extensions/
│   └── gcc.ts              # Main extension: tools + hooks
├── skills/
│   └── gcc/
│       ├── SKILL.md        # Cognitive instructions
│       ├── scripts/
│       │   └── gcc-init.sh # One-time project initialization script
│       └── templates/
│           ├── agents-md.md            # Template for .gcc/AGENTS.md content
│           └── root-agents-section.md  # Template for root AGENTS.md section
├── tests/
│   └── gcc.test.ts
└── README.md
```

Installable via:

```bash
pi install npm:pi-gcc
# or
pi install git:github.com/<user>/pi-gcc
```

---

## 13. Out of Scope (v1)

- Semantic search over GCC memory (could integrate with AutoMem in future)
- Subagent GCC branches (subagents contribute through tool results)
- Automatic commit suggestions (agent decides; skill guides judgment)
- GCC diff/blame (version history is in commits.md, not per-line tracking)
- Remote GCC sync beyond git push/pull of `.gcc/` directory
- GUI/TUI visualization of GCC branch history
- Session-to-branch tracking in `state.yaml` (informational; no tool depends on it)

---

## 14. Open Questions

1. **Commit hash format.** Short random hex (like `a1b2c3d4`) or sequential numbering? Hashes feel more git-like but sequential is simpler for "show me commit 5."

2. **Log.md archival on commit.** Should cleared log entries be appended to an archive file (`.gcc/branches/<name>/log-archive.md`) or discarded entirely? Archive preserves drill-down capability but grows unboundedly.

3. **gcc_commit two-step flow.** The commit process is inherently two-step: (1) extension provides log.md to agent, (2) agent provides commit entry. Should this be two tool calls, or one tool call that returns log.md and expects a structured response?

4. **Root AGENTS.md update frequency.** Update after every commit (always current but noisy diffs), or only after merges and major roadmap changes?

5. **`.gcc/` in `.gitignore`?** Default should probably be tracked (enables collaboration), but some users may want private memory. Need a clear recommendation.

---

## Appendix A: Reference Prompts for Commit Writing

These instructions are embedded in the GCC skill to guide the agent when writing each block of a commit entry. They are adapted from hierarchical summarization patterns used in production session-tracking systems.

The agent writes all three blocks during `gcc_commit`. The skill should include these instructions (or a refined version) so the agent understands what each block demands.

### A.1 "This Commit's Contribution" Block

This is the most concrete block — what just happened.

```markdown
You are writing the "This Commit's Contribution" section of a GCC memory commit.
You will receive the OTA log (Observation-Thought-Action trace) since the last commit.

Guidelines:

- Describe what was learned, decided, or understood — not what was typed.
- Use action-oriented language: "Determined X", "Ruled out Y", "Chose Z because..."
- Include concrete anchors (file names, function names, error messages) when they
  support the reasoning, but don't catalog every file touched.
- If the work continues prior work, dedicate one bullet to the relationship.
- Capture negative results: "Attempted X, abandoned because Y" is valuable memory.
- 3-7 concise bullets. Each bullet should stand alone as a retrievable fact.

Focus on decisions and rationale, not implementation mechanics.
The codebase has git for tracking what changed. GCC tracks why.
```

### A.2 "Previous Progress Summary" Block — Rolling Compression

This is the critical compression step. The agent re-synthesizes all prior branch history into a fresh summary each commit.

```markdown
You are writing the "Previous Progress Summary" section of a GCC memory commit.
You will receive two inputs:

1. The "Previous Progress Summary" from the last commit (the compressed history so far)
2. The "This Commit's Contribution" from the last commit (what was just accomplished)

Your task: synthesize these into a single updated summary that captures the full
branch history up to (but not including) the current commit.

Rules:

- The result must be self-contained. A new agent reading ONLY this summary should
  understand the full arc of work on this branch.
- Highlight key accomplishments, not each individual step.
- Preserve important decisions and their rationale — these are the hardest to
  reconstruct later.
- If the branch involves multiple unrelated tasks, focus on the most significant.
- Compress aggressively but never drop a decision or its reasoning.
- 2-5 sentences for short histories, up to a paragraph for long-running branches.

This is hierarchical compression: each commit's summary absorbs the previous one,
so the chain never needs to be replayed in full. The latest commit always contains
the complete compressed history.
```

### A.3 "Branch Purpose" Block

Usually inherited from `gcc_branch` and rarely changes, but the agent can refine it.

```markdown
Restate or refine the purpose of this branch in 1-2 sentences.
What question is being explored? What goal is being pursued?
If the purpose has shifted since the branch was created, update it here
and note what changed.
```

### A.4 Roadmap Update (`main.md`)

When the agent updates `main.md` after a commit or merge, it performs the highest-level compression — synthesizing branch-level outcomes into a project-level view.

```markdown
You are updating the project roadmap (main.md) after a commit or merge.

This file is the single highest-level view of the project. A new agent reading
only main.md should understand:

- What the project is trying to accomplish
- What has been accomplished so far (key milestones, not individual commits)
- What remains to be done and current priorities
- Important decisions and their rationale

Rules:

- Update milestones: mark completed work, add newly discovered tasks.
- If a branch was merged, summarize its outcome and impact on the roadmap.
- If a branch was abandoned, note what was learned and why it was dropped.
- Keep the document concise. This is a roadmap, not a changelog.
- Preserve the "Important decisions" section — append new decisions, never
  remove old ones unless they've been superseded (note the supersession).
```

### A.5 Merge Synthesis

When the agent calls `gcc_merge`, it must synthesize a branch's conclusions back into the current line of thinking.

```markdown
You are writing a merge synthesis for a GCC branch merge.
You will receive:

1. The source branch's latest commit (which contains its full rolling summary)
2. The current branch's latest commit (your current context)

Your task: write a synthesis that explains:

- What the source branch explored and concluded
- What is being kept vs. discarded, and why
- How the merged conclusions affect the current branch's direction

Rules:

- Include negative results. "Branch X explored Y and determined it was
  unsuitable because Z" is valuable memory that prevents re-exploration.
- Be specific about what changes in the current branch's approach as a result.
- If the merge introduces no changes (exploration confirmed current approach),
  say so explicitly — that confirmation is itself a useful decision record.
```

### A.6 Reference: Aline's Summarization Hierarchy

These prompts are informed by the hierarchical summarization pipeline in [Aline](https://github.com/theworldofagents/GCC) (the production system by the GCC paper's author). Aline uses out-of-band LLM calls at four tiers to compress agent activity. GCC adapts these patterns for agent-inline use:

| Aline Tier       | Input                                                  | Output                                                | GCC Equivalent                                  |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------- |
| Turn → Title     | User message (≤4k chars) + assistant recap (≤8k chars) | Imperative title (25-80 chars) + status + 3-7 bullets | "This Commit's Contribution" block              |
| Turns → Session  | Array of `{turn_number, title, summary, user_request}` | Session title (80 chars) + 2-5 sentence summary       | "Previous Progress Summary" rolling compression |
| Sessions → Event | Array of `{session_number, title, summary, type}`      | Event title (100 chars) + 3-6 sentence description    | `main.md` roadmap update                        |
| Sessions → Agent | Same as event tier, scoped to one agent                | Agent title + description                             | Not applicable (team-facing identity)           |

Key differences from Aline's approach:

- **Agent-inline vs. out-of-band.** Aline runs summarization in a background worker daemon. GCC has the agent write its own summaries during the commit, with full reasoning context.
- **Rolling vs. batch.** Aline regenerates session summaries from scratch each time. GCC's rolling summary compresses incrementally — each commit absorbs the previous summary, so the chain never replays.
- **Decisions vs. activity.** Aline's prompts optimize for "what happened" (action-oriented titles, status lines). GCC's prompts optimize for "why it happened" (decisions, rationale, negative results).
