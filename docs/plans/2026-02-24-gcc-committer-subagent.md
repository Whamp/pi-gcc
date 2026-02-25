# gcc-committer Subagent Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Replace the fragile 2-step gcc_commit flow (tool → agent_end hook) with a subagent that distills OTA logs into commit entries in a single tool call.

**Architecture:** The `gcc_commit` tool handler spawns a `gcc-committer` subagent via `pi --mode json --no-session -p "Task: ..."`. The subagent reads `.gcc/` files with read-only tools, produces the three commit blocks as its text response, and the extension captures the output via stdout. `CommitFlowManager` and the commit portion of the `agent_end` hook are removed entirely. `finalizeGccCommit` is preserved unchanged.

**Tech Stack:** TypeScript (ESM), vitest, pi CLI (`child_process.spawn`), pi subagent conventions

**Key files:**

- Spec: `docs/specs/gcc-committer.md`
- Agent definition: `.pi/agents/gcc-committer.md`
- Existing tests: `src/commit-flow.test.ts`, `src/gcc-commit.test.ts`, `src/index.test.ts`, `src/integration.test.ts`

---

## Phase 1: Build the subagent spawner

### Task 1: Create `src/subagent.ts` with spawn logic

**Files:**

- Create: `src/subagent.ts`
- Test: `src/subagent.test.ts`

**Step 1: Write the failing test**

Test the task-building function (pure, no spawning):

```typescript
// src/subagent.test.ts
import { buildCommitterTask } from "./subagent.js";

describe("buildCommitterTask", () => {
  it("builds task string with branch, summary, and file paths", () => {
    const task = buildCommitterTask("main", "Fixed auth flow");

    expect(task).toContain('branch "main"');
    expect(task).toContain("Fixed auth flow");
    expect(task).toContain(".gcc/AGENTS.md");
    expect(task).toContain(".gcc/branches/main/log.md");
    expect(task).toContain(".gcc/branches/main/commits.md");
  });

  it("escapes branch names with special characters", () => {
    const task = buildCommitterTask("feature/auth-fix", "Summary");

    expect(task).toContain("feature/auth-fix");
    expect(task).toContain(".gcc/branches/feature/auth-fix/log.md");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- src/subagent.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/subagent.ts
import { spawn } from "node:child_process";

export function buildCommitterTask(branch: string, summary: string): string {
  return [
    `Distill a GCC commit for branch "${branch}".`,
    `Summary: ${summary}`,
    "",
    "Read these files:",
    "- .gcc/AGENTS.md (protocol reference — read first)",
    `- .gcc/branches/${branch}/log.md (OTA trace to distill)`,
    `- .gcc/branches/${branch}/commits.md (previous commits for rolling summary)`,
    "",
    "Produce the three commit blocks.",
  ].join("\n");
}

export interface SubagentResult {
  text: string;
  exitCode: number;
  error?: string;
}

export function spawnCommitter(
  cwd: string,
  task: string,
  signal?: AbortSignal
): Promise<SubagentResult> {
  return new Promise((resolve) => {
    const args = ["--mode", "json", "--no-session", "-p", `Task: ${task}`];

    const proc = spawn("pi", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      const text = extractFinalText(stdout);
      resolve({
        text,
        exitCode: code ?? 1,
        error:
          code !== 0
            ? stderr.trim() || "Subagent exited with non-zero code"
            : undefined,
      });
    });

    proc.on("error", (err) => {
      resolve({
        text: "",
        exitCode: 1,
        error: `Failed to spawn subagent: ${err.message}`,
      });
    });

    if (signal) {
      const kill = () => {
        proc.kill("SIGTERM");
        setTimeout(() => !proc.killed && proc.kill("SIGKILL"), 3000);
      };
      if (signal.aborted) kill();
      else signal.addEventListener("abort", kill, { once: true });
    }
  });
}

/**
 * Extract the last assistant text from pi's JSON-mode stdout.
 * Each line is a JSON event; we want the last message_end with role=assistant.
 */
export function extractFinalText(stdout: string): string {
  let lastText = "";
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const evt = JSON.parse(line) as {
        type?: string;
        message?: {
          role?: string;
          content?: { type?: string; text?: string }[];
        };
      };
      if (evt.type === "message_end" && evt.message?.role === "assistant") {
        const texts = (evt.message.content ?? [])
          .filter((c) => c.type === "text" && typeof c.text === "string")
          .map((c) => c.text as string);
        if (texts.length > 0) {
          lastText = texts.join("\n\n");
        }
      }
    } catch {
      // Not JSON — skip
    }
  }
  return lastText;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- src/subagent.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/subagent.ts src/subagent.test.ts
git commit -m "feat: add subagent spawn module with task builder and output extractor"
```

---

### Task 2: Test `extractFinalText` with realistic pi JSON output

**Files:**

- Modify: `src/subagent.test.ts`

**Step 1: Add tests for extractFinalText**

```typescript
import { buildCommitterTask, extractFinalText } from "./subagent.js";

describe("extractFinalText", () => {
  it("extracts text from the last assistant message_end event", () => {
    const stdout = [
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "### Branch Purpose\nBuild GCC.\n\n### Previous Progress Summary\nInitial commit.\n\n### This Commit's Contribution\n- Added spawn module.",
            },
          ],
        },
      }),
    ].join("\n");

    const result = extractFinalText(stdout);
    expect(result).toContain("### Branch Purpose");
    expect(result).toContain("### This Commit's Contribution");
  });

  it("returns the last assistant message when there are multiple", () => {
    const stdout = [
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Let me read the files..." }],
        },
      }),
      JSON.stringify({
        type: "tool_result_end",
        message: {
          role: "tool",
          content: [{ type: "text", text: "file contents" }],
        },
      }),
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "### Branch Purpose\nFinal answer." },
          ],
        },
      }),
    ].join("\n");

    const result = extractFinalText(stdout);
    expect(result).toContain("Final answer.");
    expect(result).not.toContain("Let me read");
  });

  it("returns empty string when stdout has no assistant messages", () => {
    expect(extractFinalText("")).toBe("");
    expect(extractFinalText("not json\n")).toBe("");
  });

  it("handles multiple text content parts", () => {
    const stdout = JSON.stringify({
      type: "message_end",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Part one." },
          { type: "text", text: "Part two." },
        ],
      },
    });

    const result = extractFinalText(stdout);
    expect(result).toContain("Part one.");
    expect(result).toContain("Part two.");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `pnpm run test -- src/subagent.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/subagent.test.ts
git commit -m "test: add extractFinalText coverage for pi JSON output parsing"
```

---

## Phase 2: Rewire `gcc_commit` to use the subagent

### Task 3: Refactor `executeGccCommit` to return task string instead of agent prompt

**Files:**

- Modify: `src/gcc-commit.ts`
- Modify: `src/gcc-commit.test.ts`

**Step 1: Update tests to reflect new behavior**

`executeGccCommit` now returns a task string for the subagent (which will read files itself), not a log dump for the main agent. Its job is simpler: build the task string and validate the branch has content.

```typescript
// Replace the existing executeGccCommit tests:

describe("executeGccCommit", () => {
  // ... same beforeEach/afterEach setup ...

  it("returns task string with branch name and summary", () => {
    branches.appendLog(
      "main",
      "## Turn 1 | 2026-02-22 | anthropic/claude\n\nDid some reasoning.\n"
    );

    const result = executeGccCommit(
      { summary: "First milestone" },
      state,
      branches
    );

    expect(result.task).toContain('branch "main"');
    expect(result.task).toContain("First milestone");
    expect(result.task).toContain(".gcc/branches/main/log.md");
    expect(result.task).toContain(".gcc/branches/main/commits.md");
    expect(result.task).toContain(".gcc/AGENTS.md");
    expect(result.isEmpty).toBe(false);
  });

  it("marks isEmpty when log has no entries", () => {
    const result = executeGccCommit(
      { summary: "Empty commit" },
      state,
      branches
    );

    expect(result.isEmpty).toBe(true);
    expect(result.task).toContain('branch "main"');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/gcc-commit.test.ts`
Expected: FAIL — `executeGccCommit` returns string, not object

**Step 3: Update `executeGccCommit`**

```typescript
import { buildCommitterTask } from "./subagent.js";
import type { BranchManager } from "./branches.js";
import { generateHash } from "./hash.js";
import type { GccState } from "./state.js";

interface GccCommitParams {
  summary: string;
  update_roadmap?: boolean;
}

interface CommitTaskResult {
  task: string;
  isEmpty: boolean;
}

/**
 * Build the subagent task string for commit distillation.
 * The subagent reads log.md and commits.md itself.
 */
export function executeGccCommit(
  params: GccCommitParams,
  state: GccState,
  branches: BranchManager
): CommitTaskResult {
  const branch = state.activeBranch;
  const log = branches.readLog(branch);
  const isEmpty = !log.trim();

  return {
    task: buildCommitterTask(branch, params.summary),
    isEmpty,
  };
}

// finalizeGccCommit stays exactly the same
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/gcc-commit.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/gcc-commit.ts src/gcc-commit.test.ts
git commit -m "refactor: executeGccCommit returns subagent task instead of agent prompt"
```

---

### Task 4: Move `extractCommitBlocks` from `commit-flow.ts` to `subagent.ts`

The `extractCommitBlocks` function is still needed — it parses the subagent's text response. But it belongs in `subagent.ts` now, not in the deleted `CommitFlowManager`.

**Files:**

- Modify: `src/subagent.ts` (add `extractCommitBlocks`)
- Modify: `src/subagent.test.ts` (add extraction tests — port from `commit-flow.test.ts`)

**Step 1: Port the relevant tests**

```typescript
import {
  buildCommitterTask,
  extractFinalText,
  extractCommitBlocks,
} from "./subagent.js";

describe("extractCommitBlocks", () => {
  it("extracts three commit blocks from text", () => {
    const text = [
      "### Branch Purpose",
      "Build the GCC extension for persistent agent memory.",
      "",
      "### Previous Progress Summary",
      "Completed Phase 1 foundation: YAML parser, state manager, hash generator.",
      "",
      "### This Commit's Contribution",
      "Added OTA formatter and branch manager modules with full test coverage.",
    ].join("\n");

    const result = extractCommitBlocks(text);
    expect(result).toContain("### Branch Purpose");
    expect(result).toContain("### Previous Progress Summary");
    expect(result).toContain("### This Commit's Contribution");
  });

  it("strips preamble and trailing text", () => {
    const text = [
      "I've reviewed the log and here is the commit:",
      "",
      "### Branch Purpose",
      "Build the GCC extension.",
      "",
      "### Previous Progress Summary",
      "Phase 1 done.",
      "",
      "### This Commit's Contribution",
      "Phase 2 tools implemented.",
      "",
      "Let me know if you want to adjust anything.",
    ].join("\n");

    const result = extractCommitBlocks(text);
    expect(result).not.toContain("I've reviewed");
    expect(result).not.toContain("Let me know");
    expect(result).toContain("### Branch Purpose");
  });

  it("returns null when blocks are missing", () => {
    expect(extractCommitBlocks("No commit blocks here.")).toBeNull();
    expect(
      extractCommitBlocks("### Branch Purpose\nOnly one block.")
    ).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test -- src/subagent.test.ts`
Expected: FAIL — `extractCommitBlocks` not exported

**Step 3: Move `extractCommitBlocks` from `commit-flow.ts` to `subagent.ts`**

Copy the function verbatim from `commit-flow.ts` into `subagent.ts` and export it.

**Step 4: Run tests to verify they pass**

Run: `pnpm run test -- src/subagent.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/subagent.ts src/subagent.test.ts
git commit -m "refactor: move extractCommitBlocks to subagent module"
```

---

### Task 5: Rewire `gcc_commit` tool handler in `index.ts`

**Files:**

- Modify: `src/index.ts`

**Step 1: Update the tool handler**

Replace the `gcc_commit` handler to spawn the subagent and finalize synchronously:

```typescript
// In index.ts, update the gcc_commit tool registration:

pi.registerTool({
  name: "gcc_commit",
  label: "GCC Commit",
  description: "Checkpoint a milestone in the agent's GCC memory.",
  parameters: Type.Object({
    summary: Type.String({ description: "Short summary of this checkpoint" }),
    update_roadmap: Type.Optional(Type.Boolean()),
  }),
  async execute(_toolCallId, params, signal) {
    if (!isGccReady(state, branchManager) || !branchManager) {
      return createTextResult(GCC_NOT_INITIALIZED_MESSAGE);
    }

    const { task, isEmpty } = executeGccCommit(params, state, branchManager);

    if (isEmpty) {
      // Still allow the commit — agent may have progress to record
    }

    const result = await spawnCommitter(state.cwd, task, signal);

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

    const message = finalizeGccCommit(
      params.summary,
      commitContent,
      state,
      branchManager
    );

    return createTextResult(message);
  },
});
```

Note: `state.cwd` doesn't exist — we need to get `cwd` from the `ExtensionContext`. The `execute` signature includes `ctx` as the 5th parameter. Use `ctx.cwd`.

```typescript
async execute(_toolCallId, params, signal, _onUpdate, ctx) {
  // ...
  const result = await spawnCommitter(ctx.cwd, task, signal);
  // ...
}
```

**Step 2: Remove CommitFlowManager import and instantiation**

Remove these lines from `index.ts`:

```typescript
// DELETE: import { CommitFlowManager } from "./commit-flow.js";
// DELETE: const commitFlow = new CommitFlowManager();
```

Add new imports:

```typescript
import { spawnCommitter, extractCommitBlocks } from "./subagent.js";
```

**Step 3: Remove the `agent_end` hook's commit logic**

Remove the entire `agent_end` handler:

```typescript
// DELETE the pi.on("agent_end", ...) block
```

**Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS (no references to `CommitFlowManager` or `commitFlow` remain)

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: rewire gcc_commit to use subagent instead of 2-step flow"
```

---

## Phase 3: Update tests and delete dead code

### Task 6: Update `index.test.ts` — remove `agent_end` commit test, update wiring assertions

**Files:**

- Modify: `src/index.test.ts`

**Step 1: Update the extension wiring test**

The extension should no longer register an `agent_end` handler (unless other hooks use it — check first). Update the assertion:

```typescript
// In "registers all GCC tools and required event handlers":
// Change:
expect(handlerNames).toContain("agent_end");
// To:
expect(handlerNames).not.toContain("agent_end");
```

**Step 2: Remove the `agent_end` commit finalization test**

Delete the entire test: `"finalizes pending commit on agent_end and notifies the user"`.

**Step 3: Add a new test for the subagent-based commit flow**

This test can't easily spawn a real subagent in unit tests. Instead, test that the tool handler returns an error when the subagent would fail (by running in a directory where `pi` isn't available or by mocking). At minimum, verify the tool returns `AgentToolResult` shape:

```typescript
it("gcc_commit returns error when subagent fails", async () => {
  const { projectDir, cleanup } = setupInitializedProject();
  try {
    const mockPi = createMockPi();
    activate(mockPi.api);

    const ui = createMockUi();
    const ctx = {
      cwd: projectDir,
      ui,
      sessionManager: {
        getSessionFile: () => "/tmp/pi-session-commit-fail.jsonl",
      },
    } as unknown as ExtensionContext;

    const sessionStart = getHandler(mockPi.handlers, "session_start");
    await sessionStart?.({ type: "session_start" }, ctx);

    const gccCommit = mockPi.tools.find((t) => t.name === "gcc_commit");
    expect(gccCommit).toBeDefined();

    // This will attempt to spawn pi, which may fail in test env
    // The important thing is it returns an AgentToolResult, not throws
    const result = await gccCommit?.execute(
      "tc-commit",
      { summary: "Test commit" },
      undefined,
      undefined,
      ctx
    );

    expect(result?.content[0]?.type).toBe("text");
    expect(result?.details).toStrictEqual({});
  } finally {
    cleanup();
  }
});
```

**Step 4: Run tests**

Run: `pnpm run test -- src/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/index.test.ts
git commit -m "test: update index tests for subagent commit flow, remove agent_end commit test"
```

---

### Task 7: Update `integration.test.ts`

**Files:**

- Modify: `src/integration.test.ts`

**Step 1: Update the integration test**

The integration test currently calls `executeGccCommit` and checks its return value contains "Commit Preparation" and turn counts. Update to reflect the new return type:

```typescript
const commitResult = executeGccCommit(
  { summary: "Implemented hook extractor modules" },
  state,
  branches
);
expect(commitResult.task).toContain('branch "phase-3-hooks"');
expect(commitResult.task).toContain("Implemented hook extractor modules");
expect(commitResult.isEmpty).toBe(false);
```

The rest of the integration test (calling `finalizeGccCommit` directly) stays the same — that function is unchanged.

**Step 2: Run tests**

Run: `pnpm run test -- src/integration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/integration.test.ts
git commit -m "test: update integration test for new executeGccCommit return type"
```

---

### Task 8: Delete `commit-flow.ts` and `commit-flow.test.ts`

**Files:**

- Delete: `src/commit-flow.ts`
- Delete: `src/commit-flow.test.ts`

**Step 1: Verify no remaining references**

Run: `grep -rn "commit-flow\|CommitFlowManager" src/ --include="*.ts"`
Expected: No results (all references removed in Tasks 5-6)

**Step 2: Delete the files**

```bash
rm src/commit-flow.ts src/commit-flow.test.ts
```

**Step 3: Run full test suite**

Run: `pnpm run test`
Expected: PASS — all tests pass, no import errors

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete commit-flow module (replaced by subagent)"
```

---

## Phase 4: Verification

### Task 9: Run full checks

**Step 1: Run the full validation suite**

Run: `pnpm run check`
Expected: All checks pass (lint, format, typecheck, tests, deadcode, duplicates)

**Step 2: Fix any issues**

Address any lint, type, or deadcode warnings. Common things to watch for:

- Unused imports from deleted `commit-flow.ts`
- `knip` flagging old exports
- Format issues from new code

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: fix lint/format/deadcode issues after subagent migration"
```

---

## Summary of changes

| Action | File                          | Description                                                                       |
| ------ | ----------------------------- | --------------------------------------------------------------------------------- |
| Create | `src/subagent.ts`             | `buildCommitterTask`, `spawnCommitter`, `extractFinalText`, `extractCommitBlocks` |
| Create | `src/subagent.test.ts`        | Tests for task building, JSON parsing, block extraction                           |
| Create | `.pi/agents/gcc-committer.md` | Subagent definition (already exists)                                              |
| Modify | `src/gcc-commit.ts`           | `executeGccCommit` returns `{ task, isEmpty }` instead of prompt string           |
| Modify | `src/gcc-commit.test.ts`      | Updated to test new return type                                                   |
| Modify | `src/index.ts`                | Remove `CommitFlowManager`, remove `agent_end` hook, rewire `gcc_commit` handler  |
| Modify | `src/index.test.ts`           | Remove `agent_end` test, update wiring assertions                                 |
| Modify | `src/integration.test.ts`     | Update `executeGccCommit` assertions                                              |
| Delete | `src/commit-flow.ts`          | Replaced by `src/subagent.ts`                                                     |
| Delete | `src/commit-flow.test.ts`     | Tests migrated to `src/subagent.test.ts`                                          |
