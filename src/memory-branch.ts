import type { BranchManager } from "./branches.js";
import type { MemoryState } from "./state.js";

interface MemoryBranchParams {
  name: string;
  purpose: string;
}

/**
 * Execute the memory_branch tool — create a new memory branch.
 */
export function executeMemoryBranch(
  params: MemoryBranchParams,
  state: MemoryState,
  branches: BranchManager
): string {
  const { name, purpose } = params;

  if (branches.branchExists(name)) {
    return `Branch "${name}" already exists. Use memory_switch to switch to it.`;
  }

  branches.createBranch(name, purpose);
  state.setActiveBranch(name);
  state.save();

  return `Created branch "${name}" and switched to it.\nPurpose: ${purpose}`;
}
