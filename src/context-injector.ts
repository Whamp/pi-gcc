/**
 * Builds the context injection message for before_agent_start.
 * Pure function — returns a BeforeAgentStartEventResult-compatible object
 * or null if GCC is not initialized.
 */

import type { BranchManager } from "./branches.js";
import type { GccState } from "./state.js";

interface ContextInjectionResult {
  message: {
    customType: string;
    content: string;
    display: boolean;
  };
}

function buildContent(state: GccState, branches: BranchManager): string {
  const branch = state.activeBranch;
  const turnCount = branches.getLogTurnCount(branch);

  const lines = [`**GCC Active Branch:** ${branch}`];

  if (state.lastCommit) {
    lines.push(
      `**Latest Commit:** ${state.lastCommit.summary} (${state.lastCommit.hash}, ${state.lastCommit.timestamp})`
    );
  } else {
    lines.push("**Latest Commit:** None");
  }

  if (turnCount > 0) {
    lines.push(
      `**Uncommitted Turns:** ${turnCount} turn${turnCount === 1 ? "" : "s"} since last commit`
    );
  }

  return lines.join("\n");
}

export function buildContextInjection(
  state: GccState,
  branches: BranchManager
): ContextInjectionResult | null {
  if (!state.isInitialized) {
    return null;
  }

  return {
    message: {
      customType: "gcc_context_injection",
      content: buildContent(state, branches),
      display: false,
    },
  };
}
