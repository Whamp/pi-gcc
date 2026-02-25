# GCC — Git Context Controller

This directory contains your project's agent memory, managed by the GCC extension.

## Tools

| Tool          | Purpose                                 |
| ------------- | --------------------------------------- |
| `gcc_commit`  | Checkpoint a milestone in understanding |
| `gcc_branch`  | Create a memory branch for exploration  |
| `gcc_merge`   | Synthesize branch conclusions           |
| `gcc_context` | Multi-resolution retrieval of memory    |
| `gcc_switch`  | Switch active memory branch             |

## File Structure

```
.gcc/
├── AGENTS.md                    # This file — protocol reference
├── main.md                      # Project roadmap (agent-authored)
└── branches/
    └── <branch-name>/
        ├── commits.md           # Milestone memory snapshots
        ├── log.md               # OTA trace since last commit (auto)
        └── metadata.yaml        # Structured context
```

## Commit Format

Each commit in `commits.md` has three blocks:

- **Branch Purpose** — Why this branch exists
- **Previous Progress Summary** — Rolling compression of all prior commits
- **This Commit's Contribution** — What was just learned or decided

The latest commit always contains a self-contained summary of the full branch history.

## Conventions

- **Agent-driven**: You decide when to commit, branch, and merge
- **Decisions over details**: Capture "why", not "what" — git tracks file changes
- **Rolling summaries**: Each commit re-synthesizes all prior progress
- **No direct log.md writes**: The extension maintains log.md automatically
- **Call `gcc_context` first**: Always review context before merging or starting new work
