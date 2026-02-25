import type { BranchManager } from "./branches.js";
import { generateHash } from "./hash.js";
import type { GccState } from "./state.js";
import { buildCommitterTask } from "./subagent.js";

interface GccCommitParams {
  summary: string;
  update_roadmap?: boolean;
}

/**
 * Build the subagent task string for commit distillation.
 * The subagent reads log.md and commits.md itself.
 */
export function executeGccCommit(
  params: GccCommitParams,
  state: GccState,
  _branches: BranchManager
): { task: string } {
  const branch = state.activeBranch;

  return {
    task: buildCommitterTask(branch, params.summary),
  };
}

/**
 * Step 2: Write the agent's commit content to commits.md,
 * clear log.md, and update state.
 */
export function finalizeGccCommit(
  summary: string,
  commitContent: string,
  state: GccState,
  branches: BranchManager
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

  return `Commit ${hash} written to branch "${branch}".`;
}
