<p align="center">
  <img src="./banner.png" alt="pi-brain banner" width="720" />
</p>

# pi-brain

Versioned memory for the [pi coding agent](https://github.com/badlogic/pi-mono). Agents commit decisions and reasoning to a `.memory/` directory, preserving context across sessions, compactions, and model switches.

Credit: This project is my implementation for Pi of this paper [Git Context Controller: Manage the Context of LLM-based Agents like Git](https://arxiv.org/html/2508.00031v1) 

## Getting Started

```bash
pi install npm:pi-brain
```

Open pi in any project and say "initialize Brain" (or run `/skill:brain`). The agent creates `.memory/` and starts remembering.

That's it. The agent decides when to commit, branch, and merge — you don't **need** to manage anything. However, you can always prompt the agent to remember something specific if you'd like. 

## How It Works

Brain adds five tools and a few lifecycle hooks to pi. The design is simple: the agent works normally, and Brain records what happens in the background.

**Every turn**, Brain appends a structured log entry to `.memory/branches/<branch>/log.md`. This happens automatically via the `turn_end` hook — the agent doesn't call anything.

**When the agent reaches a milestone**, it calls `memory_commit` with a short summary. Brain spawns a subagent in a fresh context window that reads the raw log, distills it into a structured commit (decisions, rationale, what was tried and rejected), and appends it to `commits.md`. The log is then cleared.

**Each commit is self-contained.** It includes a rolling summary of all prior commits, so the latest commit always tells the full branch story. A new session can read one commit and know everything.

**Branching and merging** work like you'd expect. The agent branches to explore alternatives without contaminating the main line, then merges conclusions back with a synthesis.

### The Five Tools

| Tool            | What it does                                                     |
| --------------- | ---------------------------------------------------------------- |
| `memory_status` | Quick status overview — active branch, latest commit, turn count |
| `memory_commit` | Checkpoint a milestone (subagent distills the log)               |
| `memory_branch` | Create a branch for exploration                                  |
| `memory_switch` | Switch between branches                                          |
| `memory_merge`  | Merge insights from one branch into another                      |

For deep retrieval, the agent uses pi's built-in `read` tool on `.memory/` files directly. No special API needed.

## Prompt Cache Safety

LLM providers cache the prefix of each request. If the prefix changes between turns, the cache misses and you pay full latency and cost. Many memory systems break this by injecting dynamic state into the system prompt.

Brain avoids this entirely:

- **Static AGENTS.md** — Written once at init, never updated. No branch names, no commit counts, no dynamic state. The system prompt prefix stays identical across every turn and session.
- **No per-turn injection** — No `before_agent_start` hook, no changing content before the conversation. The agent retrieves memory on demand via tool calls, which appear as conversation messages appended at the end (outside the cached prefix).
- **Fixed tool definitions** — All five tools are registered at startup with static schemas. No tools added or removed mid-conversation.
- **Subagent isolation** — Commit distillation runs in a separate API call with its own cache. The main agent's cache is never touched.

The result: Brain adds zero overhead to your prompt cache hit rate.

## What Gets Created

```
.memory/
├── AGENTS.md                      # Protocol reference
├── main.md                        # Project roadmap (agent-authored)
├── state.yaml                     # Active branch, session tracking
└── branches/
    └── main/
        ├── commits.md             # Distilled milestone snapshots
        ├── log.md                 # Raw turn log (gitignored)
        └── metadata.yaml          # Structured context
```

Everything in `.memory/` is tracked in git except `log.md` (transient working state). This means memory is shared across machines and team members.

## Install Options

```bash
# From npm (recommended)
pi install npm:pi-brain

# From git (latest)
pi install git:github.com/Whamp/pi-brain

# Pinned version (npm)
pi install npm:pi-brain@0.1.0

# Pinned version (git)
pi install git:github.com/Whamp/pi-brain@v0.1.0

# Project-local (shared via .pi/settings.json)
pi install -l npm:pi-brain

# Try without installing
pi -e npm:pi-brain
```

## Development

```bash
git clone https://github.com/Whamp/pi-brain.git
cd pi-brain
pnpm install --prod=false
pnpm run check               # lint + typecheck + format + tests + deadcode + secrets

pi -e ./src/index.ts          # run pi with extension loaded from source
```

| Command            | Purpose         |
| ------------------ | --------------- |
| `pnpm run check`   | Full validation |
| `pnpm run test`    | Tests only      |
| `pnpm run release` | Bump, tag, push |

## License

MIT
