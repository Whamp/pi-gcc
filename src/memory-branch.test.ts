import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";
import { executeMemoryBranch } from "./memory-branch.js";
import { MemoryState } from "./state.js";

describe("executeMemoryBranch", () => {
  let tmpDir: string;
  let state: MemoryState;
  let branches: BranchManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-branch-tool-test-"));
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
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create a new branch and switch to it", () => {
    // Act
    const result = executeMemoryBranch(
      { name: "explore-redis", purpose: "Evaluate Redis as a caching layer" },
      state,
      branches
    );

    // Assert
    expect(result).toContain("explore-redis");
    expect(branches.branchExists("explore-redis")).toBeTruthy();
    expect(state.activeBranch).toBe("explore-redis");
  });

  it("should initialize commits.md with branch purpose", () => {
    // Act
    executeMemoryBranch(
      { name: "explore-redis", purpose: "Evaluate Redis as a caching layer" },
      state,
      branches
    );

    // Assert
    const commits = branches.readCommits("explore-redis");
    expect(commits).toContain("Evaluate Redis as a caching layer");
  });

  it("should reject duplicate branch names", () => {
    // Act
    const result = executeMemoryBranch(
      { name: "main", purpose: "Duplicate" },
      state,
      branches
    );

    // Assert
    expect(result).toContain("already exists");
  });
});
