import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";
import { LOG_SIZE_WARNING_BYTES } from "./constants.js";
import { executeGccContext } from "./gcc-context.js";
import { GccState } from "./state.js";

// Helpers

function setupGccProject(): {
  tmpDir: string;
  state: GccState;
  branches: BranchManager;
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-context-test-"));
  const gccDir = path.join(tmpDir, ".gcc");
  fs.mkdirSync(path.join(gccDir, "branches"), { recursive: true });

  const state = new GccState(tmpDir);
  const branches = new BranchManager(tmpDir);

  fs.writeFileSync(
    path.join(gccDir, "state.yaml"),
    'active_branch: main\ninitialized: "2026-02-22T14:00:00Z"'
  );
  state.load();

  branches.createBranch("main", "Main project memory");

  return { tmpDir, state, branches };
}

describe("executeGccContext", () => {
  let tmpDir: string;
  let state: GccState;
  let branches: BranchManager;

  beforeEach(() => {
    const setup = setupGccProject();
    ({ tmpDir } = setup);
    ({ state } = setup);
    ({ branches } = setup);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return status overview when called with empty params", () => {
    // Arrange
    fs.writeFileSync(
      path.join(tmpDir, ".gcc/main.md"),
      "# Roadmap\n\nGoals here.\n"
    );
    branches.appendCommit(
      "main",
      "\n---\n\n## Commit deadbeef | 2026-02-22\n\n### This Commit's Contribution\n\nShipped milestone.\n"
    );

    // Act
    const result = executeGccContext({}, state, branches, tmpDir);

    // Assert
    expect(result).toContain("# GCC Status");
    expect(result).toContain("Roadmap");
    expect(result).toContain("Active branch: main");
    expect(result).toContain("Shipped milestone.");
    expect(result).toContain(
      "Use `read .gcc/branches/<name>/commits.md` for full history."
    );
  });

  it("should handle missing main.md gracefully", () => {
    // Act
    const result = executeGccContext({}, state, branches, tmpDir);

    // Assert
    expect(result).toContain("No roadmap found");
    expect(result).toContain("Active branch: main");
  });

  it("should show guidance when main.md exists but is empty", () => {
    // Arrange
    fs.writeFileSync(path.join(tmpDir, ".gcc/main.md"), "\n\n");

    // Act
    const result = executeGccContext({}, state, branches, tmpDir);

    // Assert
    expect(result).toContain("Roadmap is empty");
    expect(result).toContain("Update `.gcc/main.md` with project goals");
  });

  it("should ignore unsupported level params and still return status", () => {
    // Act
    const result = executeGccContext(
      { level: "branch", branch: "main", commit: "deadbeef", segment: "x" },
      state,
      branches,
      tmpDir
    );

    // Assert
    expect(result).toContain("# GCC Status");
    expect(result).toContain(
      "Use `read .gcc/branches/<name>/commits.md` for full history."
    );
  });

  it("should warn when log.md exceeds size threshold", () => {
    // Arrange
    fs.writeFileSync(path.join(tmpDir, ".gcc/main.md"), "# Roadmap\n");
    branches.appendLog("main", "x".repeat(LOG_SIZE_WARNING_BYTES + 1));

    // Act
    const result = executeGccContext({}, state, branches, tmpDir);

    // Assert
    expect(result).toContain("**Warning:**");
    expect(result).toContain("log.md is large");
    expect(result).toContain("You should commit");
  });

  it("should not warn when log.md is below threshold", () => {
    // Arrange
    fs.writeFileSync(path.join(tmpDir, ".gcc/main.md"), "# Roadmap\n");
    branches.appendLog("main", "x".repeat(1000));

    // Act
    const result = executeGccContext({}, state, branches, tmpDir);

    // Assert
    expect(result).not.toContain("**Warning:**");
  });

  it("should list multiple branches with their latest commit summaries", () => {
    // Arrange
    branches.createBranch("feature-a", "Feature A");
    const entry =
      "\n---\n\n## Commit ff001122 | 2026-02-22\n\n### This Commit's Contribution\n\nAdded caching layer.\n";
    branches.appendCommit("feature-a", entry);

    // Act
    const result = executeGccContext({}, state, branches, tmpDir);

    // Assert
    expect(result).toContain("feature-a");
    expect(result).toContain("Added caching layer");
    expect(result).toContain("main");
  });
});
