import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";
import { executeGccBranch } from "./gcc-branch.js";
import { executeGccCommit, finalizeGccCommit } from "./gcc-commit.js";
import { executeGccContext } from "./gcc-context.js";
import { formatOtaEntry } from "./ota-formatter.js";
import { GccState } from "./state.js";

describe("integration", () => {
  it("should connect state, branches, commit flow, and context retrieval", () => {
    // Arrange
    const projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "gcc-integration-")
    );

    try {
      const gccDir = path.join(projectDir, ".gcc");
      fs.mkdirSync(path.join(gccDir, "branches"), { recursive: true });
      fs.writeFileSync(
        path.join(gccDir, "state.yaml"),
        ["active_branch: main", 'initialized: "2026-02-23T00:00:00Z"'].join(
          "\n"
        )
      );

      const state = new GccState(projectDir);
      state.load();

      const branches = new BranchManager(projectDir);
      branches.createBranch("main", "Main development branch");

      // Act — create branch
      const branchResult = executeGccBranch(
        {
          name: "phase-3-hooks",
          purpose: "Implement hook extractors and extension wiring",
        },
        state,
        branches
      );

      // Assert — branch created
      expect(branchResult).toContain("phase-3-hooks");
      expect(state.activeBranch).toBe("phase-3-hooks");

      // Act — append log and commit
      branches.appendLog(
        "phase-3-hooks",
        formatOtaEntry({
          turnNumber: 1,
          timestamp: "2026-02-23T01:00:00Z",
          model: "anthropic/claude-sonnet-4",
          thought: "Need to add hook extractors.",
          thinking: "Split hook logic into pure modules first.",
          actions: [
            "write(src/ota-logger.ts)",
            "write(src/context-injector.ts)",
          ],
          observations: [
            "ota-logger module created",
            "context-injector module created",
          ],
        })
      );

      const commitResult = executeGccCommit(
        { summary: "Implemented hook extractor modules" },
        state,
        branches
      );

      // Assert — commit prepared
      expect(commitResult.task).toContain('branch "phase-3-hooks"');
      expect(commitResult.task).toContain("Implemented hook extractor modules");

      // Act — finalize commit
      const finalizeResult = finalizeGccCommit(
        "Implemented hook extractor modules",
        [
          "### Branch Purpose",
          "Implement GCC hook extractors and wiring.",
          "",
          "### Previous Progress Summary",
          "Core GCC tools completed.",
          "",
          "### This Commit's Contribution",
          "Added ota-logger/context-injector and verified behavior.",
        ].join("\n"),
        state,
        branches
      );

      // Assert — commit finalized, log cleared
      expect(finalizeResult).toContain("Commit");

      const logAfterCommit = branches.readLog("phase-3-hooks");
      expect(logAfterCommit).toBe("");

      // Act — retrieve context
      const statusView = executeGccContext({}, state, branches, projectDir);

      // Assert — context contains commit info
      expect(statusView).toContain("phase-3-hooks");
      expect(statusView).toContain(
        "Added ota-logger/context-injector and verified behavior."
      );

      const ignoredLevelView = executeGccContext(
        { level: "branch", branch: "phase-3-hooks" },
        state,
        branches,
        projectDir
      );
      expect(ignoredLevelView).toContain("# GCC Status");
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
