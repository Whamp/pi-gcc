import type { BranchManager } from "./branches.js";
import type { MemoryState } from "./state.js";

interface MemorySwitchParams {
  branch: string;
}

/**
 * Execute the memory_switch tool — switch the active memory branch.
 */
export function executeMemorySwitch(
  params: MemorySwitchParams,
  state: MemoryState,
  branches: BranchManager
): string {
  const { branch } = params;

  if (!branches.branchExists(branch)) {
    return `Branch "${branch}" not found. Available branches: ${branches.listBranches().join(", ")}`;
  }

  state.setActiveBranch(branch);
  state.save();

  const latest = branches.getLatestCommit(branch);
  const summary = latest ?? "No commits yet.";

  return `Switched to branch "${branch}".\n\n${summary}`;
}
