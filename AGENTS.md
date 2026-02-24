# AGENTS.md — pi-gcc

Agent guide for this repository.

## 1) Project Snapshot

| Item            | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Project         | `pi-gcc`                                                    |
| Type            | pi coding-agent extension                                   |
| Language        | TypeScript (ESM)                                            |
| Package manager | `pnpm`                                                      |
| Entry point     | `src/index.ts`                                              |
| Core feature    | GCC (Git Context Controller) memory tools + lifecycle hooks |

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
| Manual extension run | `pi -e ./src/index.ts`                |

## 4) Repository Map

| Path                                                | Purpose                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/index.ts`                                      | Registers GCC tools and extension hooks                                       |
| `src/gcc-*.ts`                                      | Tool implementations (`context`, `branch`, `switch`, `commit`, `merge`)       |
| `src/ota-logger.ts`                                 | Converts `turn_end` event into OTA input                                      |
| `src/commit-flow.ts`                                | Manages pending commit and `agent_end` extraction                             |
| `src/branches.ts`                                   | `.gcc/branches/*` file operations                                             |
| `src/state.ts`                                      | `.gcc/state.yaml` state + session tracking                                    |
| `src/yaml.ts`                                       | Minimal YAML parser/serializer (scalars, nested maps, top-level object lists) |
| `skills/gcc/SKILL.md`                               | Agent usage guidance for GCC                                                  |
| `skills/gcc/scripts/gcc-init.sh`                    | One-time GCC initialization script                                            |
| `docs/specs/GCC-SPEC-USE-THIS-ONE.md`               | Canonical product specification                                               |
| `docs/specs/fix-specs-diff.md`                      | Spec-vs-runtime reconciliation notes + approved divergences                   |
| `docs/plans/2026-02-23-spec-sync-implementation.md` | Spec sync implementation plan                                                 |

## 5) Runtime Design Facts (Do Not Break)

1. `gcc_commit` is a **2-step flow**:
   - tool call returns preparation/log prompt,
   - `agent_end` finalizes commit from assistant response.
2. There is **no per-turn context injection hook**. Orientation is explicit via `gcc_context` and `read`.
3. OTA logging happens in `turn_end` and appends to active branch `log.md`.
4. `session_start` registers the current session file in `.gcc/state.yaml` when available.
5. `resources_discover` returns GCC skill path using ESM-safe path resolution (`import.meta.url`).
6. `session_before_compact` is best-effort (mutates `event.customInstructions` in place).

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

- `.gcc/state.yaml`
- `.gcc/branches/<branch>/log.md`
- `.gcc/branches/<branch>/commits.md`
- root `AGENTS.md` static GCC section (created at init; no runtime milestone updates)

## 9) Ask Before You Do These

- Adding dependencies
- Changing lint/tooling configuration
- Registering tools that execute shell commands
- Altering GCC file format contract (`.gcc` structure, commit block headings)

## 10) Never Do These

- Commit secrets
- Remove tests to make CI pass
- Weaken or bypass checks
- Rename commit block headings (`### Branch Purpose`, `### Previous Progress Summary`, `### This Commit's Contribution`)
