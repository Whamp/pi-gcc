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
import { executeGccBranch } from "./gcc-branch.js";
import { executeGccCommit, finalizeGccCommit } from "./gcc-commit.js";
import { executeGccContext } from "./gcc-context.js";
import { executeGccMerge } from "./gcc-merge.js";
import { executeGccSwitch } from "./gcc-switch.js";
import { formatOtaEntry } from "./ota-formatter.js";
import { extractOtaInput } from "./ota-logger.js";
import { GccState } from "./state.js";
import { extractCommitBlocks, spawnCommitter } from "./subagent.js";

const GCC_NOT_INITIALIZED_MESSAGE =
  "GCC not initialized. Run gcc-init.sh first.";

function createTextResult(text: string): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text }],
    details: {},
  };
}

function isGccReady(
  state: GccState | null,
  branchManager: BranchManager | null
): state is GccState {
  return state !== null && branchManager !== null && state.isInitialized;
}

function upsertCurrentSession(state: GccState, ctx: ExtensionContext): void {
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
  state: GccState,
  branchManager: BranchManager
): string {
  const branch = state.activeBranch;
  const turns = branchManager.getLogTurnCount(branch);
  const summary = state.lastCommit?.summary ?? "No commits yet";

  return [
    `GCC memory active on branch "${branch}".`,
    `${turns} uncommitted turn${turns === 1 ? "" : "s"} in .gcc/branches/${branch}/log.md.`,
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
  return path.resolve(currentDir, "../skills/gcc");
}

export default function activate(pi: ExtensionAPI) {
  let state: GccState | null = null;
  let branchManager: BranchManager | null = null;

  pi.registerTool({
    name: "gcc_context",
    label: "GCC Context",
    description: "Retrieve GCC memory status overview.",
    parameters: Type.Object({
      level: Type.Optional(Type.String()),
      branch: Type.Optional(Type.String()),
      commit: Type.Optional(Type.String()),
      segment: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isGccReady(state, branchManager) || !branchManager) {
        return createTextResult(GCC_NOT_INITIALIZED_MESSAGE);
      }

      return createTextResult(
        executeGccContext(params, state, branchManager, ctx.cwd)
      );
    },
  });

  pi.registerTool({
    name: "gcc_branch",
    label: "GCC Branch",
    description: "Create a new GCC memory branch.",
    parameters: Type.Object({
      name: Type.String({ description: "Branch name" }),
      purpose: Type.String({ description: "Why this branch exists" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isGccReady(state, branchManager) || !branchManager) {
        return createTextResult(GCC_NOT_INITIALIZED_MESSAGE);
      }

      const previousBranch = state.activeBranch;
      const result = executeGccBranch(params, state, branchManager);

      if (state.activeBranch !== previousBranch) {
        upsertCurrentSession(state, ctx);
      }

      return createTextResult(result);
    },
  });

  pi.registerTool({
    name: "gcc_switch",
    label: "GCC Switch",
    description: "Switch to another GCC memory branch.",
    parameters: Type.Object({
      branch: Type.String({ description: "Target branch name" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isGccReady(state, branchManager) || !branchManager) {
        return createTextResult(GCC_NOT_INITIALIZED_MESSAGE);
      }

      const previousBranch = state.activeBranch;
      const result = executeGccSwitch(params, state, branchManager);

      if (state.activeBranch !== previousBranch) {
        upsertCurrentSession(state, ctx);
      }

      return createTextResult(result);
    },
  });

  pi.registerTool({
    name: "gcc_merge",
    label: "GCC Merge",
    description: "Merge insights from one GCC branch into the active branch.",
    parameters: Type.Object({
      branch: Type.String({ description: "Source branch to merge from" }),
      synthesis: Type.String({
        description: "Synthesized insight from source branch",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      if (!isGccReady(state, branchManager) || !branchManager) {
        return createTextResult(GCC_NOT_INITIALIZED_MESSAGE);
      }

      return createTextResult(executeGccMerge(params, state, branchManager));
    },
  });

  pi.registerTool({
    name: "gcc_commit",
    label: "GCC Commit",
    description: "Checkpoint a milestone in the agent's GCC memory.",
    parameters: Type.Object({
      summary: Type.String({ description: "Short summary of this checkpoint" }),
      update_roadmap: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!isGccReady(state, branchManager) || !branchManager) {
        return createTextResult(GCC_NOT_INITIALIZED_MESSAGE);
      }

      const { task, isEmpty } = executeGccCommit(params, state, branchManager);

      if (isEmpty) {
        // Still allow — agent may have progress to record
      }

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

      const message = finalizeGccCommit(
        params.summary,
        commitContent,
        state,
        branchManager
      );

      return createTextResult(message);
    },
  });

  pi.on("session_start", (_event, ctx) => {
    state = new GccState(ctx.cwd);
    state.load();
    branchManager = new BranchManager(ctx.cwd);

    if (!state.isInitialized) {
      return;
    }

    upsertCurrentSession(state, ctx);

    const turnCount = branchManager.getLogTurnCount(state.activeBranch);
    ctx.ui.notify(
      `GCC active: branch "${state.activeBranch}" (${turnCount} uncommitted turn${turnCount === 1 ? "" : "s"}).`,
      "info"
    );
  });

  pi.on("resources_discover", () => ({
    skillPaths: [resolveSkillPath()],
  }));

  pi.on("turn_end", (event) => {
    if (!isGccReady(state, branchManager) || !branchManager) {
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
    if (!isGccReady(state, branchManager) || !branchManager) {
      return;
    }

    const reminder = buildCompactionReminder(state, branchManager);
    appendCompactionReminder(event, reminder);
  });
}
