# pi-brain

`pi-brain` is a **versioned memory extension** for the [pi coding agent](https://github.com/badlogic/pi-mono).

It gives an agent versioned memory in a `.memory/` folder, so it can keep context across sessions.

---

## Quick start

```bash
pi install git:github.com/Whamp/pi-brain
```

Then open pi in the project where you want memory and either ask it to
initialize Brain or run `/skill:brain`.

---

## Install options

```bash
# From git (latest)
pi install git:github.com/Whamp/pi-brain

# From git (pinned version)
pi install git:github.com/Whamp/pi-brain@v0.1.0

# Project-local (shared with team via .pi/settings.json)
pi install -l git:github.com/Whamp/pi-brain

# Try without installing
pi -e git:github.com/Whamp/pi-brain
```

### Local development

```bash
git clone https://github.com/Whamp/pi-brain.git
cd pi-brain
pnpm install --prod=false    # .npmrc omits dev deps by default
pnpm run check

# Run pi with the extension loaded from source
pi -e ./src/index.ts
```

---

## What this project does

It adds 5 tools to pi:

- `memory_status` — read a status overview (use `read` for deep file-level retrieval)
- `memory_branch` — create a memory branch
- `memory_switch` — switch memory branch
- `memory_commit` — checkpoint what the agent learned
- `memory_merge` — merge branch insights back into the active branch

It also uses hooks to:

- auto-log turns to `.memory/branches/<branch>/log.md`
- register/update session mapping in `.memory/state.yaml` (on `session_start` and branch changes via `memory_branch`/`memory_switch`)
- warn when `log.md` exceeds 600 KB (~150-175k tokens), nudging the agent to commit

---

## If you are a total novice: start here

### 1) Install requirements

You need:

- Node.js 20+
- pi CLI
- git

Check quickly:

```bash
node -v
pi --help
git --version
```

### 2) Install the extension

```bash
pi install git:github.com/Whamp/pi-brain
```

---

## Run the extension locally (development)

From the cloned repository root:

```bash
pi -e ./src/index.ts
```

This starts pi with the Brain extension loaded.

---

## Initialize Brain memory in a project

Inside pi, tell the agent to initialize Brain or run `/skill:brain`.
The agent loads the skill, resolves the init script path, and runs it.
No manual bash invocation needed.

The init script creates:

- `.memory/state.yaml`
- `.memory/branches/main/log.md`
- `.memory/branches/main/commits.md`
- `.memory/branches/main/metadata.yaml`
- `.memory/main.md`
- `.memory/AGENTS.md`
- static Brain section in root `AGENTS.md` (if missing)

---

## First-time workflow example

Inside pi (with extension loaded), try this order:

1. `memory_status` (no args) — see current memory state
2. `memory_branch` with name + purpose — create exploration branch
3. Do normal work (read/edit/test)
4. `memory_commit` with a summary — a subagent distills your log into a structured commit

---

## Development commands

| Goal                   | Command              |
| ---------------------- | -------------------- |
| Full validation        | `pnpm run check`     |
| Tests                  | `pnpm run test`      |
| Type check             | `pnpm run typecheck` |
| Lint                   | `pnpm run lint`      |
| Format                 | `pnpm run format`    |
| Auto-fix lint + format | `pnpm run fix`       |
| Release new version    | `pnpm run release`   |

---

## Common problems

### "Brain not initialized. Run brain-init.sh first."

You are in a project that does not have `.memory/` yet. Ask the agent to initialize Brain, or load the `brain` skill.

### I do not see notifications in print/json mode

That is expected. In non-UI mode, verify by checking files in `.memory/` and emitted events.

---

## Releasing

Uses [changelogen](https://github.com/unjs/changelogen) with conventional commits.

```bash
pnpm run release
```

This bumps the version in `package.json`, updates `CHANGELOG.md` from your commit history, creates a git tag, and pushes everything.

---

## Project status

Under active development.
