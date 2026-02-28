---
name: brain
description: Use when working on a project with Brain agent memory management. Triggers on memory_commit, memory_branch tool usage, or when the project has a .memory/ directory.
---

# Brain — Agent Memory

## Initialization

When the `<skill>` tag loads this file, it includes a `location` attribute with the
absolute path to this SKILL.md. Use that to derive the init script path:

```bash
bash "/absolute/path/to/skills/brain/scripts/brain-init.sh"
```

Replace `/absolute/path/to/skills/brain` with the skill directory shown in the
`<skill>` tag's `location` attribute (strip the `/SKILL.md` suffix).

### After Init

1. **Write `.memory/main.md`** — the project roadmap (see below).
2. **Make your first commit** when you reach a meaningful milestone.

> **Note:** No `/reload` is needed. The memory tools lazily detect `.memory/`
> on every call via `tryLoad()`.

### Writing main.md — Greenfield vs Brownfield

**New project (no existing code):** Write goals, intended architecture, and open
questions as you understand them from conversation with the user.

**Existing project:** Orient yourself first:

- Read `AGENTS.md`, `README.md`, `package.json` (or equivalent)
- Scan recent git history (`git log --oneline -20`)
- Read any specs or plans in `docs/`

Then write the roadmap covering: project purpose, current state, key decisions
already made, completed milestones, and planned work.

## Context Retrieval

Memory status is **automatically injected** at session start (via the
`before_agent_start` hook) and appended to every successful `memory_branch` and
`memory_commit` result. You do not need to call a separate tool to see status.

For deep retrieval, use `read` directly:

- `read .memory/branches/<name>/commits.md` — full branch history
- `read .memory/branches/<name>/log.md` — OTA trace since last commit
- `read .memory/branches/<name>/metadata.yaml` — structured metadata
- `read .memory/main.md` — project roadmap
- `read .memory/AGENTS.md` — full protocol reference

## When to Commit

- You've reached a stable understanding or decision
- You've completed an exploration and have a conclusion
- You're about to change direction significantly
- A meaningful amount of work has accumulated (use judgment, not a fixed interval)
- Before ending a session if significant progress was made
- **When the extension warns that log.md is large** — even mundane activity is
  worth distilling. A commit that records "routine maintenance, no significant
  decisions" tells future agents what was already explored.

## How to Write Good Commits

- Focus on decisions and rationale, not implementation details
- Capture "why" more than "what" — the code captures "what"
- Be specific: "Chose PostgreSQL over MongoDB because ACID compliance is required
  for financial transactions" not "Chose database"

A subagent handles commit distillation — it reads your `log.md` and prior commits,
then produces the structured commit entry. You just provide a good `summary` string.

## When to Branch

- You want to explore an alternative approach without contaminating current thinking
- You're prototyping something uncertain
- You want to compare two design hypotheses

## When to Merge

- A branch has reached a conclusion (positive or negative)
- The branch's findings should inform the main line of thinking
- Include what was learned even if the approach was abandoned

**Important:** Always review the source branch history BEFORE calling merge.
Use `read .memory/branches/<target>/commits.md` for full branch history.
You need the full context to write a good synthesis.
