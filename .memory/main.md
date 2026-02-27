# pi-brain — Project Roadmap

## Purpose

pi-brain gives pi coding agents versioned memory via a `.memory/` directory. Agents commit decisions and rationale (not code diffs), branch for explorations, and merge conclusions — preserving reasoning across sessions, compactions, and model switches.

## Current State (2026-02-27)

**v0.1.0 published (as pi-gcc). Renamed to pi-brain.** Core tooling is feature-complete:

- 5 tools: `memory_status`, `memory_branch`, `memory_switch`, `memory_commit`, `memory_merge`
- Lifecycle hooks: `turn_end` (OTA logging), `session_start` (registration), `session_before_compact` (awareness note)
- Subagent-based commit distillation (canonical spec flow, replaced earlier 2-step flow)
- Cache-safe design: static root AGENTS.md, no per-turn injection, fixed tool definitions
- Lazy state initialization — tools work immediately after mid-session `.memory/` creation
- Log size warning at 600 KB — nudges agent to commit before subagent context overflow
- 138 tests passing, all checks green

## Key Decisions Made

- **Renamed from pi-gcc to pi-brain** — GCC collides with GNU Compiler Collection. Package = pi-brain (what it IS), tools = memory\_\* (what you DO), directory = .memory/ (where it LIVES).
- **Subagent commit distillation over 2-step flow** — main agent may be near context limit; subagent reads log.md in fresh context.
- **Static root AGENTS.md** — written once at init, never updated. Preserves prompt cache stability.
- **No `before_agent_start` injection** — agent retrieves context on demand via `memory_status` and `read`. Cache-safe by design.
- **Track `.memory/` in git except `log.md`** — enables cross-agent collaboration; transient logs are working state.
- **Lazy state initialization** — tools re-check for `.memory/` on each call if not yet loaded, so mid-session init just works.
- **Log size threshold (600 KB)** — approximately 150-175k tokens. Extension warns in `session_start` and `memory_status` when log.md is large.
- **Minimal YAML parser** — custom `src/yaml.ts` avoids external dependency for `state.yaml` and `metadata.yaml` operations.

## Milestones

### Completed

- [x] Core extension with all 5 tools
- [x] OTA logging via `turn_end` hook
- [x] Session registration and branch tracking in `state.yaml`
- [x] Init script (`brain-init.sh`) with idempotent setup
- [x] Skill file for agent cognitive guidance
- [x] Spec reconciliation (cache-safe alignment, removed dynamic AGENTS.md updates)
- [x] Subagent-based commit distillation
- [x] npm publish preparation (metadata, peer deps, LICENSE, .npmrc)
- [x] Lazy state initialization (mid-session init works without restart)
- [x] Log size warning at 600 KB threshold (strategic forgetting nudge)
- [x] Rename from pi-gcc to pi-brain (package, tools, directory, skill)

### Planned / Open

- [ ] Real-world usage feedback and iteration
- [ ] Semantic search over memory (future: vector search over commits/logs)
- [ ] Subagent memory branches (subagents contributing through their own branches)
- [ ] Memory visualization (TUI/GUI branch history)

## Architecture Notes

- **Flat `src/` layout** — no nested directories. Tool implementations in `memory-*.ts`, helpers in dedicated modules.
- **Extension + Skill separation** — extension handles mechanics (file I/O, hooks); skill teaches judgment (when to commit, how to write good memory).
- **ESM-safe path resolution** — uses `import.meta.url` for skill path discovery via `resources_discover`.
