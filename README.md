# pi-gcc

`pi-gcc` is a **memory extension** for the [pi coding agent](https://github.com/badlogic/pi-mono).

It gives an agent a versioned memory in a `.gcc/` folder, so it can keep context across sessions.

---

## Quick start (copy/paste)

```bash
pi install git:github.com/Whamp/pi-gcc
```

Then in the project where you want GCC memory:

```bash
cd /path/to/your-project
bash "$(pi list --paths | grep pi-gcc)"/skills/gcc/scripts/gcc-init.sh
```

Inside pi, call `gcc_context` to confirm GCC is active.

---

## Install options

```bash
# From git (latest)
pi install git:github.com/Whamp/pi-gcc

# From git (pinned version)
pi install git:github.com/Whamp/pi-gcc@v0.1.0

# Project-local (shared with team via .pi/settings.json)
pi install -l git:github.com/Whamp/pi-gcc

# Try without installing
pi -e git:github.com/Whamp/pi-gcc
```

### Local development

```bash
git clone https://github.com/Whamp/pi-gcc.git
cd pi-gcc
pnpm install --prod=false    # .npmrc omits dev deps by default
pnpm run check

# Run pi with the extension loaded from source
pi -e ./src/index.ts
```

---

## What this project does

It adds 5 tools to pi:

- `gcc_context` — read a status overview (use `read` for deep file-level retrieval)
- `gcc_branch` — create a memory branch
- `gcc_switch` — switch memory branch
- `gcc_commit` — checkpoint what the agent learned
- `gcc_merge` — merge branch insights back into the active branch

It also uses hooks to:

- auto-log turns to `.gcc/branches/<branch>/log.md`
- register/update session mapping in `.gcc/state.yaml` (on `session_start` and branch changes via `gcc_branch`/`gcc_switch`)
- finalize 2-step commit flow on `agent_end`

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
pi install git:github.com/Whamp/pi-gcc
```

---

## Run the extension locally (development)

From the cloned repository root:

```bash
pi -e ./src/index.ts
```

This starts pi with the GCC extension loaded.

---

## Initialize GCC memory in a project

Go to the project you want to use GCC with, then run:

```bash
bash /absolute/path/to/pi-gcc/skills/gcc/scripts/gcc-init.sh
```

Example:

```bash
cd ~/projects/my-app
bash ~/projects/pi-gcc/skills/gcc/scripts/gcc-init.sh
```

This creates:

- `.gcc/state.yaml`
- `.gcc/branches/main/log.md`
- `.gcc/branches/main/commits.md`
- `.gcc/branches/main/metadata.yaml`
- `.gcc/main.md`
- `.gcc/AGENTS.md`
- static GCC section in root `AGENTS.md` (if missing)

---

## First-time workflow example

Inside pi (with extension loaded), try this order:

1. `gcc_context` (no args) — see current memory state
2. `gcc_branch` with name + purpose — create exploration branch
3. Do normal work (read/edit/test)
4. `gcc_commit` with a summary
5. Provide the 3 commit blocks when prompted:
   - `### Branch Purpose`
   - `### Previous Progress Summary`
   - `### This Commit's Contribution`

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

---

## Common problems

### "GCC not initialized. Run gcc-init.sh first."

You are in a project that does not have `.gcc/` yet. Run the init script in that project directory.

### I do not see notifications in print/json mode

That is expected. In non-UI mode, verify by checking files in `.gcc/` and emitted events.

### `gcc_commit` did not write to `commits.md`

`gcc_commit` is 2-step:

1. tool returns log context,
2. agent must reply with the 3 required commit headings.

No commit is finalized until step 2 is present.

---

## Project status

Under active development.
