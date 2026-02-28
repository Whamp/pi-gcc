# Brain — Agent Memory

This directory contains your project's agent memory, managed by the Brain extension.

## Tools

| Tool            | Purpose                                   |
| --------------- | ----------------------------------------- |
| `memory_commit` | Checkpoint a milestone in understanding   |
| `memory_branch` | Manage branches: create, switch, or merge |

### memory_branch Actions

| Action   | Required Params       | Description                                 |
| -------- | --------------------- | ------------------------------------------- |
| `create` | `name`, `purpose`     | Create a new branch and switch to it        |
| `switch` | `branch`              | Switch active memory branch                 |
| `merge`  | `branch`, `synthesis` | Synthesize a branch's insights into current |

## File Structure

```
.memory/
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
- **Status is automatic**: Memory status is injected at session start and appended to tool results
