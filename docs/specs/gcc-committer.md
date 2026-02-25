# gcc-committer Subagent Specification

## Overview

The gcc-committer is a lightweight subagent that distills raw OTA logs into structured GCC commit entries. It replaces the previous 2-step commit flow where the main agent was hijacked to write commit blocks, and an `agent_end` hook extracted them from the response.

The subagent operates as a pure text-in/text-out summarizer. It reads `.gcc/` files using read-only tools, produces the three-block commit entry as its text response, and returns control to the calling extension. All file mutations (appending to `commits.md`, clearing `log.md`, updating `state.yaml`) remain the extension's responsibility.

## Motivation

### Problems with the 2-step flow

1. **Turn hijacking.** `gcc_commit` returned a prompt to the main agent, expecting it to write the commit blocks in its next response. This consumed a full agent turn for bookkeeping.
2. **Fragile extraction.** The `agent_end` hook parsed the main agent's free-form response for `### Branch Purpose`, `### Previous Progress Summary`, and `### This Commit's Contribution` headings. If the agent deviated from the format, the commit silently failed.
3. **Context budget waste.** The main agent may be deep in its context window. Feeding it the full OTA log for distillation consumes context that should be used for real work.
4. **Inconsistent quality.** The main agent's system prompt isn't optimized for commit distillation. Commit quality varied based on model, context pressure, and how much the agent cared about the meta-task.

### Why a subagent

- **Fresh context.** The subagent operates in its own context window. The log.md _is_ the context — it contains the agent's full reasoning. The subagent doesn't need the main agent's conversation history.
- **Dedicated prompt.** The subagent's system prompt is optimized for one task: reading logs and producing structured commits.
- **Cheap model.** Summarization doesn't require frontier intelligence. A fast, cheap model produces good commits.
- **Single-step tool call.** The main agent calls `gcc_commit`, gets back "done." No turn hijacking.

## Agent Definition

```
.pi/agents/gcc-committer.md
```

```yaml
---
name: gcc-committer
description: Distills OTA logs into structured GCC commit entries
tools: read, grep, find, ls
model: google-antigravity/gemini-3-flash
skills: gcc
extensions:
---
```

### Configuration

| Field        | Value                               | Rationale                                                             |
| ------------ | ----------------------------------- | --------------------------------------------------------------------- |
| `tools`      | `read, grep, find, ls`              | Read-only access to `.gcc/` files. No write, edit, or bash.           |
| `model`      | `google-antigravity/gemini-3-flash` | Cheap and fast. Distillation doesn't need frontier reasoning.         |
| `skills`     | `gcc`                               | Loads the GCC skill for protocol context.                             |
| `extensions` | _(empty)_                           | No extensions. Prevents tool leakage from other installed extensions. |

## Invocation

The `gcc_commit` tool handler in the extension spawns the subagent via pi-subagents' `runSync` mechanism, which calls `pi --mode json -p "Task: ..."`.

### Task format

The extension constructs the task string with:

```
Distill a GCC commit for branch "<branch>".
Summary: <agent-provided summary>

Read these files:
- .gcc/AGENTS.md (protocol reference — read first)
- .gcc/branches/<branch>/log.md (OTA trace to distill)
- .gcc/branches/<branch>/commits.md (previous commits for rolling summary)

Produce the three commit blocks.
```

The subagent reads the files itself rather than receiving their content inline. This avoids task-size limits and lets the subagent navigate the files naturally.

### Response capture

The subagent's text response (its final assistant message) is captured via pi's `--mode json` stdout event stream. The extension extracts the commit blocks from this text using the same `extractCommitBlocks` parser.

## Subagent Behavior

### Step 1: Read protocol reference

Read `.gcc/AGENTS.md` to understand the commit format and conventions.

### Step 2: Read source material

- Read `.gcc/branches/<branch>/log.md` — the raw OTA trace since last commit
- Read `.gcc/branches/<branch>/commits.md` — previous commits (latest entry provides the rolling summary to extend)

### Step 3: Produce commit blocks

Respond with exactly three markdown blocks:

```markdown
### Branch Purpose

1-2 sentences restating or refining what this branch is for.

### Previous Progress Summary

A single self-contained rolling summary synthesizing ALL prior commits.
A new reader should understand the full branch history from this alone.
If no previous commit exists: "Initial commit."

### This Commit's Contribution

3-7 concise bullets: decisions, rationale, negative results, key findings.
```

No other text outside these blocks.

### Content guidelines

- **Decisions over descriptions.** "Chose PostgreSQL over MongoDB because ACID compliance is required" not "Chose database."
- **Negative results matter.** "Tried approach X, abandoned because Y" is valuable.
- **Rolling summary is self-contained.** It replaces (not appends to) the previous summary. The latest commit entry always contains the full compressed branch history.
- **No implementation details.** The code captures "what." The commit captures "why."

## Extension Integration

### Current flow (to be replaced)

```
gcc_commit tool → returns prompt to main agent
                → main agent writes commit blocks in next response
                → agent_end hook extracts blocks → finalizeGccCommit()
```

Components involved:

- `CommitFlowManager` class (manages pending commit state)
- `agent_end` hook (extracts commit blocks from main agent response)
- `extractCommitBlocks` parser (fragile heading-based text extraction)

### New flow

```
gcc_commit tool → spawns gcc-committer subagent
               → subagent reads .gcc/ files
               → subagent responds with commit blocks
               → extension captures response → finalizeGccCommit()
```

### What is eliminated

| Component                         | File                 | Status            |
| --------------------------------- | -------------------- | ----------------- |
| `CommitFlowManager`               | `src/commit-flow.ts` | Delete entirely   |
| `agent_end` hook (commit portion) | `src/index.ts`       | Remove            |
| `setPendingCommit` / `hasPending` | `src/commit-flow.ts` | Delete with class |

### What is preserved

| Component               | Purpose                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `finalizeGccCommit()`   | Appends formatted entry to `commits.md`, clears `log.md`, updates `state.yaml`                 |
| `extractCommitBlocks()` | Parses the three-block structure from subagent response text                                   |
| `executeGccCommit()`    | Refactored: no longer returns prompt to agent; instead builds the task string for the subagent |

### What changes in `gcc_commit` handler

The tool handler becomes async with subagent invocation:

1. Build task string with branch name, summary, and file paths
2. Spawn `gcc-committer` subagent via `runSync` or direct `pi` CLI spawn
3. Capture subagent text response
4. Extract commit blocks from response
5. Call `finalizeGccCommit` (same as before)
6. Return success message to the main agent

### Error handling

| Condition                               | Behavior                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Empty log (no OTA entries)              | Proceed anyway — agent may have meaningful progress to record                                       |
| Subagent fails to start                 | Return error to main agent: "Commit failed: subagent spawn error"                                   |
| Subagent response missing commit blocks | Return error to main agent: "Commit failed: could not extract commit blocks from subagent response" |
| Subagent times out                      | Return error with timeout message                                                                   |

## Open Questions

1. **Integration path.** Import `runSync` from `pi-subagents` directly, or shell out to `pi` via `child_process.spawn`? The former is cleaner but creates a dependency on the pi-subagents package. The latter is self-contained but reimplements spawn logic.
2. **Timeout.** What timeout is appropriate for the subagent? Large logs may take longer to distill. Suggest 60 seconds default.
3. **Model override.** Should the gcc-committer model be configurable via `.gcc/state.yaml` or extension config, or is it fixed in the agent definition?
