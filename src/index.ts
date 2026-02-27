import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  SessionBeforeCompactEvent,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { BranchManager } from "./branches.js";
import { LOG_SIZE_WARNING_BYTES } from "./constants.js";
import { executeMemoryBranch } from "./memory-branch.js";
import { executeMemoryCommit, finalizeMemoryCommit } from "./memory-commit.js";
import { executeMemoryStatus } from "./memory-context.js";
import { executeMemoryMerge } from "./memory-merge.js";
import { executeMemorySwitch } from "./memory-switch.js";
import { formatOtaEntry } from "./ota-formatter.js";
import { extractOtaInput } from "./ota-logger.js";
import { MemoryState } from "./state.js";
import { extractCommitBlocks, spawnCommitter } from "./subagent.js";

const MEMORY_NOT_INITIALIZED_MESSAGE =
  "Brain not initialized. Run brain-init.sh first.";

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

function resolveSkillPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "../skills/brain");
}

export default function activate(pi: ExtensionAPI) {
  let state: MemoryState | null = null;
  let branchManager: BranchManager | null = null;

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

  pi.registerTool({
    name: "memory_status",
    label: "Memory Status",
    description: "Retrieve agent memory status overview.",
    parameters: Type.Object({
      level: Type.Optional(Type.String()),
      branch: Type.Optional(Type.String()),
      commit: Type.Optional(Type.String()),
      segment: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (
        !tryLoad(ctx) ||
        !isMemoryReady(state, branchManager) ||
        !branchManager
      ) {
        return createTextResult(MEMORY_NOT_INITIALIZED_MESSAGE);
      }

      return createTextResult(
        executeMemoryStatus(params, state, branchManager, ctx.cwd)
      );
    },
  });

  pi.registerTool({
    name: "memory_branch",
    label: "Memory Branch",
    description: "Create a new memory branch.",
    parameters: Type.Object({
      name: Type.String({ description: "Branch name" }),
      purpose: Type.String({ description: "Why this branch exists" }),
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
      const result = executeMemoryBranch(params, state, branchManager);

      if (state.activeBranch !== previousBranch) {
        upsertCurrentSession(state, ctx);
      }

      return createTextResult(result);
    },
  });

  pi.registerTool({
    name: "memory_switch",
    label: "Memory Switch",
    description: "Switch to another memory branch.",
    parameters: Type.Object({
      branch: Type.String({ description: "Target branch name" }),
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
      const result = executeMemorySwitch(params, state, branchManager);

      if (state.activeBranch !== previousBranch) {
        upsertCurrentSession(state, ctx);
      }

      return createTextResult(result);
    },
  });

  pi.registerTool({
    name: "memory_merge",
    label: "Memory Merge",
    description:
      "Merge insights from one memory branch into the active branch.",
    parameters: Type.Object({
      branch: Type.String({ description: "Source branch to merge from" }),
      synthesis: Type.String({
        description: "Synthesized insight from source branch",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (
        !tryLoad(ctx) ||
        !isMemoryReady(state, branchManager) ||
        !branchManager
      ) {
        return createTextResult(MEMORY_NOT_INITIALIZED_MESSAGE);
      }

      return createTextResult(executeMemoryMerge(params, state, branchManager));
    },
  });

  pi.registerTool({
    name: "memory_commit",
    label: "Memory Commit",
    description: "Checkpoint a milestone in agent memory.",
    parameters: Type.Object({
      summary: Type.String({ description: "Short summary of this checkpoint" }),
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
        branchManager
      );

      return createTextResult(message);
    },
  });

  pi.on("session_start", (_event, ctx) => {
    state = new MemoryState(ctx.cwd);
    state.load();
    branchManager = new BranchManager(ctx.cwd);

    if (!state.isInitialized) {
      return;
    }

    upsertCurrentSession(state, ctx);

    const turnCount = branchManager.getLogTurnCount(state.activeBranch);
    const logSizeBytes = branchManager.getLogSizeBytes(state.activeBranch);

    if (logSizeBytes >= LOG_SIZE_WARNING_BYTES) {
      const sizeKB = Math.round(logSizeBytes / 1024);
      ctx.ui.notify(
        `Brain: log.md is large (${sizeKB} KB). You should commit to distill this into structured memory.`,
        "warning"
      );
    } else {
      ctx.ui.notify(
        `Brain active: branch "${state.activeBranch}" (${turnCount} uncommitted turn${turnCount === 1 ? "" : "s"}).`,
        "info"
      );
    }
  });

  pi.on("resources_discover", () => ({
    skillPaths: [resolveSkillPath()],
  }));

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
