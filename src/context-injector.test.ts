import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";
import { buildContextInjection } from "./context-injector.js";
import { GccState } from "./state.js";

function setupGccDir(): { projectDir: string; cleanup: () => void } {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-context-inj-"));
  const gccDir = path.join(projectDir, ".gcc");
  fs.mkdirSync(path.join(gccDir, "branches", "main"), { recursive: true });
  fs.writeFileSync(
    path.join(gccDir, "state.yaml"),
    [
      "active_branch: main",
      'initialized: "2026-02-23T00:00:00Z"',
      "last_commit:",
      "  branch: main",
      "  hash: a1b2c3d4",
      '  timestamp: "2026-02-23T01:00:00Z"',
      '  summary: "Set up project foundation"',
    ].join("\n")
  );
  fs.writeFileSync(path.join(gccDir, "branches", "main", "log.md"), "");
  fs.writeFileSync(
    path.join(gccDir, "branches", "main", "commits.md"),
    "# main\n\n**Purpose:** Main development\n"
  );
  fs.writeFileSync(path.join(gccDir, "branches", "main", "metadata.yaml"), "");

  return {
    projectDir,
    cleanup: () => fs.rmSync(projectDir, { recursive: true, force: true }),
  };
}

describe("buildContextInjection", () => {
  it("returns null when GCC is not initialized", () => {
    const projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "gcc-ctx-uninit-")
    );
    try {
      const state = new GccState(projectDir);
      const branches = new BranchManager(projectDir);

      const result = buildContextInjection(state, branches);

      expect(result).toBeNull();
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("returns injection with branch name and latest commit summary", () => {
    const { projectDir, cleanup } = setupGccDir();
    try {
      const state = new GccState(projectDir);
      state.load();
      const branches = new BranchManager(projectDir);

      const result = buildContextInjection(state, branches);

      expect(result).not.toBeNull();
      expect(result?.message.customType).toBe("gcc_context_injection");
      expect(result?.message.display).toBeFalsy();
      expect(result?.message.content).toContain("main");
      expect(result?.message.content).toContain("Set up project foundation");
    } finally {
      cleanup();
    }
  });

  it("includes uncommitted turn count when log has entries", () => {
    const { projectDir, cleanup } = setupGccDir();
    try {
      const state = new GccState(projectDir);
      state.load();
      const branches = new BranchManager(projectDir);

      // Add some log entries
      const logContent = [
        "## Turn 1 | 2026-02-23T02:00:00Z | anthropic/claude-sonnet-4",
        "",
        "**Thought**: First entry.",
        "",
        "## Turn 2 | 2026-02-23T02:05:00Z | anthropic/claude-sonnet-4",
        "",
        "**Thought**: Second entry.",
        "",
      ].join("\n");
      branches.appendLog("main", logContent);

      const result = buildContextInjection(state, branches);

      expect(result).not.toBeNull();
      expect(result?.message.content).toContain("2");
    } finally {
      cleanup();
    }
  });

  it("handles state with no last commit", () => {
    const projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "gcc-ctx-nocommit-")
    );
    try {
      const gccDir = path.join(projectDir, ".gcc");
      fs.mkdirSync(path.join(gccDir, "branches", "main"), { recursive: true });
      fs.writeFileSync(
        path.join(gccDir, "state.yaml"),
        ["active_branch: main", 'initialized: "2026-02-23T00:00:00Z"'].join(
          "\n"
        )
      );
      fs.writeFileSync(path.join(gccDir, "branches", "main", "log.md"), "");
      fs.writeFileSync(path.join(gccDir, "branches", "main", "commits.md"), "");
      fs.writeFileSync(
        path.join(gccDir, "branches", "main", "metadata.yaml"),
        ""
      );

      const state = new GccState(projectDir);
      state.load();
      const branches = new BranchManager(projectDir);

      const result = buildContextInjection(state, branches);

      expect(result).not.toBeNull();
      expect(result?.message.content).toContain("main");
      expect(result?.message.content).not.toContain("undefined");
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
