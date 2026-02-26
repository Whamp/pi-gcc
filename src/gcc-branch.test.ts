import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";
import { executeGccBranch } from "./gcc-branch.js";
import { GccState } from "./state.js";

describe("executeGccBranch", () => {
  let tmpDir: string;
  let state: GccState;
  let branches: BranchManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-branch-tool-test-"));
    const gccDir = path.join(tmpDir, ".gcc");
    fs.mkdirSync(path.join(gccDir, "branches"), { recursive: true });

    fs.writeFileSync(
      path.join(gccDir, "state.yaml"),
      'active_branch: main\ninitialized: "2026-02-22T14:00:00Z"'
    );

    state = new GccState(tmpDir);
    state.load();
    branches = new BranchManager(tmpDir);
    branches.createBranch("main", "Main branch");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create a new branch and switch to it", () => {
    // Act
    const result = executeGccBranch(
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
    executeGccBranch(
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
    const result = executeGccBranch(
      { name: "main", purpose: "Duplicate" },
      state,
      branches
    );

    // Assert
    expect(result).toContain("already exists");
  });
});
