# Rename pi-gcc to pi-brain Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Rename the project from `pi-gcc` / GCC / `.gcc/` to `pi-brain` / Brain / `.memory/`, with tool prefix `memory_` and tool names `memory_status`, `memory_commit`, `memory_branch`, `memory_switch`, `memory_merge`.

**Architecture:** Pure rename — no behavioral changes. Every file reference to `gcc`, `GCC`, `.gcc/` gets updated to the new naming scheme. Source files `gcc-*.ts` get renamed to `memory-*.ts`. The skill directory moves from `skills/gcc/` to `skills/brain/`. The committer agent moves from `gcc-committer.md` to `memory-committer.md`. The init script moves from `gcc-init.sh` to `brain-init.sh`.

**Tech Stack:** TypeScript, bash, markdown, vitest

**Naming mapping:**

| Old                                      | New                    |
| ---------------------------------------- | ---------------------- |
| `pi-gcc` (package)                       | `pi-brain`             |
| `.gcc/` (directory)                      | `.memory/`             |
| `gcc_context` (tool)                     | `memory_status`        |
| `gcc_commit` (tool)                      | `memory_commit`        |
| `gcc_branch` (tool)                      | `memory_branch`        |
| `gcc_switch` (tool)                      | `memory_switch`        |
| `gcc_merge` (tool)                       | `memory_merge`         |
| `GCC` (prose)                            | `Brain`                |
| `GCC — Git Context Controller` (heading) | `Brain — Agent Memory` |
| `GccState` (class)                       | `MemoryState`          |
| `GccContextParams` (type)                | `MemoryStatusParams`   |
| `gcc-committer` (agent)                  | `memory-committer`     |
| `skills/gcc/` (dir)                      | `skills/brain/`        |
| `gcc-init.sh` (script)                   | `brain-init.sh`        |
| `gcc-*.ts` (files)                       | `memory-*.ts`          |

**Important:** The three commit block headings (`### Branch Purpose`, `### Previous Progress Summary`, `### This Commit's Contribution`) do NOT change — they are a format contract.

---

## Phase 1: Rename source files (git mv)

### Task 1: Rename all `gcc-*.ts` source files to `memory-*.ts`

**TDD scenario:** Trivial change — file renames only, no content changes yet. Tests will break until imports are updated.

**Files:**

- Rename: `src/gcc-branch.ts` → `src/memory-branch.ts`
- Rename: `src/gcc-branch.test.ts` → `src/memory-branch.test.ts`
- Rename: `src/gcc-commit.ts` → `src/memory-commit.ts`
- Rename: `src/gcc-commit.test.ts` → `src/memory-commit.test.ts`
- Rename: `src/gcc-context.ts` → `src/memory-context.ts`
- Rename: `src/gcc-context.test.ts` → `src/memory-context.test.ts`
- Rename: `src/gcc-merge.ts` → `src/memory-merge.ts`
- Rename: `src/gcc-merge.test.ts` → `src/memory-merge.test.ts`
- Rename: `src/gcc-switch.ts` → `src/memory-switch.ts`
- Rename: `src/gcc-switch.test.ts` → `src/memory-switch.test.ts`

**Step 1: Rename the files using git mv**

```bash
cd /home/will/projects/pi-gcc
git mv src/gcc-branch.ts src/memory-branch.ts
git mv src/gcc-branch.test.ts src/memory-branch.test.ts
git mv src/gcc-commit.ts src/memory-commit.ts
git mv src/gcc-commit.test.ts src/memory-commit.test.ts
git mv src/gcc-context.ts src/memory-context.ts
git mv src/gcc-context.test.ts src/memory-context.test.ts
git mv src/gcc-merge.ts src/memory-merge.ts
git mv src/gcc-merge.test.ts src/memory-merge.test.ts
git mv src/gcc-switch.ts src/memory-switch.ts
git mv src/gcc-switch.test.ts src/memory-switch.test.ts
```

**Step 2: Rename skill and agent directories/files**

```bash
git mv skills/gcc skills/brain
git mv skills/brain/scripts/gcc-init.sh skills/brain/scripts/brain-init.sh
git mv agents/gcc-committer.md agents/memory-committer.md
git mv .pi/agents/gcc-committer.md .pi/agents/memory-committer.md
```

**Step 3: Commit the renames only (no content changes)**

```bash
git add -A
git commit -m "refactor: rename files from gcc to memory/brain"
```

---

## Phase 2: Update types and class names

### Task 2: Rename `GccState` class and `GccContextParams` type

**TDD scenario:** Modifying tested code — run existing tests after to verify they still reference correctly.

**Files:**

- Modify: `src/state.ts` — rename class `GccState` → `MemoryState`
- Modify: `src/types.ts` — rename `GccContextParams` → `MemoryStatusParams`

**Step 1: Update `src/types.ts`**

In `src/types.ts`, change:

```typescript
export interface GccContextParams {
```

to:

```typescript
export interface MemoryStatusParams {
```

**Step 2: Update `src/state.ts`**

Change the class name:

```typescript
export class GccState {
```

to:

```typescript
export class MemoryState {
```

Also update the internal directory reference. Change:

```typescript
this.gccDir = path.join(projectDir, ".gcc");
this.statePath = path.join(this.gccDir, "state.yaml");
```

to:

```typescript
this.memoryDir = path.join(projectDir, ".memory");
this.statePath = path.join(this.memoryDir, "state.yaml");
```

And update the field name from `gccDir` to `memoryDir` (2 occurrences: declaration and `isInitialized` getter if it references it — check the actual code, it only uses `statePath`).

**Step 3: Commit**

```bash
git add src/state.ts src/types.ts
git commit -m "refactor: rename GccState to MemoryState, GccContextParams to MemoryStatusParams"
```

---

## Phase 3: Update all import paths and internal references

### Task 3: Update imports in `src/index.ts`

**TDD scenario:** Modifying tested code — tests will be updated in the next task.

**Files:**

- Modify: `src/index.ts`

**Step 1: Update import paths**

Change all `./gcc-*.js` imports to `./memory-*.js`:

```typescript
import { executeGccBranch } from "./gcc-branch.js";
import { executeGccCommit, finalizeGccCommit } from "./gcc-commit.js";
import { executeGccContext } from "./gcc-context.js";
import { executeGccMerge } from "./gcc-merge.js";
import { executeGccSwitch } from "./gcc-switch.js";
```

to:

```typescript
import { executeMemoryBranch } from "./memory-branch.js";
import { executeMemoryCommit, finalizeMemoryCommit } from "./memory-commit.js";
import { executeMemoryStatus } from "./memory-context.js";
import { executeMemoryMerge } from "./memory-merge.js";
import { executeMemorySwitch } from "./memory-switch.js";
```

Also update:

- `import { GccState } from "./state.js"` → `import { MemoryState } from "./state.js"`
- All references to `GccState` in function signatures → `MemoryState`
- `GCC_NOT_INITIALIZED_MESSAGE` → `MEMORY_NOT_INITIALIZED_MESSAGE`, value: `"Brain not initialized. Run brain-init.sh first."`
- `isGccReady` → `isMemoryReady`
- Function names: `buildCompactionReminder` — keep as-is (it's a private helper with a clear name)

**Step 2: Update tool registrations**

For each tool registration block, update `name`, `label`, and `description`:

| Old name      | New name        | New label       | New description                                                 |
| ------------- | --------------- | --------------- | --------------------------------------------------------------- |
| `gcc_context` | `memory_status` | `Memory Status` | `Retrieve agent memory status overview.`                        |
| `gcc_branch`  | `memory_branch` | `Memory Branch` | `Create a new memory branch.`                                   |
| `gcc_switch`  | `memory_switch` | `Memory Switch` | `Switch to another memory branch.`                              |
| `gcc_merge`   | `memory_merge`  | `Memory Merge`  | `Merge insights from one memory branch into the active branch.` |
| `gcc_commit`  | `memory_commit` | `Memory Commit` | `Checkpoint a milestone in agent memory.`                       |

**Step 3: Update event handler strings**

In `session_start` handler:

- `"GCC: log.md is large..."` → `"Brain: log.md is large..."`
- `"GCC active: branch..."` → `"Brain active: branch..."`
- `"GCC not initialized..."` messages

In `session_before_compact` / `buildCompactionReminder`:

- `"GCC memory active on branch..."` → `"Brain memory active on branch..."`

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "refactor: update index.ts tool names, imports, and messages"
```

---

### Task 4: Update function names in tool implementation files

**TDD scenario:** Modifying tested code — update function names and internal references.

**Files:**

- Modify: `src/memory-branch.ts` (was `gcc-branch.ts`)
- Modify: `src/memory-commit.ts` (was `gcc-commit.ts`)
- Modify: `src/memory-context.ts` (was `gcc-context.ts`)
- Modify: `src/memory-merge.ts` (was `gcc-merge.ts`)
- Modify: `src/memory-switch.ts` (was `gcc-switch.ts`)

**Step 1: Update each file**

For each renamed file, update:

**`src/memory-branch.ts`:**

- `GccBranchParams` → `MemoryBranchParams`
- `executeGccBranch` → `executeMemoryBranch`
- `import { GccState }` → `import { MemoryState }`
- Error message: `"Use gcc_switch to switch to it."` → `"Use memory_switch to switch to it."`
- JSDoc: `gcc_branch` → `memory_branch`

**`src/memory-commit.ts`:**

- `GccCommitParams` (local interface) — rename to `MemoryCommitParams`
- `executeGccCommit` → `executeMemoryCommit`
- `finalizeGccCommit` → `finalizeMemoryCommit`
- `import { GccState }` → `import { MemoryState }`
- JSDoc: `gcc_commit` references

**`src/memory-context.ts`:**

- `executeGccContext` → `executeMemoryStatus`
- `import { GccState }` → `import { MemoryState }`
- `import { GccContextParams }` → `import { MemoryStatusParams }`
- `"# GCC Status"` → `"# Memory Status"`
- All `.gcc/` path references in output strings → `.memory/`
- JSDoc: `gcc_context` → `memory_status`

**`src/memory-merge.ts`:**

- `GccMergeParams` → `MemoryMergeParams`
- `executeGccMerge` → `executeMemoryMerge`
- `import { GccState }` → `import { MemoryState }`
- JSDoc: `gcc_merge` → `memory_merge`, `gcc_context` → `memory_status`

**`src/memory-switch.ts`:**

- `GccSwitchParams` → `MemorySwitchParams`
- `executeGccSwitch` → `executeMemorySwitch`
- `import { GccState }` → `import { MemoryState }`
- JSDoc: `gcc_switch` → `memory_switch`

**Step 2: Update `src/branches.ts`**

Change the JSDoc comment and internal path:

```typescript
/**
 * Manages `.gcc/branches/` directory operations.
```

to:

```typescript
/**
 * Manages `.memory/branches/` directory operations.
```

Change the path:

```typescript
this.branchesDir = path.join(projectDir, ".gcc", "branches");
```

to:

```typescript
this.branchesDir = path.join(projectDir, ".memory", "branches");
```

**Step 3: Update `src/subagent.ts`**

- `"gcc-committer.md"` → `"memory-committer.md"` (3 path candidates in `resolveAgentPrompt`)
- `"Could not locate gcc-committer.md agent definition file"` → `"Could not locate memory-committer.md agent definition file"`
- `buildCommitterTask` output strings: `.gcc/AGENTS.md` → `.memory/AGENTS.md`, `.gcc/branches/` → `.memory/branches/`
- `"Distill a GCC commit"` → `"Distill a memory commit"`
- Temp dir prefix: `"gcc-committer-"` → `"memory-committer-"`

**Step 4: Update `src/ota-formatter.ts`**

Change the JSDoc:

```
 * Follows the GCC spec format with full fidelity.
```

to:

```
 * Follows the Brain spec format with full fidelity.
```

**Step 5: Commit**

```bash
git add src/memory-branch.ts src/memory-commit.ts src/memory-context.ts \
  src/memory-merge.ts src/memory-switch.ts src/branches.ts src/subagent.ts \
  src/ota-formatter.ts
git commit -m "refactor: update function names, types, and path references in tool files"
```

---

## Phase 4: Update all test files

### Task 5: Update test files — imports and references

**TDD scenario:** Fixing tests to match the renamed code.

**Files:**

- Modify: `src/memory-branch.test.ts`
- Modify: `src/memory-commit.test.ts`
- Modify: `src/memory-context.test.ts`
- Modify: `src/memory-merge.test.ts`
- Modify: `src/memory-switch.test.ts`
- Modify: `src/branches.test.ts`
- Modify: `src/state.test.ts`
- Modify: `src/subagent.test.ts`
- Modify: `src/index.test.ts`
- Modify: `src/init-script.test.ts`
- Modify: `src/integration.test.ts`

**Step 1: Global search-and-replace patterns for test files**

For every test file, apply these replacements:

| Pattern                                                    | Replacement                 |
| ---------------------------------------------------------- | --------------------------- |
| `./gcc-branch.js`                                          | `./memory-branch.js`        |
| `./gcc-commit.js`                                          | `./memory-commit.js`        |
| `./gcc-context.js`                                         | `./memory-context.js`       |
| `./gcc-merge.js`                                           | `./memory-merge.js`         |
| `./gcc-switch.js`                                          | `./memory-switch.js`        |
| `executeGccBranch`                                         | `executeMemoryBranch`       |
| `executeGccCommit`                                         | `executeMemoryCommit`       |
| `finalizeGccCommit`                                        | `finalizeMemoryCommit`      |
| `executeGccContext`                                        | `executeMemoryStatus`       |
| `executeGccMerge`                                          | `executeMemoryMerge`        |
| `executeGccSwitch`                                         | `executeMemorySwitch`       |
| `GccState`                                                 | `MemoryState`               |
| `GccContextParams`                                         | `MemoryStatusParams`        |
| `".gcc"` or `".gcc/"`                                      | `".memory"` or `".memory/"` |
| `gcc-index-test-`                                          | `memory-index-test-`        |
| `gcc-uninit-`                                              | `memory-uninit-`            |
| `gcc-lazy-init-`                                           | `memory-lazy-init-`         |
| `"gcc_context"`                                            | `"memory_status"`           |
| `"gcc_commit"`                                             | `"memory_commit"`           |
| `"gcc_branch"`                                             | `"memory_branch"`           |
| `"gcc_switch"`                                             | `"memory_switch"`           |
| `"gcc_merge"`                                              | `"memory_merge"`            |
| `"GCC not initialized"`                                    | `"Brain not initialized"`   |
| `"GCC active"`                                             | `"Brain active"`            |
| `"GCC:"`                                                   | `"Brain:"`                  |
| `"GCC memory active"`                                      | `"Brain memory active"`     |
| `"# GCC Status"`                                           | `"# Memory Status"`         |
| `gcc-committer` temp dir prefixes                          | `memory-committer`          |
| `"Use gcc_switch"`                                         | `"Use memory_switch"`       |
| Describe blocks: `"gcc_context"` → `"memory_status"`, etc. |

**Step 2: Run the test suite**

```bash
pnpm run test
```

Expected: All 105 tests pass (or close — some test content assertions may need fine-tuning).

**Step 3: Fix any failing tests**

Iterate on assertion strings that reference old names until all pass.

**Step 4: Commit**

```bash
git add src/*.test.ts
git commit -m "refactor: update all test files for memory/brain naming"
```

---

## Phase 5: Update skill files, templates, and init script

### Task 6: Update skill and template files

**TDD scenario:** Trivial change — content updates in markdown/bash files.

**Files:**

- Modify: `skills/brain/SKILL.md` (renamed from `skills/gcc/SKILL.md`)
- Modify: `skills/brain/scripts/brain-init.sh` (renamed from `skills/gcc/scripts/gcc-init.sh`)
- Modify: `skills/brain/templates/agents-md.md`
- Modify: `skills/brain/templates/root-agents-section.md`

**Step 1: Update `skills/brain/SKILL.md`**

Frontmatter:

```yaml
name: brain
description: Use when working on a project with Brain agent memory management. Triggers on memory_status, memory_commit, memory_branch, memory_merge, memory_switch tool usage, or when the project has a .memory/ directory.
```

Body: Replace all `gcc_context` → `memory_status`, `gcc_commit` → `memory_commit`, `gcc_branch` → `memory_branch`, `gcc_merge` → `memory_merge`, `gcc_switch` → `memory_switch`. Replace `.gcc/` → `.memory/`. Replace `GCC` → `Brain`. Replace `/skill:gcc` → `/skill:brain`. Replace `gcc-init.sh` → `brain-init.sh`.

**Step 2: Update `skills/brain/scripts/brain-init.sh`**

Replace all variable names and references:

- `GCC_DIR=".gcc"` → `MEMORY_DIR=".memory"`
- `BRANCHES_DIR="$GCC_DIR/branches/main"` → `BRANCHES_DIR="$MEMORY_DIR/branches/main"`
- `STATE_FILE="$GCC_DIR/state.yaml"` → `STATE_FILE="$MEMORY_DIR/state.yaml"`
- `GCC_AGENTS_FILE="$GCC_DIR/AGENTS.md"` → `MEMORY_AGENTS_FILE="$MEMORY_DIR/AGENTS.md"`
- `MAIN_MD_FILE="$GCC_DIR/main.md"` → `MAIN_MD_FILE="$MEMORY_DIR/main.md"`
- `LOG_IGNORE_PATTERN=".gcc/branches/*/log.md"` → `LOG_IGNORE_PATTERN=".memory/branches/*/log.md"`
- `grep -q "## GCC"` → `grep -q "## Brain"`
- Comment header: `# gcc-init.sh — One-time GCC project initialization` → `# brain-init.sh — One-time Brain project initialization`
- `Creates .gcc/ directory structure` → `Creates .memory/ directory structure`
- `appends GCC section` → `appends Brain section`
- `echo "GCC initialized successfully."` → `echo "Brain memory initialized successfully."`
- All `$GCC_DIR` → `$MEMORY_DIR`
- All `$GCC_AGENTS_FILE` → `$MEMORY_AGENTS_FILE`

**Step 3: Update `skills/brain/templates/agents-md.md`**

Replace the heading and all references:

```markdown
# Brain — Agent Memory

This directory contains your project's agent memory, managed by the Brain extension.

## Tools

| Tool            | Purpose                                 |
| --------------- | --------------------------------------- |
| `memory_commit` | Checkpoint a milestone in understanding |
| `memory_branch` | Create a memory branch for exploration  |
| `memory_merge`  | Synthesize branch conclusions           |
| `memory_status` | Multi-resolution retrieval of memory    |
| `memory_switch` | Switch active memory branch             |

## File Structure
```

.memory/
├── AGENTS.md # This file — protocol reference
├── main.md # Project roadmap (agent-authored)
└── branches/
└── <branch-name>/
├── commits.md # Milestone memory snapshots
├── log.md # OTA trace since last commit (auto)
└── metadata.yaml # Structured context

```

```

Update all remaining references: `gcc_context` → `memory_status`, etc. Keep commit block heading names unchanged.
Replace: `Call \`gcc_context\` first`→`Call \`memory_status\` first`

**Step 4: Update `skills/brain/templates/root-agents-section.md`**

Replace content with:

```markdown
## Brain — Agent Memory

This project uses Brain for agent memory management.

**Start here when orienting:** Read `.memory/main.md` for the project roadmap, key decisions, and open problems.
Read `.memory/AGENTS.md` for the full Brain protocol reference.
Tools: memory_commit, memory_branch, memory_merge, memory_switch, memory_status
```

**Step 5: Commit**

```bash
git add skills/brain/
git commit -m "refactor: update skill files and templates for brain/memory naming"
```

---

### Task 7: Update the committer agent definitions

**TDD scenario:** Trivial change — markdown content update.

**Files:**

- Modify: `agents/memory-committer.md` (renamed from `agents/gcc-committer.md`)
- Modify: `.pi/agents/memory-committer.md` (renamed from `.pi/agents/gcc-committer.md`)

**Step 1: Update both files identically**

Frontmatter:

```yaml
name: memory-committer
description: Distills OTA logs into structured memory commit entries
tools: read, grep, find, ls
model: google-antigravity/gemini-3-flash
skills: brain
extensions:
```

Body: Replace `GCC (Git Context Controller)` → `Brain`. Replace `.gcc/AGENTS.md` → `.memory/AGENTS.md`. Replace `GCC commit` → `memory commit`. Replace `GCC protocol` → `Brain protocol`.

**Step 2: Commit**

```bash
git add agents/memory-committer.md .pi/agents/memory-committer.md
git commit -m "refactor: rename committer agent to memory-committer"
```

---

## Phase 6: Update project metadata and documentation

### Task 8: Update `package.json`

**TDD scenario:** Trivial change — metadata only.

**Files:**

- Modify: `package.json`

**Step 1: Update package.json fields**

```json
{
  "name": "pi-brain",
  "description": "Versioned memory extension for the pi coding agent",
  "keywords": [
    "brain",
    "context",
    "memory",
    "pi",
    "pi-coding-agent",
    "pi-package"
  ],
  "homepage": "https://github.com/Whamp/pi-brain#readme",
  "bugs": { "url": "https://github.com/Whamp/pi-brain/issues" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Whamp/pi-brain.git"
  }
}
```

Note: `"pi"` section stays as `"extensions": ["./src/index.ts"]`, `"skills": ["./skills"]` — these don't reference gcc.

**Step 2: Commit**

```bash
git add package.json
git commit -m "refactor: rename package to pi-brain"
```

---

### Task 9: Update `AGENTS.md`

**TDD scenario:** Trivial change — documentation only.

**Files:**

- Modify: `AGENTS.md`

**Step 1: Full rewrite of AGENTS.md**

Update all references throughout:

- Title: `# AGENTS.md — pi-brain`
- Project snapshot: `pi-brain`, `Brain agent memory tools + lifecycle hooks`
- Repository map: `src/memory-*.ts` instead of `src/gcc-*.ts`, `skills/brain/SKILL.md` instead of `skills/gcc/SKILL.md`, `skills/brain/scripts/brain-init.sh`, `.memory/` instead of `.gcc/`
- All tool names: `memory_commit`, `memory_branch`, `memory_merge`, `memory_switch`, `memory_status`
- All references to `.gcc/state.yaml` → `.memory/state.yaml`
- All references to `.gcc/branches/` → `.memory/branches/`
- Section 5 runtime facts: update tool names and directory references
- GCC section at bottom → Brain section:

  ```markdown
  ## Brain — Agent Memory

  This project uses Brain for agent memory management.

  **Start here when orienting:** Read `.memory/main.md` for the project roadmap, key decisions, and open problems.
  Read `.memory/AGENTS.md` for the full Brain protocol reference.
  Tools: memory_commit, memory_branch, memory_merge, memory_switch, memory_status
  ```

**Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "refactor: update AGENTS.md for pi-brain naming"
```

---

### Task 10: Update `README.md`

**TDD scenario:** Trivial change — documentation only.

**Files:**

- Modify: `README.md`

**Step 1: Update all references**

- Title: `# pi-brain`
- Description: update to mention Brain/memory instead of GCC
- Install commands: `pi install git:github.com/Whamp/pi-brain`
- Tool names: `memory_status`, `memory_commit`, `memory_branch`, `memory_switch`, `memory_merge`
- Directory references: `.gcc/` → `.memory/`
- Error messages: `"GCC not initialized. Run gcc-init.sh first."` → `"Brain not initialized. Run brain-init.sh first."`
- Skill reference: `/skill:gcc` → `/skill:brain`
- Hook descriptions: `"auto-log turns to .memory/branches/..."`, `".memory/state.yaml"`
- Clone URL: update to pi-brain
- All other `GCC` → `Brain` in prose

**Step 2: Commit**

```bash
git add README.md
git commit -m "refactor: update README for pi-brain naming"
```

---

## Phase 7: Update init-script tests and run full verification

### Task 11: Update init-script test

**TDD scenario:** Modifying tested code — this test runs the actual shell script.

**Files:**

- Modify: `src/init-script.test.ts`

**Step 1: Update references**

- Script path: resolve to `skills/brain/scripts/brain-init.sh` (the test likely resolves a path to the init script)
- Directory assertions: `.gcc/` → `.memory/`
- Content assertions: `"## GCC"` → `"## Brain"`, `"GCC initialized"` → `"Brain memory initialized"`
- `.gitignore` pattern: `.gcc/branches/*/log.md` → `.memory/branches/*/log.md`

**Step 2: Run the init-script test**

```bash
pnpm run test -- src/init-script.test.ts
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/init-script.test.ts
git commit -m "refactor: update init-script tests for brain/memory naming"
```

---

### Task 12: Run full test suite and checks

**TDD scenario:** Verification pass — no code changes expected.

**Step 1: Run full test suite**

```bash
pnpm run test
```

Expected: All 105 tests pass.

**Step 2: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors.

**Step 3: Run full checks**

```bash
pnpm run check
```

Expected: All checks pass (lint, format, typecheck, tests, deadcode, duplicates, secrets).

**Step 4: Fix any remaining issues**

If any tests fail, grep for remaining `gcc`/`GCC`/`.gcc` references:

```bash
grep -rn 'gcc\|GCC\|\.gcc' src/ --include='*.ts' | grep -v node_modules
```

Fix all remaining references and re-run checks.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: remaining gcc references caught by verification"
```

---

## Phase 8: Update historical docs (low priority)

### Task 13: Update spec and plan docs

**TDD scenario:** Trivial change — historical documentation, no tests.

**Files:**

- Modify: `docs/specs/GCC-SPEC-USE-THIS-ONE.md` — rename file to `docs/specs/BRAIN-SPEC.md`, update content
- Modify: `docs/specs/gcc-committer.md` — rename to `docs/specs/memory-committer.md`, update content
- Modify: `docs/specs/GCC-SESSION-CONTEXT.md` — rename to `docs/specs/BRAIN-SESSION-CONTEXT.md`
- Modify: `docs/specs/GCC-SPEC-WRONG-ONE.md` — rename to `docs/specs/BRAIN-SPEC-WRONG-ONE.md`
- Modify: `docs/specs/fix-specs-diff.md` — update references

Note: Historical plan files in `docs/plans/` can be left as-is since they document what happened at the time. The spec files should be updated since they're reference documents.

**Step 1: Rename spec files**

```bash
git mv docs/specs/GCC-SPEC-USE-THIS-ONE.md docs/specs/BRAIN-SPEC.md
git mv docs/specs/gcc-committer.md docs/specs/memory-committer.md
git mv docs/specs/GCC-SESSION-CONTEXT.md docs/specs/BRAIN-SESSION-CONTEXT.md
git mv docs/specs/GCC-SPEC-WRONG-ONE.md docs/specs/BRAIN-SPEC-WRONG-ONE.md
```

**Step 2: Update content in renamed spec files**

Do a search-and-replace in each file for the standard naming map. These are long documents — use editor tooling for bulk replacement.

**Step 3: Update cross-references in AGENTS.md**

The repository map in `AGENTS.md` references `docs/specs/GCC-SPEC-USE-THIS-ONE.md` — update to `docs/specs/BRAIN-SPEC.md`.

**Step 4: Commit**

```bash
git add docs/specs/ AGENTS.md
git commit -m "refactor: rename spec files for brain/memory naming"
```

---

### Task 14: Update this project's own `.gcc/` memory directory

**TDD scenario:** Trivial change — this project's own Brain memory.

**Step 1: Rename the directory**

```bash
git mv .gcc .memory
```

**Step 2: Update `.memory/main.md`**

Replace all references to `pi-gcc`, `gcc_*` tools, `.gcc/` directory with the new naming throughout the roadmap.

**Step 3: Update `.memory/AGENTS.md`**

This is the project's own internal protocol reference — update all references.

**Step 4: Update `.gitignore`**

Change `.gcc/branches/*/log.md` to `.memory/branches/*/log.md`.

**Step 5: Commit**

```bash
git add .memory/ .gitignore
git commit -m "refactor: rename project's own .gcc to .memory"
```

---

### Task 15: Final verification and squash

**Step 1: Run full checks one last time**

```bash
pnpm run check
```

**Step 2: Grep for any remaining gcc/GCC references**

```bash
grep -rn 'gcc\|GCC' --include='*.ts' --include='*.md' --include='*.sh' --include='*.json' \
  --exclude-dir=node_modules --exclude-dir=.memory --exclude=CHANGELOG.md --exclude-dir=docs/plans \
  --exclude-dir=docs/paper
```

Expected: No results (CHANGELOG.md and historical plans are excluded — they document what happened).

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "refactor: final cleanup of gcc references"
```

---

## Summary of all file changes

### Files renamed (git mv):

- `src/gcc-branch.ts` → `src/memory-branch.ts`
- `src/gcc-branch.test.ts` → `src/memory-branch.test.ts`
- `src/gcc-commit.ts` → `src/memory-commit.ts`
- `src/gcc-commit.test.ts` → `src/memory-commit.test.ts`
- `src/gcc-context.ts` → `src/memory-context.ts`
- `src/gcc-context.test.ts` → `src/memory-context.test.ts`
- `src/gcc-merge.ts` → `src/memory-merge.ts`
- `src/gcc-merge.test.ts` → `src/memory-merge.test.ts`
- `src/gcc-switch.ts` → `src/memory-switch.ts`
- `src/gcc-switch.test.ts` → `src/memory-switch.test.ts`
- `skills/gcc/` → `skills/brain/`
- `skills/brain/scripts/gcc-init.sh` → `skills/brain/scripts/brain-init.sh`
- `agents/gcc-committer.md` → `agents/memory-committer.md`
- `.pi/agents/gcc-committer.md` → `.pi/agents/memory-committer.md`
- `docs/specs/GCC-SPEC-USE-THIS-ONE.md` → `docs/specs/BRAIN-SPEC.md`
- `docs/specs/gcc-committer.md` → `docs/specs/memory-committer.md`
- `docs/specs/GCC-SESSION-CONTEXT.md` → `docs/specs/BRAIN-SESSION-CONTEXT.md`
- `docs/specs/GCC-SPEC-WRONG-ONE.md` → `docs/specs/BRAIN-SPEC-WRONG-ONE.md`
- `.gcc/` → `.memory/`

### Files modified in-place (content changes):

- `src/index.ts` — imports, tool names, messages, class references
- `src/state.ts` — class name, directory path
- `src/types.ts` — type name
- `src/branches.ts` — JSDoc, directory path
- `src/subagent.ts` — agent file paths, task strings, temp dir prefix
- `src/ota-formatter.ts` — JSDoc
- All `src/*.test.ts` files — imports, assertions, tool names, directory paths
- `skills/brain/SKILL.md` — full content update
- `skills/brain/scripts/brain-init.sh` — variables, paths, messages
- `skills/brain/templates/agents-md.md` — full content update
- `skills/brain/templates/root-agents-section.md` — full content update
- `agents/memory-committer.md` — frontmatter and body
- `.pi/agents/memory-committer.md` — frontmatter and body
- `package.json` — name, description, keywords, URLs
- `AGENTS.md` — full content update
- `README.md` — full content update
- `.gitignore` — `.gcc/` → `.memory/` pattern
- `.memory/main.md` — all references
- `.memory/AGENTS.md` — all references
- `docs/specs/` renamed files — content updates

### Files intentionally NOT changed:

- `CHANGELOG.md` — historical record, auto-generated
- `docs/plans/` — historical plans document what happened at the time
- `docs/paper/` — the original academic paper
- `pnpm-lock.yaml` — will auto-update when name changes
- Commit block headings (`### Branch Purpose`, etc.) — format contract, unchanged
