import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";
import { executeMemoryMerge } from "./memory-merge.js";
import { MemoryState } from "./state.js";

describe("executeMemoryMerge", () => {
  let tmpDir: string;
  let state: MemoryState;
  let branches: BranchManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-merge-test-"));
    const memoryDir = path.join(tmpDir, ".memory");
    fs.mkdirSync(path.join(memoryDir, "branches"), { recursive: true });

    fs.writeFileSync(
      path.join(memoryDir, "state.yaml"),
      'active_branch: main\ninitialized: "2026-02-22T14:00:00Z"'
    );
    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# Project\n");

    state = new MemoryState(tmpDir);
    state.load();
    branches = new BranchManager(tmpDir);
    branches.createBranch("main", "Main branch");
    branches.createBranch("explore-redis", "Evaluate Redis as caching layer");

    // Add a commit to the source branch
    const entry =
      "\n---\n\n## Commit a1b2c3d4 | 2026-02-22\n\n### Branch Purpose\n\nEvaluate Redis\n\n### This Commit's Contribution\n\nRedis is viable for our use case.\n";
    branches.appendCommit("explore-redis", entry);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should append a merge commit to the current branch", () => {
    // Act
    const result = executeMemoryMerge(
      {
        branch: "explore-redis",
        synthesis:
          "Redis confirmed as caching layer. Will use for session storage.",
      },
      state,
      branches
    );

    // Assert
    expect(result).toContain("Merge commit");
    const commits = branches.readCommits("main");
    expect(commits).toContain("Merge from explore-redis");
    expect(commits).toContain("Redis confirmed as caching layer");
  });

  it("should generate a valid hash in the merge commit", () => {
    // Act
    executeMemoryMerge(
      { branch: "explore-redis", synthesis: "Redis is good." },
      state,
      branches
    );

    // Assert
    const commits = branches.readCommits("main");
    const hashMatch = /## Commit ([a-f0-9]{8})/.exec(commits);
    expect(hashMatch).not.toBeNull();
  });

  it("should update state with last commit info", () => {
    vi.setSystemTime(new Date("2026-02-22T16:00:00.000Z"));

    // Act
    executeMemoryMerge(
      { branch: "explore-redis", synthesis: "Merged Redis findings." },
      state,
      branches
    );

    // Assert
    expect(state.lastCommit).not.toBeNull();
    expect(state.lastCommit?.branch).toBe("main");
    expect(state.lastCommit?.summary).toContain("Merge from explore-redis");
    expect(state.lastCommit?.timestamp).toBeDefined();
  });

  it("should not modify root AGENTS.md during merge", () => {
    // Arrange
    const before = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");

    // Act
    executeMemoryMerge(
      { branch: "explore-redis", synthesis: "Merged." },
      state,
      branches
    );

    // Assert
    const after = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(after).toBe(before);
  });

  it("should retain the merged branch (does not delete)", () => {
    // Act
    executeMemoryMerge(
      { branch: "explore-redis", synthesis: "Done." },
      state,
      branches
    );

    // Assert
    expect(branches.branchExists("explore-redis")).toBeTruthy();
  });

  it("should reject merging a branch into itself", () => {
    // Act
    const result = executeMemoryMerge(
      { branch: "main", synthesis: "Self merge." },
      state,
      branches
    );

    // Assert
    expect(result).toContain("Cannot merge");
  });

  it("should reject merging a nonexistent branch", () => {
    // Act
    const result = executeMemoryMerge(
      { branch: "nonexistent", synthesis: "Missing." },
      state,
      branches
    );

    // Assert
    expect(result).toContain("not found");
  });
});
