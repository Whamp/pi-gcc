# AGENTS.md — pi-brain

Agent guide for this repository.

## 1) Project Snapshot

| Item            | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Project         | `pi-brain`                                             |
| Type            | pi coding-agent extension                              |
| Language        | TypeScript (ESM)                                       |
| Package manager | `pnpm`                                                 |
| Entry point     | `src/index.ts`                                         |
| Core feature    | Brain (versioned agent memory) tools + lifecycle hooks |

## 2) Non-Negotiable Rules

1. **TDD first.** Write/adjust tests before implementation.
2. **Keep `src/` flat.** Do not create nested `src/tools` or `src/hooks` directories.
3. **Shared exported types live in `src/types.ts`.**
4. **No `any` types.**
5. **Do not disable lint rules.**
6. **Run verification before committing:** `pnpm run check`.
7. **When stuck, use 1-3-1:** 1 problem, 3 options, 1 recommendation. Wait for user confirmation.

## 3) Commands You Should Use

| Goal                 | Command                               |
| -------------------- | ------------------------------------- |
| Full validation      | `pnpm run check`                      |
| Tests only           | `pnpm run test`                       |
| Single test file     | `pnpm run test -- src/<file>.test.ts` |
| Type check           | `pnpm run typecheck`                  |
| Lint                 | `pnpm run lint`                       |
| Format               | `pnpm run format`                     |
| Release new version  | `pnpm run release`                    |
| Manual extension run | `pi -e ./src/index.ts`                |

## 4) Repository Map

| Path                                                | Purpose                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/index.ts`                                      | Registers memory tools and extension hooks                                    |
| `src/memory-*.ts`                                   | Tool implementations (`status`, `branch`, `switch`, `commit`, `merge`)        |
| `src/constants.ts`                                  | Shared constants (`LOG_SIZE_WARNING_BYTES`)                                   |
| `src/subagent.ts`                                   | Commit distillation subagent spawner and output parser                        |
| `src/ota-logger.ts`                                 | Converts `turn_end` event into OTA input                                      |
| `src/branches.ts`                                   | `.memory/branches/*` file operations                                          |
| `src/state.ts`                                      | `.memory/state.yaml` state + session tracking                                 |
| `src/yaml.ts`                                       | Minimal YAML parser/serializer (scalars, nested maps, top-level object lists) |
| `skills/brain/SKILL.md`                             | Agent usage guidance for Brain                                                |
| `skills/brain/scripts/brain-init.sh`                | One-time Brain initialization script                                          |
| `docs/specs/GCC-SPEC-USE-THIS-ONE.md`               | Canonical product specification (historical, uses old naming)                 |
| `docs/specs/fix-specs-diff.md`                      | Spec-vs-runtime reconciliation notes + approved divergences                   |
| `docs/plans/2026-02-23-spec-sync-implementation.md` | Spec sync implementation plan                                                 |
| `CHANGELOG.md`                                      | Auto-generated changelog (managed by changelogen)                             |

## 5) Runtime Design Facts (Do Not Break)

1. `memory_commit` spawns a **subagent** for commit distillation:
   - The subagent reads `log.md` and the latest commit in a fresh context window.
   - The extension appends the result to `commits.md` and clears `log.md`.
2. There is **no per-turn context injection hook**. Orientation is explicit via `memory_status` and `read`.
3. OTA logging happens in `turn_end` and appends to active branch `log.md`.
4. **Lazy state loading**: tools re-check for `.memory/` on each call if not yet loaded, so mid-session initialization works without restart.
5. `session_start` registers the current session file in `.memory/state.yaml`, and `memory_branch`/`memory_switch` keep that session's `branch` mapping in sync.
6. **Log size warning**: when `log.md` exceeds 600 KB (~150-175k tokens), the extension warns in `session_start` and `memory_status` output, nudging the agent to commit.
7. `resources_discover` returns Brain skill path using ESM-safe path resolution (`import.meta.url`).
8. `session_before_compact` is best-effort (mutates `event.customInstructions` in place).

## 6) Coding Constraints Specific to This Repo

- Prefer small pure helpers above exported functions (avoid use-before-define lint issues).
- Use runtime guards for union event payloads (`AgentMessage.content` may be non-array/custom).
- Tool handlers must return `AgentToolResult` shape:
  - `content: [{ type: "text", text: "..." }]`
  - `details: {}`

## 7) Verification Workflow for Changes

Before commit:

1. Run targeted tests for changed files.
2. Run full test suite: `pnpm run test`.
3. Run full checks: `pnpm run check`.
4. If anything fails, fix before commit.

## 8) Manual Validation Expectations

When validating extension behavior manually:

- Interactive mode: `pi -e ./src/index.ts`
- Non-UI mode (`-p` / `--mode json`): validate using filesystem and emitted events, not only UI notifications.

Key artifacts to verify:

- `.memory/state.yaml`
- `.memory/branches/<branch>/log.md`
- `.memory/branches/<branch>/commits.md`
- root `AGENTS.md` static Brain section (created at init; no runtime milestone updates)

## 9) Ask Before You Do These

- Adding dependencies
- Changing lint/tooling configuration
- Registering tools that execute shell commands
- Altering memory file format contract (`.memory` structure, commit block headings)

## 10) Never Do These

- Commit secrets
- Remove tests to make CI pass
- Weaken or bypass checks
- Rename commit block headings (`### Branch Purpose`, `### Previous Progress Summary`, `### This Commit's Contribution`)

## Brain — Agent Memory

This project uses Brain for agent memory management.

**Start here when orienting:** Read `.memory/main.md` for the project roadmap, key decisions, and open problems.
Read `.memory/AGENTS.md` for the full Brain protocol reference.
Tools: memory_commit, memory_branch, memory_merge, memory_switch, memory_status
