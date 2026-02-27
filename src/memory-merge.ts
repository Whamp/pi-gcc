import type { BranchManager } from "./branches.js";
import { generateHash } from "./hash.js";
import type { MemoryState } from "./state.js";

interface MemoryMergeParams {
  branch: string;
  synthesis: string;
}

/**
 * Execute the memory_merge tool — synthesize a branch back into the current branch.
 * The agent should call memory_status BEFORE calling this.
 */
export function executeMemoryMerge(
  params: MemoryMergeParams,
  state: MemoryState,
  branches: BranchManager
): string {
  const { branch: sourceBranch, synthesis } = params;
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
