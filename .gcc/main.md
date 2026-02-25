# pi-gcc — Project Roadmap

## Purpose

pi-gcc gives pi coding agents versioned memory via a `.gcc/` directory. Agents commit decisions and rationale (not code diffs), branch for explorations, and merge conclusions — preserving reasoning across sessions, compactions, and model switches.

## Current State (2026-02-25)

**v0.1.0 published.** Core tooling is feature-complete and spec-aligned:

- 5 tools: `gcc_context`, `gcc_branch`, `gcc_switch`, `gcc_commit`, `gcc_merge`
- Lifecycle hooks: `turn_end` (OTA logging), `session_start` (registration), `session_before_compact` (awareness note)
- Subagent-based commit distillation (canonical spec flow, replaced earlier 2-step flow)
- Cache-safe design: static root AGENTS.md, no per-turn injection, fixed tool definitions
- Lazy state initialization — tools work immediately after mid-session `.gcc/` creation
- 99 tests passing, all checks green

## Key Decisions Made

- **Subagent commit distillation over 2-step flow** — main agent may be near context limit; subagent reads log.md in fresh context. Initially shipped with 2-step flow, later migrated to canonical subagent approach.
- **Static root AGENTS.md** — written once at init, never updated. Preserves prompt cache stability (95% median cache efficiency from empirical data).
- **No `before_agent_start` injection** — agent retrieves context on demand via `gcc_context` and `read`. Cache-safe by design.
- **Track `.gcc/` in git except `log.md`** — enables cross-agent collaboration; transient logs are working state.
- **Lazy state initialization** — tools re-check for `.gcc/` on each call if not yet loaded, so mid-session init just works. Principle: fix the code, not just the docs.
- **Minimal YAML parser** — custom `src/yaml.ts` avoids external dependency for `state.yaml` and `metadata.yaml` operations.

## Milestones

### Completed

- [x] Core extension with all 5 tools
- [x] OTA logging via `turn_end` hook
- [x] Session registration and branch tracking in `state.yaml`
- [x] Init script (`gcc-init.sh`) with idempotent setup
- [x] Skill file for agent cognitive guidance
- [x] Spec reconciliation (cache-safe alignment, removed dynamic AGENTS.md updates)
- [x] Subagent-based commit distillation
- [x] npm publish preparation (metadata, peer deps, LICENSE, .npmrc)
- [x] Lazy state initialization (mid-session init works without restart)
- [x] Skill refinements from first brownfield run (init path, greenfield/brownfield, post-init checklist)

### Planned / Open

- [ ] Real-world usage feedback and iteration
- [ ] README alignment (still references old 2-step flow in "Common problems" section)
- [ ] Semantic search over GCC memory (future: vector search over commits/logs)
- [ ] Subagent GCC branches (subagents contributing through their own branches)
- [ ] GCC visualization (TUI/GUI branch history)

## Architecture Notes

- **Flat `src/` layout** — no nested directories. Tool implementations in `gcc-*.ts`, helpers in dedicated modules.
- **Extension + Skill separation** — extension handles mechanics (file I/O, hooks); skill teaches judgment (when to commit, how to write good memory).
- **ESM-safe path resolution** — uses `import.meta.url` for skill path discovery via `resources_discover`.
