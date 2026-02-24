# GCC — Git Context Controller

Use when working on a project with GCC (Git Context Controller) memory management.
Guides the agent on when to commit memory milestones, when to branch for exploratory
thinking, how to write effective memory entries, and how to use multi-resolution
context retrieval.

## Initialization

To initialize GCC in a project, run the init script using the absolute path derived
from this skill's location:

```bash
bash "$(dirname "/path/to/this/SKILL.md")/scripts/gcc-init.sh"
```

After the script runs, author `.gcc/main.md` — the project roadmap — based on your
current understanding of the project's goals, milestones, and priorities.

## When to Commit

- You've reached a stable understanding or decision
- You've completed an exploration and have a conclusion
- You're about to change direction significantly
- A meaningful amount of work has accumulated (use judgment, not a fixed interval)
- Before ending a session if significant progress was made

## How to Write Good Commits

- Focus on decisions and rationale, not implementation details
- Capture "why" more than "what" — the code captures "what"
- The rolling progress summary must be self-contained — a new agent reading only
  the latest commit should understand the full branch history
- Be specific: "Chose PostgreSQL over MongoDB because ACID compliance is required
  for financial transactions" not "Chose database"

### Commit Blocks

Each `gcc_commit` produces three blocks:

1. **Branch Purpose** — Restate or refine the purpose of this branch (1-2 sentences)
2. **Previous Progress Summary** — Rolling compression of all prior commits.
   Synthesize the previous summary with the last commit's contribution into a
   single self-contained summary.
3. **This Commit's Contribution** — What was just learned, decided, or understood.
   3-7 concise bullets. Focus on decisions, rationale, and negative results.

## When to Branch

- You want to explore an alternative approach without contaminating current thinking
- You're prototyping something uncertain
- You want to compare two design hypotheses

## When to Merge

- A branch has reached a conclusion (positive or negative)
- The branch's findings should inform the main line of thinking
- Include what was learned even if the approach was abandoned

**Important:** Always review the source branch history BEFORE calling `gcc_merge`.
Use:

- `gcc_context` for high-level status
- `read .gcc/branches/<target>/commits.md` for full branch history

You need the full context to write a good synthesis.

## When to Use Context Retrieval

- Starting a new session on an existing project — call `gcc_context` first
- Before making a decision that might conflict with earlier reasoning
- When you need to recall the rationale behind a previous decision

## Context Retrieval

Use `gcc_context` for high-level status only.

For deep retrieval, use `read` directly:

- `read .gcc/branches/<name>/commits.md` — full branch history
- `read .gcc/branches/<name>/log.md` — OTA trace since last commit
- `read .gcc/branches/<name>/metadata.yaml` — structured metadata
- `read .gcc/main.md` — project roadmap
- `read .gcc/AGENTS.md` — full protocol reference
