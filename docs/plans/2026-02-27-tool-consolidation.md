# Tool Consolidation Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Reduce Brain's tool surface from 5 tools to 2, eliminate `memory_status` as a tool, make skill project-scoped, and ensure the extension has zero footprint in non-Brain projects — all without breaking prompt cache.

**Architecture:** Consolidate `memory_branch`, `memory_switch`, `memory_merge` into a single `memory_branch` tool with an `action` parameter. Remove `memory_status` tool entirely — status is appended to mutation tool results and orientation happens via `read` tool. Register tools conditionally at `session_start` only when `.memory/` exists. Move skill discovery from `resources_discover` hook to project-local `.pi/agent/skills/` created at init time.

**Tech Stack:** TypeScript (ESM), vitest, pi extension API

**Cache safety rules (from HOW-CACHING-WORKS.md):**

- Never change tool definitions mid-session
- Never modify the system prompt per-turn
- Status updates must arrive as append-only tool results, never as injected messages
- Tools are registered once at `session_start` and remain stable for the session

---

## Phase 1: Consolidate Branch Operations (3 → 1 tool)

### Task 1: Create the unified `memory-branch-unified.ts` module

**TDD scenario:** New feature — full TDD cycle

**Files:**

- Create: `src/memory-branch-unified.ts`
- Create: `src/memory-branch-unified.test.ts`

**Step 1: Write the failing tests**

Create `src/memory-branch-unified.test.ts`:

```typescript
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";
import { executeMemoryBranchUnified } from "./memory-branch-unified.js";
import { MemoryState } from "./state.js";

describe("executeMemoryBranchUnified", () => {
  let tmpDir: string;
  let state: MemoryState;
  let branches: BranchManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "memory-branch-unified-test-")
    );
    const memoryDir = path.join(tmpDir, ".memory");
    fs.mkdirSync(path.join(memoryDir, "branches"), { recursive: true });

    fs.writeFileSync(
      path.join(memoryDir, "state.yaml"),
      'active_branch: main\ninitialized: "2026-02-22T14:00:00Z"'
    );

    state = new MemoryState(tmpDir);
    state.load();
    branches = new BranchManager(tmpDir);
    branches.createBranch("main", "Main branch");

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- create action ---

  it("should create a new branch and switch to it", () => {
    const result = executeMemoryBranchUnified(
      { action: "create", name: "explore-redis", purpose: "Evaluate Redis" },
      state,
      branches
    );

    expect(result).toContain("explore-redis");
    expect(branches.branchExists("explore-redis")).toBeTruthy();
    expect(state.activeBranch).toBe("explore-redis");
  });

  it("should reject duplicate branch names on create", () => {
    const result = executeMemoryBranchUnified(
      { action: "create", name: "main", purpose: "Duplicate" },
      state,
      branches
    );

    expect(result).toContain("already exists");
  });

  it("should require name and purpose for create", () => {
    const result = executeMemoryBranchUnified(
      { action: "create" },
      state,
      branches
    );

    expect(result).toContain("required");
  });

  // --- switch action ---

  it("should switch to an existing branch", () => {
    branches.createBranch("feature-x", "Feature X");

    const result = executeMemoryBranchUnified(
      { action: "switch", branch: "feature-x" },
      state,
      branches
    );

    expect(state.activeBranch).toBe("feature-x");
    expect(result).toContain("feature-x");
  });

  it("should return latest commit on switch for orientation", () => {
    branches.createBranch("feature-x", "Feature X");
    branches.appendCommit(
      "feature-x",
      "\n---\n\n## Commit a1b2c3d4 | 2026-02-22\n\n### This Commit's Contribution\n\nRedis is viable.\n"
    );

    const result = executeMemoryBranchUnified(
      { action: "switch", branch: "feature-x" },
      state,
      branches
    );

    expect(result).toContain("Redis is viable.");
  });

  it("should reject switching to nonexistent branch", () => {
    const result = executeMemoryBranchUnified(
      { action: "switch", branch: "nope" },
      state,
      branches
    );

    expect(result).toContain("not found");
    expect(state.activeBranch).toBe("main");
  });

  it("should require branch for switch", () => {
    const result = executeMemoryBranchUnified(
      { action: "switch" },
      state,
      branches
    );

    expect(result).toContain("required");
  });

  // --- merge action ---

  it("should append a merge commit to the current branch", () => {
    branches.createBranch("explore-redis", "Evaluate Redis");
    branches.appendCommit(
      "explore-redis",
      "\n---\n\n## Commit a1b2c3d4 | 2026-02-22\n\n### This Commit's Contribution\n\nRedis is viable.\n"
    );

    const result = executeMemoryBranchUnified(
      {
        action: "merge",
        branch: "explore-redis",
        synthesis: "Redis confirmed as caching layer.",
      },
      state,
      branches
    );

    expect(result).toContain("Merge commit");
    const commits = branches.readCommits("main");
    expect(commits).toContain("Merge from explore-redis");
    expect(commits).toContain("Redis confirmed as caching layer.");
  });

  it("should reject merging a branch into itself", () => {
    const result = executeMemoryBranchUnified(
      { action: "merge", branch: "main", synthesis: "Self merge." },
      state,
      branches
    );

    expect(result).toContain("Cannot merge");
  });

  it("should reject merging a nonexistent branch", () => {
    const result = executeMemoryBranchUnified(
      { action: "merge", branch: "nonexistent", synthesis: "Missing." },
      state,
      branches
    );

    expect(result).toContain("not found");
  });

  it("should require branch and synthesis for merge", () => {
    const result = executeMemoryBranchUnified(
      { action: "merge" },
      state,
      branches
    );

    expect(result).toContain("required");
  });

  it("should update state with last commit info on merge", () => {
    vi.setSystemTime(new Date("2026-02-22T16:00:00.000Z"));
    branches.createBranch("explore-redis", "Evaluate Redis");

    executeMemoryBranchUnified(
      {
        action: "merge",
        branch: "explore-redis",
        synthesis: "Merged Redis findings.",
      },
      state,
      branches
    );

    expect(state.lastCommit).not.toBeNull();
    expect(state.lastCommit?.branch).toBe("main");
    expect(state.lastCommit?.summary).toContain("Merge from explore-redis");
  });

  // --- invalid action ---

  it("should reject invalid action values", () => {
    const result = executeMemoryBranchUnified(
      { action: "delete" },
      state,
      branches
    );

    expect(result).toContain("Unknown action");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/memory-branch-unified.test.ts`
Expected: FAIL — module `./memory-branch-unified.js` does not exist

**Step 3: Write the implementation**

Create `src/memory-branch-unified.ts`:

```typescript
import type { BranchManager } from "./branches.js";
import { generateHash } from "./hash.js";
import type { MemoryState } from "./state.js";

interface MemoryBranchParams {
  action: string;
  name?: string;
  purpose?: string;
  branch?: string;
  synthesis?: string;
}

function executeCreate(
  params: MemoryBranchParams,
  state: MemoryState,
  branches: BranchManager
): string {
  const { name, purpose } = params;

  if (!name || !purpose) {
    return '"name" and "purpose" are required for the create action.';
  }

  if (branches.branchExists(name)) {
    return `Branch "${name}" already exists. Use action "switch" to switch to it.`;
  }

  branches.createBranch(name, purpose);
  state.setActiveBranch(name);
  state.save();

  return `Created branch "${name}" and switched to it.\nPurpose: ${purpose}`;
}

function executeSwitch(
  params: MemoryBranchParams,
  state: MemoryState,
  branches: BranchManager
): string {
  const { branch } = params;

  if (!branch) {
    return '"branch" is required for the switch action.';
  }

  if (!branches.branchExists(branch)) {
    return `Branch "${branch}" not found. Available branches: ${branches.listBranches().join(", ")}`;
  }

  state.setActiveBranch(branch);
  state.save();

  const latest = branches.getLatestCommit(branch);
  const summary = latest ?? "No commits yet.";

  return `Switched to branch "${branch}".\n\n${summary}`;
}

function executeMerge(
  params: MemoryBranchParams,
  state: MemoryState,
  branches: BranchManager
): string {
  const { branch: sourceBranch, synthesis } = params;

  if (!sourceBranch || !synthesis) {
    return '"branch" and "synthesis" are required for the merge action.';
  }

  const targetBranch = state.activeBranch;

  if (sourceBranch === targetBranch) {
    return `Cannot merge branch "${sourceBranch}" into itself.`;
  }

  if (!branches.branchExists(sourceBranch)) {
    return `Branch "${sourceBranch}" not found. Available branches: ${branches.listBranches().join(", ")}`;
  }

  const hash = generateHash();
  const timestamp = new Date().toISOString();
  const summary = `Merge from ${sourceBranch}`;

  const entry = [
    "",
    "---",
    "",
    `## Commit ${hash} | ${timestamp}`,
    "",
    `### Merge from ${sourceBranch}`,
    "",
    synthesis,
    "",
  ].join("\n");

  branches.appendCommit(targetBranch, entry);

  state.setLastCommit(targetBranch, hash, timestamp, summary);
  state.save();

  return `Merge commit ${hash} written to branch "${targetBranch}" (merged from "${sourceBranch}").`;
}

/**
 * Execute the unified memory_branch tool.
 * Actions: create, switch, merge.
 */
export function executeMemoryBranchUnified(
  params: MemoryBranchParams,
  state: MemoryState,
  branches: BranchManager
): string {
  switch (params.action) {
    case "create":
      return executeCreate(params, state, branches);
    case "switch":
      return executeSwitch(params, state, branches);
    case "merge":
      return executeMerge(params, state, branches);
    default:
      return `Unknown action "${params.action}". Valid actions: create, switch, merge.`;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/memory-branch-unified.test.ts`
Expected: All 13 tests PASS

**Step 5: Commit**

```bash
git add src/memory-branch-unified.ts src/memory-branch-unified.test.ts
git commit -m "feat: add unified memory_branch tool with create/switch/merge actions"
```

---

### Task 2: Build the status view helper for tool result injection

**TDD scenario:** Modifying tested code — `memory-context.ts` already has tests. We're extracting `buildStatusView` into a shared helper that both mutation tools can call.

**Files:**

- Modify: `src/memory-context.ts` — export the `buildStatusView` function
- Modify: `src/memory-context.test.ts` — add test for the exported function name

**Step 1: Write the test that verifies the export**

Add to `src/memory-context.test.ts`, a new test:

```typescript
it("should export buildStatusView as a named export", async () => {
  const mod = await import("./memory-context.js");
  expect(typeof mod.buildStatusView).toBe("function");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/memory-context.test.ts`
Expected: FAIL — `mod.buildStatusView` is undefined (currently not exported)

**Step 3: Export `buildStatusView` from `memory-context.ts`**

In `src/memory-context.ts`, change the `buildStatusView` function from private to exported. Find line:

```typescript
function buildStatusView(
```

Replace with:

```typescript
export function buildStatusView(
```

Also update `executeMemoryStatus` to delegate (it already calls `buildStatusView`, so no logic change needed — just the export).

**Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/memory-context.test.ts`
Expected: All 8 tests PASS (7 existing + 1 new)

**Step 5: Commit**

```bash
git add src/memory-context.ts src/memory-context.test.ts
git commit -m "refactor: export buildStatusView for use in mutation tool results"
```

---

### Task 3: Append status to `memory_commit` and `memory_branch` results

**TDD scenario:** Modifying tested code — update `finalizeMemoryCommit` and `executeMemoryBranchUnified` to append status view.

**Files:**

- Modify: `src/memory-commit.ts` — `finalizeMemoryCommit` returns result + status
- Modify: `src/memory-commit.test.ts` — verify status is included in result
- Modify: `src/memory-branch-unified.ts` — each action returns result + status
- Modify: `src/memory-branch-unified.test.ts` — verify status is included in results

**Step 1: Write the failing test for commit**

Add to `src/memory-commit.test.ts` in the `finalizeMemoryCommit` describe block:

```typescript
it("should include status view in the result", () => {
  // Arrange
  fs.writeFileSync(
    path.join(tmpDir, ".memory/main.md"),
    "# Roadmap\n\nGoals here.\n"
  );
  const commitContent =
    "### Branch Purpose\n\nMain\n\n### Previous Progress Summary\n\nNone.\n\n### This Commit's Contribution\n\nFirst milestone.\n";

  // Act
  const message = finalizeMemoryCommit(
    "First milestone",
    commitContent,
    state,
    branches,
    tmpDir
  );

  // Assert
  expect(message).toContain("Commit ");
  expect(message).toContain("# Memory Status");
  expect(message).toContain("Active branch: main");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/memory-commit.test.ts`
Expected: FAIL — `finalizeMemoryCommit` does not accept `projectDir` parameter and result does not contain status

**Step 3: Update `finalizeMemoryCommit` signature and implementation**

In `src/memory-commit.ts`, add the import and update:

```typescript
import type { BranchManager } from "./branches.js";
import { generateHash } from "./hash.js";
import { buildStatusView } from "./memory-context.js";
import type { MemoryState } from "./state.js";
import { buildCommitterTask } from "./subagent.js";

// ... executeMemoryCommit unchanged ...

export function finalizeMemoryCommit(
  summary: string,
  commitContent: string,
  state: MemoryState,
  branches: BranchManager,
  projectDir: string
): string {
  const branch = state.activeBranch;
  const hash = generateHash();
  const timestamp = new Date().toISOString();

  const entry = [
    "",
    "---",
    "",
    `## Commit ${hash} | ${timestamp}`,
    "",
    commitContent,
    "",
  ].join("\n");

  branches.appendCommit(branch, entry);
  branches.clearLog(branch);

  state.setLastCommit(branch, hash, timestamp, summary);
  state.save();

  const confirmation = `Commit ${hash} written to branch "${branch}".`;
  const status = buildStatusView(state, branches, projectDir);

  return `${confirmation}\n\n${status}`;
}
```

**Step 4: Update existing `finalizeMemoryCommit` tests**

All existing tests in `memory-commit.test.ts` call `finalizeMemoryCommit` with 4 args. Add `tmpDir` as the 5th argument to every call:

```typescript
finalizeMemoryCommit("First milestone", commitContent, state, branches, tmpDir);
```

Update every call site in the test file (4 calls total).

**Step 5: Update the call site in `index.ts`**

In `src/index.ts`, the `memory_commit` tool handler calls:

```typescript
const message = finalizeMemoryCommit(
  params.summary,
  commitContent,
  state,
  branchManager
);
```

Add `ctx.cwd` as the 5th argument:

```typescript
const message = finalizeMemoryCommit(
  params.summary,
  commitContent,
  state,
  branchManager,
  ctx.cwd
);
```

**Step 6: Run tests to verify they pass**

Run: `pnpm run test -- src/memory-commit.test.ts`
Expected: All 8 tests PASS (7 existing + 1 new)

**Step 7: Write the failing test for branch unified**

Add to `src/memory-branch-unified.test.ts`:

```typescript
it("should include status view in create result", () => {
  fs.writeFileSync(
    path.join(tmpDir, ".memory/main.md"),
    "# Roadmap\n\nGoals.\n"
  );

  const result = executeMemoryBranchUnified(
    { action: "create", name: "test-branch", purpose: "Testing" },
    state,
    branches,
    tmpDir
  );

  expect(result).toContain("Created branch");
  expect(result).toContain("# Memory Status");
  expect(result).toContain("Active branch: test-branch");
});

it("should include status view in switch result", () => {
  branches.createBranch("feature-x", "Feature X");
  fs.writeFileSync(
    path.join(tmpDir, ".memory/main.md"),
    "# Roadmap\n\nGoals.\n"
  );

  const result = executeMemoryBranchUnified(
    { action: "switch", branch: "feature-x" },
    state,
    branches,
    tmpDir
  );

  expect(result).toContain("Switched to branch");
  expect(result).toContain("# Memory Status");
  expect(result).toContain("Active branch: feature-x");
});

it("should include status view in merge result", () => {
  branches.createBranch("explore-redis", "Redis eval");
  fs.writeFileSync(
    path.join(tmpDir, ".memory/main.md"),
    "# Roadmap\n\nGoals.\n"
  );

  const result = executeMemoryBranchUnified(
    {
      action: "merge",
      branch: "explore-redis",
      synthesis: "Redis works.",
    },
    state,
    branches,
    tmpDir
  );

  expect(result).toContain("Merge commit");
  expect(result).toContain("# Memory Status");
});

it("should NOT include status view in error results", () => {
  const result = executeMemoryBranchUnified(
    { action: "switch", branch: "nonexistent" },
    state,
    branches,
    tmpDir
  );

  expect(result).toContain("not found");
  expect(result).not.toContain("# Memory Status");
});
```

**Step 8: Run test to verify they fail**

Run: `pnpm run test -- src/memory-branch-unified.test.ts`
Expected: FAIL — function signature doesn't accept `projectDir`

**Step 9: Update `executeMemoryBranchUnified` to accept `projectDir` and append status on success**

Update the function signature and each action helper to accept and pass through `projectDir`. Import `buildStatusView`. Append status to successful results only (not error results).

The key change in `src/memory-branch-unified.ts`:

```typescript
import { buildStatusView } from "./memory-context.js";

// Each helper gets projectDir parameter added.
// On success paths, append: `\n\n${buildStatusView(state, branches, projectDir)}`
// On error paths (validation failures, not found), return the error string as-is.
```

Update all existing test calls in `memory-branch-unified.test.ts` to pass `tmpDir` as the 4th argument.

**Step 10: Run all tests to verify they pass**

Run: `pnpm run test -- src/memory-branch-unified.test.ts src/memory-commit.test.ts`
Expected: All tests PASS

**Step 11: Commit**

```bash
git add src/memory-commit.ts src/memory-commit.test.ts src/memory-branch-unified.ts src/memory-branch-unified.test.ts src/index.ts
git commit -m "feat: append status view to mutation tool results"
```

---

## Phase 2: Rewire `index.ts` — Conditional Registration and Tool Replacement

### Task 4: Replace 5 tools with 2 tools and conditional registration

**TDD scenario:** Modifying tested code — `index.test.ts` has extensive wiring tests that must be updated.

**Files:**

- Modify: `src/index.ts` — full rewrite of tool registration
- Modify: `src/index.test.ts` — update all wiring tests

**Step 1: Update `index.test.ts` wiring test**

Replace the "should register all memory tools" test with:

```typescript
it("should not register tools during activate (deferred to session_start)", () => {
  // Arrange
  const mockPi = createMockPi();

  // Act
  activate(mockPi.api);

  // Assert — no tools registered yet
  expect(mockPi.tools).toHaveLength(0);

  const handlerNames = mockPi.handlers.map((h) => h.event);
  expect(handlerNames).toContain("turn_end");
  expect(handlerNames).toContain("session_start");
  expect(handlerNames).toContain("session_before_compact");
  // resources_discover removed — skill is now project-scoped
  expect(handlerNames).not.toContain("resources_discover");
});
```

Add a new test:

```typescript
it("should register 2 tools on session_start when .memory/ exists", async () => {
  // Arrange
  const { projectDir, cleanup } = setupInitializedProject();
  try {
    const mockPi = createMockPi();
    activate(mockPi.api);

    const ui = createMockUi();
    const ctx = {
      cwd: projectDir,
      ui,
      sessionManager: {
        getSessionFile: () => "/tmp/pi-session-tools.jsonl",
      },
    } as unknown as ExtensionContext;

    // Act
    const sessionStart = getHandler(mockPi.handlers, "session_start");
    await sessionStart?.({ type: "session_start" }, ctx);

    // Assert
    const toolNames = mockPi.tools.map((t) => t.name);
    expect(toolNames).toHaveLength(2);
    expect(toolNames).toContain("memory_commit");
    expect(toolNames).toContain("memory_branch");
  } finally {
    cleanup();
  }
});

it("should register zero tools on session_start when .memory/ does not exist", async () => {
  // Arrange
  const mockPi = createMockPi();
  activate(mockPi.api);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-no-init-"));
  try {
    const ui = createMockUi();
    const ctx = {
      cwd: tmpDir,
      ui,
      sessionManager: { getSessionFile: () => "/tmp/no-brain.jsonl" },
    } as unknown as ExtensionContext;

    // Act
    const sessionStart = getHandler(mockPi.handlers, "session_start");
    await sessionStart?.({ type: "session_start" }, ctx);

    // Assert
    expect(mockPi.tools).toHaveLength(0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

it("should not register tools twice on repeated session_start", async () => {
  // Arrange
  const { projectDir, cleanup } = setupInitializedProject();
  try {
    const mockPi = createMockPi();
    activate(mockPi.api);

    const ui = createMockUi();
    const ctx = {
      cwd: projectDir,
      ui,
      sessionManager: {
        getSessionFile: () => "/tmp/pi-session-double.jsonl",
      },
    } as unknown as ExtensionContext;

    const sessionStart = getHandler(mockPi.handlers, "session_start");

    // Act
    await sessionStart?.({ type: "session_start" }, ctx);
    await sessionStart?.({ type: "session_start" }, ctx);

    // Assert
    expect(mockPi.tools).toHaveLength(2);
  } finally {
    cleanup();
  }
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/index.test.ts`
Expected: FAIL — old wiring test expects 5 tools and `resources_discover`

**Step 3: Rewrite `src/index.ts`**

Key changes:

1. Remove all 5 `pi.registerTool()` calls from the top-level `activate` scope.
2. Remove `resources_discover` handler.
3. Remove imports for `executeMemoryStatus`, `executeMemorySwitch`, `executeMemoryMerge`, `executeMemoryBranch`.
4. Add import for `executeMemoryBranchUnified`.
5. In `session_start`, after `tryLoad` succeeds, call a `registerBrainTools(pi)` function that registers `memory_commit` and `memory_branch` (with a `toolsRegistered` guard to prevent double registration).
6. The `memory_branch` tool uses `StringEnum(["create", "switch", "merge"])` for the `action` param with all other params optional.
7. Both tools pass `ctx.cwd` to their respective functions for status view generation.

Full replacement for `src/index.ts`:

```typescript
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  SessionBeforeCompactEvent,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { BranchManager } from "./branches.js";
import { LOG_SIZE_WARNING_BYTES } from "./constants.js";
import { executeMemoryBranchUnified } from "./memory-branch-unified.js";
import { executeMemoryCommit, finalizeMemoryCommit } from "./memory-commit.js";
import { formatOtaEntry } from "./ota-formatter.js";
import { extractOtaInput } from "./ota-logger.js";
import { MemoryState } from "./state.js";
import { extractCommitBlocks, spawnCommitter } from "./subagent.js";

const MEMORY_NOT_INITIALIZED_MESSAGE =
  "Brain not initialized. Run brain-init.sh first, then /reload.";

function createTextResult(text: string): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text }],
    details: {},
  };
}

function isMemoryReady(
  state: MemoryState | null,
  branchManager: BranchManager | null
): state is MemoryState {
  return state !== null && branchManager !== null && state.isInitialized;
}

function upsertCurrentSession(state: MemoryState, ctx: ExtensionContext): void {
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) {
    return;
  }

  state.upsertSession(
    sessionFile,
    state.activeBranch,
    new Date().toISOString()
  );
  state.save();
}

function buildCompactionReminder(
  state: MemoryState,
  branchManager: BranchManager
): string {
  const branch = state.activeBranch;
  const turns = branchManager.getLogTurnCount(branch);
  const summary = state.lastCommit?.summary ?? "No commits yet";

  return [
    `Brain memory active on branch "${branch}".`,
    `${turns} uncommitted turn${turns === 1 ? "" : "s"} in .memory/branches/${branch}/log.md.`,
    `Latest commit summary: ${summary}.`,
  ].join(" ");
}

function appendCompactionReminder(
  event: SessionBeforeCompactEvent,
  reminder: string
): void {
  event.customInstructions = event.customInstructions
    ? `${event.customInstructions}\n\n${reminder}`
    : reminder;
}

export default function activate(pi: ExtensionAPI) {
  let state: MemoryState | null = null;
  let branchManager: BranchManager | null = null;
  let toolsRegistered = false;

  function tryLoad(ctx: ExtensionContext): boolean {
    if (isMemoryReady(state, branchManager)) {
      return true;
    }

    const candidate = new MemoryState(ctx.cwd);
    candidate.load();

    if (!candidate.isInitialized) {
      return false;
    }

    state = candidate;
    branchManager = new BranchManager(ctx.cwd);
    upsertCurrentSession(state, ctx);
    return true;
  }

  function registerBrainTools(): void {
    if (toolsRegistered) {
      return;
    }
    toolsRegistered = true;

    pi.registerTool({
      name: "memory_commit",
      label: "Memory Commit",
      description: "Checkpoint a milestone in agent memory.",
      parameters: Type.Object({
        summary: Type.String({
          description: "Short summary of this checkpoint",
        }),
        update_roadmap: Type.Optional(Type.Boolean()),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (
          !tryLoad(ctx) ||
          !isMemoryReady(state, branchManager) ||
          !branchManager
        ) {
          return createTextResult(MEMORY_NOT_INITIALIZED_MESSAGE);
        }

        const { task } = executeMemoryCommit(params, state, branchManager);

        const result = await spawnCommitter(ctx.cwd, task, signal);

        if (result.exitCode !== 0 || result.error) {
          return createTextResult(
            `Commit failed: ${result.error ?? "subagent exited with non-zero code"}`
          );
        }

        const commitContent = extractCommitBlocks(result.text);
        if (!commitContent) {
          return createTextResult(
            "Commit failed: could not extract commit blocks from subagent response."
          );
        }

        const message = finalizeMemoryCommit(
          params.summary,
          commitContent,
          state,
          branchManager,
          ctx.cwd
        );

        return createTextResult(message);
      },
    });

    pi.registerTool({
      name: "memory_branch",
      label: "Memory Branch",
      description:
        "Manage memory branches. Actions: create (new branch), switch (change active branch), merge (synthesize branch into current).",
      parameters: Type.Object({
        action: Type.String({
          description: 'Action to perform: "create", "switch", or "merge"',
        }),
        name: Type.Optional(
          Type.String({
            description: "Branch name (required for create)",
          })
        ),
        purpose: Type.Optional(
          Type.String({
            description: "Why this branch exists (required for create)",
          })
        ),
        branch: Type.Optional(
          Type.String({
            description: "Target branch name (required for switch and merge)",
          })
        ),
        synthesis: Type.Optional(
          Type.String({
            description:
              "Synthesized insight from source branch (required for merge)",
          })
        ),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (
          !tryLoad(ctx) ||
          !isMemoryReady(state, branchManager) ||
          !branchManager
        ) {
          return createTextResult(MEMORY_NOT_INITIALIZED_MESSAGE);
        }

        const previousBranch = state.activeBranch;
        const result = executeMemoryBranchUnified(
          params,
          state,
          branchManager,
          ctx.cwd
        );

        if (state.activeBranch !== previousBranch) {
          upsertCurrentSession(state, ctx);
        }

        return createTextResult(result);
      },
    });
  }

  pi.on("session_start", (_event, ctx) => {
    state = new MemoryState(ctx.cwd);
    state.load();
    branchManager = new BranchManager(ctx.cwd);

    if (!state.isInitialized) {
      return;
    }

    registerBrainTools();
    upsertCurrentSession(state, ctx);

    const turnCount = branchManager.getLogTurnCount(state.activeBranch);
    const logSizeBytes = branchManager.getLogSizeBytes(state.activeBranch);

    if (logSizeBytes >= LOG_SIZE_WARNING_BYTES) {
      const sizeKB = Math.round(logSizeBytes / 1024);
      ctx.ui.notify(
        `Brain: log.md is large (${sizeKB} KB). You should commit to distill this into structured memory.`,
        "warning"
      );
    }

    const branch = state.activeBranch;
    const turnLabel = `${turnCount} uncommitted turn${turnCount === 1 ? "" : "s"}`;
    ctx.ui.setStatus("brain", `Brain: ${branch} (${turnLabel})`);
  });

  pi.on("turn_end", (event) => {
    if (!isMemoryReady(state, branchManager) || !branchManager) {
      return;
    }

    const input = extractOtaInput(event);
    if (!input) {
      return;
    }

    const entry = formatOtaEntry(input);
    branchManager.appendLog(state.activeBranch, entry);
  });

  pi.on("session_before_compact", (event) => {
    if (!isMemoryReady(state, branchManager) || !branchManager) {
      return;
    }

    const reminder = buildCompactionReminder(state, branchManager);
    appendCompactionReminder(event, reminder);
  });
}
```

**Step 4: Update remaining `index.test.ts` tests**

Several existing tests reference `memory_status`, `memory_switch`, and `memory_merge` tools by name. Update:

- Remove the "uninitialized" test that calls `memory_status` — replace with a test that verifies no tools exist when uninitialized.
- Update the "branch sync" test to use `memory_branch` with `{ action: "create", name: "feature-x", purpose: "..." }`.
- Remove the `resources_discover` test entirely.
- Update the "lazy load" test to verify tools appear after mid-session init + re-calling session_start (simulating `/reload`).

**Step 5: Run tests**

Run: `pnpm run test -- src/index.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: conditional tool registration, consolidate to 2 tools, remove resources_discover"
```

---

## Phase 3: Project-Scoped Skill and Init Script Updates

### Task 5: Update `brain-init.sh` to copy skill into project

**TDD scenario:** Modifying tested code — `init-script.test.ts` covers the init script.

**Files:**

- Modify: `skills/brain/scripts/brain-init.sh`
- Modify: `src/init-script.test.ts`

**Step 1: Write the failing tests**

Add to `src/init-script.test.ts`:

```typescript
it("should copy skill into .pi/agent/skills/brain/", () => {
  // Act
  execFileSync("bash", [scriptPath], { cwd: tmpDir });

  // Assert
  expect(
    fs.existsSync(path.join(tmpDir, ".pi/agent/skills/brain/SKILL.md"))
  ).toBeTruthy();
  const skillContent = fs.readFileSync(
    path.join(tmpDir, ".pi/agent/skills/brain/SKILL.md"),
    "utf8"
  );
  expect(skillContent).toContain("Brain");
});

it("should print reload instruction after init", () => {
  // Act
  const output = execFileSync("bash", [scriptPath], {
    cwd: tmpDir,
    encoding: "utf8",
  });

  // Assert
  expect(output).toContain("/reload");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/init-script.test.ts`
Expected: FAIL — `.pi/agent/skills/brain/SKILL.md` does not exist

**Step 3: Update `brain-init.sh`**

Add to `brain-init.sh`, after the gitignore section:

```bash
# --- Copy skill into project-local .pi/agent/skills/ ---

SKILL_SOURCE_DIR="$SCRIPT_DIR/.."
PROJECT_SKILL_DIR=".pi/agent/skills/brain"

if [ ! -d "$PROJECT_SKILL_DIR" ]; then
  mkdir -p "$PROJECT_SKILL_DIR"
fi

# Always overwrite SKILL.md (like AGENTS.md, it's a reference doc)
cp "$SKILL_SOURCE_DIR/SKILL.md" "$PROJECT_SKILL_DIR/SKILL.md"

echo ""
echo "Brain memory initialized successfully."
echo "Run /reload to activate Brain tools."
```

Also update the existing success message at the end (remove the old `echo` line that just says "Brain memory initialized successfully.").

**Step 4: Run tests**

Run: `pnpm run test -- src/init-script.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add skills/brain/scripts/brain-init.sh src/init-script.test.ts
git commit -m "feat: brain-init copies skill to project, prints /reload instruction"
```

---

### Task 6: Update templates and documentation

**TDD scenario:** Trivial change — documentation only, no logic.

**Files:**

- Modify: `skills/brain/templates/root-agents-section.md` — update tool list
- Modify: `skills/brain/templates/agents-md.md` — update tool table
- Modify: `skills/brain/SKILL.md` — update orientation instructions (no `memory_status` tool)
- Modify: `agents/memory-committer.md` — no changes expected (verify)
- Modify: `src/init-script.test.ts` — update assertions for new tool names

**Step 1: Update `root-agents-section.md`**

```markdown
## Brain — Agent Memory

This project uses Brain for agent memory management.

**Start here when orienting:** Read `.memory/main.md` for the project roadmap, key decisions, and open problems.
Read `.memory/AGENTS.md` for the full Brain protocol reference.
Tools: memory_commit, memory_branch (create/switch/merge)
```

**Step 2: Update `agents-md.md`**

Update the tool table:

```markdown
## Tools

| Tool            | Purpose                                  |
| --------------- | ---------------------------------------- |
| `memory_commit` | Checkpoint a milestone in understanding  |
| `memory_branch` | Create, switch, or merge memory branches |

Branch actions:

- `create` — start a new branch for exploration
- `switch` — change the active memory branch
- `merge` — synthesize a branch's conclusions into the current branch
```

**Step 3: Update `SKILL.md`**

Remove references to `memory_status` tool. Update the orientation section:

Replace the "Context Retrieval" section. Instead of telling agents to call `memory_status`, instruct them to:

```markdown
## Context Retrieval

At the start of a new session on an existing project, orient yourself by reading:

- `read .memory/main.md` — project roadmap
- `read .memory/branches/<branch>/commits.md` — full branch history

For the OTA trace since last commit:

- `read .memory/branches/<branch>/log.md`

Both `memory_commit` and `memory_branch` include a status overview in their results, so you always have current state after mutations.
```

**Step 4: Update init-script test assertions**

In `src/init-script.test.ts`, update the test that checks AGENTS.md content:

```typescript
// Old:
expect(agents).toContain(
  "Tools: memory_commit, memory_branch, memory_merge, memory_switch, memory_status"
);
// New:
expect(agents).toContain("Tools: memory_commit, memory_branch");
```

Update the test that checks `.memory/AGENTS.md` content:

```typescript
// Old assertions for memory_status, memory_merge, memory_switch individually
// New:
expect(memoryAgents).toContain("memory_commit");
expect(memoryAgents).toContain("memory_branch");
// Remove individual assertions for memory_status, memory_merge, memory_switch
```

**Step 5: Run tests**

Run: `pnpm run test -- src/init-script.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add skills/ agents/ src/init-script.test.ts
git commit -m "docs: update templates and skill for 2-tool surface"
```

---

## Phase 4: Cleanup

### Task 7: Remove old tool modules and update types

**TDD scenario:** Trivial change — deleting code, no new logic.

**Files:**

- Delete: `src/memory-branch.ts`
- Delete: `src/memory-branch.test.ts`
- Delete: `src/memory-switch.ts`
- Delete: `src/memory-switch.test.ts`
- Delete: `src/memory-merge.ts`
- Delete: `src/memory-merge.test.ts`
- Modify: `src/types.ts` — remove `MemoryStatusParams` (no longer needed)
- Modify: `src/memory-context.ts` — remove `executeMemoryStatus` function (no callers), remove `MemoryStatusParams` import

**Step 1: Verify no imports reference the old modules**

Run:

```bash
rg "memory-branch\.js|memory-switch\.js|memory-merge\.js" src/ --glob '!*.test.ts' --glob '!memory-branch.ts' --glob '!memory-switch.ts' --glob '!memory-merge.ts'
```

Expected: No matches (index.ts was already updated in Task 4).

Run:

```bash
rg "executeMemoryStatus|MemoryStatusParams" src/ --glob '!*.test.ts' --glob '!memory-context.ts' --glob '!types.ts'
```

Expected: No matches.

**Step 2: Delete the old files**

```bash
rm src/memory-branch.ts src/memory-branch.test.ts
rm src/memory-switch.ts src/memory-switch.test.ts
rm src/memory-merge.ts src/memory-merge.test.ts
```

**Step 3: Clean up `types.ts`**

Remove `MemoryStatusParams` interface from `src/types.ts`.

**Step 4: Clean up `memory-context.ts`**

Remove the `executeMemoryStatus` function and the `MemoryStatusParams` import. Keep `buildStatusView` as the sole export.

**Step 5: Update `memory-context.test.ts`**

Remove all tests for `executeMemoryStatus`. Keep or convert tests to call `buildStatusView` directly (since it's now the export being tested). Update imports.

**Step 6: Run full test suite**

Run: `pnpm run test`
Expected: All tests PASS

**Step 7: Run full checks**

Run: `pnpm run check`
Expected: All checks pass (lint, typecheck, format, tests, deadcode, duplicates)

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove old tool modules, clean up types and exports"
```

---

## Phase 5: Final Verification

### Task 8: End-to-end verification

**TDD scenario:** Manual verification

**Step 1: Run full check suite**

Run: `pnpm run check`
Expected: All green

**Step 2: Verify non-Brain project has zero footprint**

```bash
cd /tmp && mkdir test-no-brain && cd test-no-brain
pi -e /home/will/projects/pi-brain/src/index.ts -p "list your available tools"
```

Expected: No `memory_*` tools in output. No Brain skill in available_skills.

**Step 3: Verify Brain project works end-to-end**

```bash
cd /tmp && mkdir test-brain && cd test-brain && git init
pi -e /home/will/projects/pi-brain/src/index.ts
# In session: run brain-init.sh, then /reload
# Verify: memory_commit and memory_branch tools available
# Verify: memory_branch with action "create" works
# Verify: memory_commit includes status in result
```

**Step 4: Commit any fixups**

```bash
git add -A && git commit -m "chore: post-verification fixups" # if needed
```

---

## Summary

| Before                              | After                                       |
| ----------------------------------- | ------------------------------------------- |
| 5 tools always registered           | 2 tools, only in Brain projects             |
| `memory_status` tool                | Status via tool results + `read`            |
| `resources_discover` hook for skill | Skill copied to `.pi/agent/skills/` at init |
| Brain visible in all projects       | Zero footprint in non-Brain projects        |
| Mid-session init works silently     | Mid-session init requires `/reload`         |

**Cache safety:** No system prompt modifications. No tool set changes mid-session. Status arrives as append-only tool results. Fully prefix-stable.
