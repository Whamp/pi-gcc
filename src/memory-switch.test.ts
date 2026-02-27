import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";
import { executeMemorySwitch } from "./memory-switch.js";
import { MemoryState } from "./state.js";

describe("executeMemorySwitch", () => {
  let tmpDir: string;
  let state: MemoryState;
  let branches: BranchManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-switch-test-"));
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
    branches.createBranch("feature-x", "Explore feature X");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should switch to an existing branch", () => {
    // Act
    const result = executeMemorySwitch(
      { branch: "feature-x" },
      state,
      branches
    );

    // Assert
    expect(state.activeBranch).toBe("feature-x");
    expect(result).toContain("feature-x");
  });

  it("should return latest commit summary for orientation", () => {
    // Arrange
    const entry =
      "\n---\n\n## Commit a1b2c3d4 | 2026-02-22\n\n### Branch Purpose\n\nExplore feature X\n\n### This Commit's Contribution\n\nDetermined Redis is viable.\n";
    branches.appendCommit("feature-x", entry);

    // Act
    const result = executeMemorySwitch(
      { branch: "feature-x" },
      state,
      branches
    );

    // Assert
    expect(result).toContain("Determined Redis is viable.");
  });

  it("should reject switching to nonexistent branch", () => {
    // Act
    const result = executeMemorySwitch({ branch: "nope" }, state, branches);

    // Assert
    expect(result).toContain("not found");
    expect(state.activeBranch).toBe("main");
  });
});
