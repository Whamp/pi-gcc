# GCC Extension Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Build the GCC (Git Context Controller) extension — an agent-driven, version-controlled memory system that gives pi agents persistent, structured context across sessions, compactions, and model switches.

**Architecture:** The extension registers 5 tools (`gcc_commit`, `gcc_branch`, `gcc_merge`, `gcc_context`, `gcc_switch`) and hooks into pi's lifecycle events (`turn_end`, `before_agent_start`, `session_start`, `session_shutdown`, `session_before_compact`). Hooks are extracted into testable functions. File I/O operates on a `.gcc/` directory in the project root. A companion skill (`SKILL.md`) and init script (`gcc-init.sh`) are authored as static files and tested via automated bash execution.

**Tech Stack:** TypeScript, pi extension API (`@mariozechner/pi-coding-agent`), TypeBox schemas (`@sinclair/typebox`), Node `fs`/`child_process` modules, minimal flat YAML parser.

---

## Universal Verification Protocol (Apply to EVERY Task)

**Do not skip these steps.** Every task must follow this exact verification cycle:

1. **Write failing test first.**
2. **Run test to verify failure:** `pnpm run test -- <test-file>`
3. **Write implementation.**
4. **Run test to verify success:** `pnpm run test -- <test-file>`
   - **Recovery:** If FAIL, stop. Do not proceed to commit. Fix the implementation or the test until it passes. Use `systematic-debugging` if stuck.
5. **Run static checks:** `pnpm run check`
   - **Recovery:** If FAIL, fix all lint, formatting, deadcode, duplicate, or type errors before committing. The codebase must remain 100% clean at every commit.
6. **Commit** only when all the above pass.

**Lint constraints discovered during implementation:**

- **Types in `types.ts`**: The `@factory/types-file-organization` rule requires all exported interfaces and types to live in `src/types.ts`. Do not define exported types inline in implementation files — add them to `src/types.ts` and re-export from the implementation module if needed.
- **No immediate array mutation**: The `eslint-plugin-unicorn/no-immediate-mutation` rule disallows `push()` right after `const arr = []`. Initialize arrays with their first elements instead.
- **No relative parent imports**: The `eslint-plugin-import/no-relative-parent-imports` rule prevents subdirectory organization (e.g., `src/tools/`, `src/hooks/`). All source files must be flat in `src/`. Use descriptive file names: `src/gcc-context.ts`, `src/ota-logger.ts`, `src/commit-flow.ts`, etc.
- **No use before define**: Helper functions must be defined above the main exported function. Structure files as: helpers first, then builders, then the public `execute*` / `build*` function last.
- **No dead re-exports**: Re-exporting types from implementation files (e.g., `export type { X } from "./types.js"`) triggers knip dead-code detection if nobody imports via that path. Import types directly from `src/types.ts`.
- **Node.js imports allowed**: `eslint-plugin-import/no-nodejs-modules` is disabled for this project (Node.js extension).

---

## Phase 1: Foundation (State, File I/O, Init Script)

### Task 1: YAML Utility Module

Minimal YAML serializer/deserializer for `state.yaml`. Handles flat key-value pairs and one-level nested objects only — no list support. `metadata.yaml` is read/written as raw text (not through this parser), so list support is not needed.

> **Note:** `vi.spyOn` cannot mock ESM module exports (e.g., `node:crypto`). All tests in this project must use pure-function testing with mock _data_, not module-level mocking. The hook extractor pattern (Tasks 13-15) already follows this — keep it consistent.

**Files:**

- Create: `src/yaml.ts`
- Create: `src/yaml.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/yaml.test.ts
import { parseYaml, serializeYaml } from "./yaml.js";

describe("parseYaml", () => {
  it("parses flat key-value pairs", () => {
    const input = `active_branch: main\ninitialized: "2026-02-22T14:00:00Z"`;
    expect(parseYaml(input)).toEqual({
      active_branch: "main",
      initialized: "2026-02-22T14:00:00Z",
    });
  });

  it("parses nested objects (one level)", () => {
    const input = `last_commit:\n  branch: main\n  hash: a1b2c3d4\n  summary: "Decided X"`;
    expect(parseYaml(input)).toEqual({
      last_commit: { branch: "main", hash: "a1b2c3d4", summary: "Decided X" },
    });
  });

  it("returns empty object for empty or whitespace input", () => {
    expect(parseYaml("")).toEqual({});
    expect(parseYaml("  \n  ")).toEqual({});
  });
});

describe("serializeYaml", () => {
  it("serializes flat key-value pairs", () => {
    const obj = { active_branch: "main", initialized: "2026-02-22" };
    expect(serializeYaml(obj)).toBe(
      `active_branch: main\ninitialized: "2026-02-22"`
    );
  });

  it("serializes nested objects (one level)", () => {
    const obj = { last_commit: { branch: "main", hash: "a1b2c3d4" } };
    expect(serializeYaml(obj)).toBe(
      `last_commit:\n  branch: main\n  hash: a1b2c3d4`
    );
  });

  it("round-trips through parse and serialize", () => {
    const original = {
      active_branch: "main",
      last_commit: { branch: "main", hash: "abc" },
    };
    expect(parseYaml(serializeYaml(original))).toEqual(original);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/yaml.test.ts`

**Step 3: Write implementation**
Implement `parseYaml` and `serializeYaml` handling flat and one-level nested objects. Quote strings containing special characters or date-like formats.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/yaml.test.ts`
_(Recovery: Fix implementation until pass)_

**Step 5: Run checks and Commit**
Run: `pnpm run check`
_(Recovery: Fix lint/types until pass)_
Command: `git commit -m "feat: add minimal YAML parser/serializer"`

---

### Task 2: State Manager Module

Manages `.gcc/state.yaml`. Must handle partial state files gracefully.

**Files:**

- Create: `src/state.ts`
- Create: `src/state.test.ts`

**Step 1: Write the failing tests**
Include tests for:

- Loading valid `state.yaml`
- Loading when `state.yaml` is empty or malformed (should not crash, fallback to defaults)
- Updating active branch and last commit (including `timestamp`)
- `GccState.isInitialized` logic

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/state.test.ts`

**Step 3: Write implementation**
Implement `GccState` class wrapping `parseYaml` / `serializeYaml` with file read/write operations.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/state.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add GCC state manager"`

---

### Task 3: Commit Hash Generator

**Files:**

- Create: `src/hash.ts`
- Create: `src/hash.test.ts`

**Step 1: Write the failing tests**
Assert output is exactly 8 lowercase hex chars. Do **not** assert strict uniqueness across 1000 random iterations (flaky with 32-bit hashes). Do **not** use `vi.spyOn` on ESM module exports (it throws `Cannot redefine property` in ESM). Instead, test observable behavior: format, length, and that successive calls produce varying output.

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/hash.test.ts`

**Step 3: Write implementation**
Use `node:crypto` `randomBytes(4).toString("hex")`.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/hash.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add commit hash generator"`

---

### Task 4: Branch Manager Module

Handles `.gcc/branches/` directory operations. Needs strong edge-case handling.

**Files:**

- Create: `src/branches.ts`
- Create: `src/branches.test.ts`

**Step 1: Write the failing tests**
Include tests for:

- Creating a branch creates `log.md`, `commits.md`, `metadata.yaml`.
- Appending log entries and commit entries.
- Reading logs/commits returns `""` if file missing.
- `listBranches` safely ignores non-directories in `.gcc/branches/`.
- `getLogTurnCount` accurately counts `^## Turn ` occurrences.
- `getLatestCommit` safely handles empty `commits.md` or files with only a header.

> **Note on `metadata.yaml`:** This file is agent-managed free-form content. The branch manager creates it as an empty file. It is read/written as raw text — not parsed through the YAML module. The `gcc_context` tool (Task 8) extracts segments via regex on the raw text.

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/branches.test.ts`

**Step 3: Write implementation**
Implement `BranchManager`.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/branches.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add branch manager"`

---

### Task 5: OTA Log Formatter

**Files:**

- Create: `src/ota-formatter.ts`
- Create: `src/ota-formatter.test.ts`

**Step 1: Write the failing tests**
Test full turn formatting, omitted thinking block (if empty), omitted action/observation (if no tools called).

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/ota-formatter.test.ts`

**Step 3: Write implementation**
Implement `formatOtaEntry` matching the GCC spec.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/ota-formatter.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add OTA log entry formatter"`

---

### Task 6: Init Script & Automated Test

Write the bash script, markdown templates, and an automated integration test.

**Files:**

- Create: `skills/gcc/scripts/gcc-init.sh`
- Create: `skills/gcc/SKILL.md`
- Create: `skills/gcc/templates/agents-md.md`
- Create: `skills/gcc/templates/root-agents-section.md`
- Create: `src/init-script.test.ts`

**Step 1: Write the automated test first**

```typescript
// src/init-script.test.ts
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

describe("gcc-init.sh", () => {
  it("initializes project structure", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-init-test-"));
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const scriptPath = path.resolve(
      testDir,
      "../skills/gcc/scripts/gcc-init.sh"
    );

    try {
      // Execute script in tmpDir
      execFileSync("bash", [scriptPath], { cwd: tmpDir });

      expect(fs.existsSync(path.join(tmpDir, ".gcc/state.yaml"))).toBe(true);
      expect(
        fs.existsSync(path.join(tmpDir, ".gcc/branches/main/log.md"))
      ).toBe(true);

      // test idempotency
      execFileSync("bash", [scriptPath], { cwd: tmpDir });
      expect(
        fs
          .readFileSync(path.join(tmpDir, "AGENTS.md"), "utf-8")
          .match(/## GCC/g)?.length
      ).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/init-script.test.ts`

**Step 3: Write scripts and templates**
Implement `gcc-init.sh` and the templates as specified in the previous plan.
**CRITICAL:** In `SKILL.md`:

1. Explicitly instruct the agent on how to run the script using the absolute path derived from the skill's location: _"To initialize GCC, run the init script using the absolute path derived from this skill's location. Example: `bash $(dirname "/path/to/this/SKILL.md")/scripts/gcc-init.sh`"_
2. Instruct the agent: _"Always call `gcc_context --branch <target>` to review the history BEFORE calling `gcc_merge`."_

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/init-script.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add gcc-init script and automated verification test"`

---

## Phase 2: Core Utilities & Tools

### Task 7: AGENTS.md Updater

Used by commit and merge tools to update the root `AGENTS.md` file.

**Files:**

- Create: `src/agents-md.ts`
- Create: `src/agents-md.test.ts`

**Step 1: Write the failing tests**
Ensure regex correctly replaces existing GCC sections without touching surrounding content, appends if missing, and creates the file if `AGENTS.md` doesn't exist.

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/agents-md.test.ts`

**Step 3: Write implementation**
Implement `updateRootAgentsMd(projectDir, branch, summary)`.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/agents-md.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add AGENTS.md updater utility"`

---

### Task 8: `gcc_context` Tool

**Files:** `src/tools/gcc-context.ts`, `src/tools/gcc-context.test.ts`
Implement read-only context retrieval. Test all 5 levels (`status`, `branch`, `commit`, `log`, `metadata`).
**CRITICAL:** The `metadata` level reads `metadata.yaml` as **raw text**, not through the YAML parser. When extracting segments, do not rely on indentation regex (which breaks on nested YAML). Extract everything from `^segment:` until the next top-level key (`^(?=[a-zA-Z0-9_-]+:)`) or EOF. This is intentional — `metadata.yaml` contains arbitrary agent-written content that may exceed the YAML parser's flat/one-level subset.
**Verification:** `pnpm run test -- src/tools/gcc-context.test.ts` then `pnpm run check`. Commit.

### Task 9: `gcc_branch` Tool

**Files:** `src/tools/gcc-branch.ts`, `src/tools/gcc-branch.test.ts`
Implement branch creation. Test for success and duplicate branch rejection.
**Verification:** `pnpm run test -- src/tools/gcc-branch.test.ts` then `pnpm run check`. Commit.

### Task 10: `gcc_switch` Tool

**Files:** `src/gcc-switch.ts`, `src/gcc-switch.test.ts`
Implement branch switching. Test success and nonexistent branch rejection.
**Verification:** `pnpm run test -- src/gcc-switch.test.ts` then `pnpm run check`. Commit.

### Task 11: `gcc_commit` Tool

**Files:** `src/gcc-commit.ts`, `src/gcc-commit.test.ts`
Implement the 2-step commit process logic (`executeGccCommit` for prompt, `finalizeGccCommit` for writing). Uses `updateRootAgentsMd`.
**Verification:** `pnpm run test -- src/gcc-commit.test.ts` then `pnpm run check`. Commit.

### Task 12: `gcc_merge` Tool

**Files:** `src/gcc-merge.ts`, `src/gcc-merge.test.ts`
Implement merging. Reject merging into self, reject missing branches. Uses `updateRootAgentsMd`.
**CRITICAL:** Ignore the spec's requirement that the tool "automatically call gcc*context". It is logically impossible since the user must provide `synthesis` upfront. Instead, update `SKILL.md` (in Task 6) to instruct the agent: *"Always call `gcc_context --branch <target>` to review the history BEFORE calling `gcc_merge`."\_
**Verification:** `pnpm run test -- src/gcc-merge.test.ts` then `pnpm run check`. Commit.

---

## Phase 3: Hook Extractors & Wiring

To ensure 100% testability, extension hook logic is extracted into pure functions/classes that can be tested without mocking the complex `ExtensionAPI`.

### Task 13: OTA Logger Hook Extractor

Extracts `TurnEndEvent` processing logic into a pure function testable without the extension runtime.

**Files:**

- Create: `src/ota-logger.ts`
- Create: `src/ota-logger.test.ts`

**API shape (from `@mariozechner/pi-coding-agent`):**

```typescript
TurnEndEvent = {
  type: "turn_end";
  turnIndex: number;                    // 0-based
  message: AgentMessage;                // Union — guard for role === "assistant"
  toolResults: ToolResultMessage[];     // Separate from message.content
}

AssistantMessage = {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  provider: string;   // e.g. "anthropic"
  model: string;      // e.g. "claude-sonnet-4-20250514"
  timestamp: number;  // epoch ms
}

ToolResultMessage = {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: unknown;
  isError: boolean;
}
```

**Step 1: Write the failing tests**
Create mock `TurnEndEvent` data (plain objects matching the shapes above — no need to import actual types for test data). Test `extractOtaInput(event)`:

- Returns correct `OtaEntryInput` with `turnNumber = turnIndex + 1`, timestamp from `new Date(message.timestamp).toISOString()`, model as `provider/model`.
- Extracts text from `TextContent` items, thinking from `ThinkingContent` items.
- Extracts tool call summaries from `ToolCall` items in message content: `"name(key-arg)"`.
- Extracts tool result summaries from `toolResults`: `"name: success/fail, detail"`.
- Returns `null` when `message.role !== "assistant"` (e.g., custom messages).
- Returns `null` when message has no text content and no tool calls (empty turn).

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/ota-logger.test.ts`

**Step 3: Write implementation**
Implement `extractOtaInput`. Guard `message.role === "assistant"`. Iterate `message.content` filtering by `type` field (`"text"`, `"thinking"`, `"toolCall"`). Process `toolResults` separately.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/ota-logger.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add OTA logger hook extractor"`

---

### Task 14: Context Injector Hook Extractor

Builds the context injection message for `before_agent_start`.

**Files:**

- Create: `src/context-injector.ts`
- Create: `src/context-injector.test.ts`

**API shape:** The `before_agent_start` handler returns a `BeforeAgentStartEventResult`:

```typescript
{
  message?: {
    customType: string;   // e.g. "gcc_context_injection"
    content: string;      // Markdown with GCC state
    display: boolean;     // false — injected into LLM context, not shown in UI
    details?: unknown;
  }
}
```

**Step 1: Write the failing tests**
Test `buildContextInjection(state, branches)`:

- Returns a result object with `message.content` containing active branch name, latest commit summary, and uncommitted turn count.
- Returns `null` when GCC is not initialized (`state.isInitialized === false`).
- Sets `message.display = false` and `message.customType = "gcc_context_injection"`.

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/context-injector.test.ts`

**Step 3: Write implementation**
Implement `buildContextInjection`. Return `null` if not initialized. Otherwise return the result object with a markdown content string.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/context-injector.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add context injector hook logic"`

---

### Task 15: Commit Flow Hook Extractor

Manages the 2-step commit flow state.

**Files:**

- Create: `src/commit-flow.ts`
- Create: `src/commit-flow.test.ts`

**API shape:** The `agent_end` event provides the full conversation:

```typescript
AgentEndEvent = {
  type: "agent_end";
  messages: AgentMessage[];  // Full message array — not just the latest
}
```

To find the agent's commit response, search the **last** `AssistantMessage` in the array (where `role === "assistant"`) for the `### Branch Purpose` / `### This Commit's Contribution` blocks.

**Step 1: Write the failing tests**
Test `CommitFlowManager`:

1. `setPendingCommit(summary)` — stores pending state.
2. `hasPending()` — returns true when a commit is pending.
3. `handleAgentEnd(messages)` — given a mock `AgentMessage[]` where the last assistant message contains the three commit blocks, returns `{ summary, commitContent }` and resets pending state.
4. `handleAgentEnd(messages)` — returns `null` when no commit is pending.
5. `handleAgentEnd(messages)` — returns `null` when the last assistant message does not contain commit blocks (agent didn't respond with commit content).

Test extraction against mock assistant messages containing `TextContent` items with `### Branch Purpose`, `### Previous Progress Summary`, `### This Commit's Contribution`.

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/commit-flow.test.ts`

**Step 3: Write implementation**
Implement `CommitFlowManager`.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/commit-flow.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: add commit flow manager hook logic"`

---

### Task 16: Extension Entry Point

Wire the tested components into `pi.registerTool` and `pi.on`.

**Files:**

- Modify: `src/index.ts`
- Modify: `src/index.test.ts` (or create `src/index.wiring.test.ts`)

**Step 1: Write the failing tests first**
Add focused wiring tests that fail against the scaffold and verify:

- all 5 tools are registered (`gcc_commit`, `gcc_branch`, `gcc_merge`, `gcc_context`, `gcc_switch`)
- handlers are registered for `turn_end`, `before_agent_start`, `agent_end`, `session_start`, `session_shutdown`, `session_before_compact`, and `resources_discover`
- tool execute handlers return `AgentToolResult` shape (`content` + `details`) and guard when GCC is uninitialized
- `gcc_commit` execute path sets pending commit state; `agent_end` consumes it and finalizes commit
- `agent_end` success path shows a user notification (`ctx.ui.notify`) after finalization (no extra follow-up agent turn)
- `resources_discover` returns GCC skill path via ESM-safe resolution (`import.meta.url`, not `__dirname`)

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/index.test.ts`
_(or `pnpm run test -- src/index.wiring.test.ts` if split)_

**Step 3: Write implementation**
Replace the scaffold.

- Declare `let state: GccState | null = null`, `let branchManager: BranchManager | null = null`, `const commitFlow = new CommitFlowManager()`.
- Register 5 tools via `pi.registerTool` with `TypeBox` schemas.
  - Each tool `execute` must return `AgentToolResult` shape: `{ content: [{ type: "text", text: result }], details: {} }`.
  - Each tool wrapper delegates to `src/gcc-*.ts` functions, passing `ctx.cwd` as `projectDir` where needed.
  - Guard when `state/branchManager` are `null` or not initialized: return a clear message (`"GCC not initialized. Run gcc-init.sh first."`).
- Wire `turn_end` to `extractOtaInput` -> `formatOtaEntry` -> `branchManager.appendLog` (skip if GCC not initialized).
- Wire `before_agent_start` to `buildContextInjection` and return the result directly (skip if GCC not initialized).
- Wire `agent_end` to `commitFlow.handleAgentEnd`. If it returns data, call `finalizeGccCommit(...)`, then notify via `ctx.ui.notify(...)`.
- Wire `gcc_commit` tool execution to both:
  - call `executeGccCommit(...)` (returns log contents for agent distillation)
  - call `commitFlow.setPendingCommit(params.summary)` to arm step 2 extraction in `agent_end`
- Wire `session_start`: create/load `state` and `branchManager` using `ctx.cwd`; show current GCC status via `ctx.ui.notify`.
- Wire `session_shutdown`: if initialized, check for uncommitted turns and notify user.
- Wire `session_before_compact`: if initialized, append a GCC state reminder to `event.customInstructions` (do not cancel/override compaction).
- Wire `resources_discover`: return GCC skill path using ESM-safe path resolution (`fileURLToPath(import.meta.url)` + `path.dirname(...)`), not `__dirname`.

> **Deferred: Session tracking.** The spec originally called for `session_start` to register sessions in `state.yaml`. This is deferred for v1 because the YAML parser does not support lists and no tool or hook depends on session tracking data. The `session_start` hook should only check for `.gcc/` and display a notification with current GCC state — no state.yaml writes.

**Step 4: Run Typecheck and Tests**
Run: `pnpm run test -- src/index.test.ts`
_(or `pnpm run test -- src/index.wiring.test.ts` if split)_
Run: `pnpm run test` (Ensures nothing else broke)
Run: `pnpm run typecheck` (Ensures extension API types match)

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "feat: wire all tools and hooks into extension entry point"`

---

## Phase 4: Integration & Polish

### Task 17: Module Integration Tests

Test the state, branches, and tools operating together against a real filesystem.

**Files:**

- Create: `src/integration.test.ts`

**Step 1: Write the failing tests**
Write a single end-to-end test that creates a temp dir, initializes state, executes `gccBranch`, logs some OTA entries, executes `gccCommit`, and executes `gccContext` to verify the state chain holds together.

**Step 2: Run test to verify it fails**
Run: `pnpm run test -- src/integration.test.ts`

**Step 3: Write implementation**
Fix any integration bugs discovered between modules.

**Step 4: Run test to verify it passes**
Run: `pnpm run test -- src/integration.test.ts`

**Step 5: Run checks and Commit**
Run: `pnpm run check`
Command: `git commit -m "test: add module integration tests"`

---

### Task 18: Manual Integration Test

Test the full extension end-to-end interactively.

1. Start pi: `pi -e ./src/index.ts`
2. Ask the agent to initialize GCC. Verify `.gcc/` is created and AGENTS.md is updated.
3. Have the agent perform some tool calls. Verify `log.md` populates.
4. Ask the agent to run `gcc_commit` with a summary. Verify it completes the 2-step flow.
5. Exit pi and restart. Verify the GCC notification appears on load.

---

### Task 19: Final Check Suite

Run the full validation suite to ensure no edge cases were missed.

```bash
pnpm run check
```

If anything fails, fix and commit.
Command: `git commit -m "chore: polish and finalize GCC extension"`
