import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";

describe("branchManager", () => {
  let tmpDir: string;
  let gccDir: string;
  let manager: BranchManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-branch-test-"));
    gccDir = path.join(tmpDir, ".gcc");
    fs.mkdirSync(path.join(gccDir, "branches"), { recursive: true });
    manager = new BranchManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("createBranch", () => {
    it("creates log.md, commits.md, and metadata.yaml", () => {
      manager.createBranch("feature-x", "Explore feature X");

      const branchDir = path.join(gccDir, "branches/feature-x");
      expect(fs.existsSync(path.join(branchDir, "log.md"))).toBeTruthy();
      expect(fs.existsSync(path.join(branchDir, "commits.md"))).toBeTruthy();
      expect(fs.existsSync(path.join(branchDir, "metadata.yaml"))).toBeTruthy();
    });

    it("writes branch purpose into commits.md header", () => {
      manager.createBranch("feature-x", "Explore feature X");

      const commits = fs.readFileSync(
        path.join(gccDir, "branches/feature-x/commits.md"),
        "utf8"
      );
      expect(commits).toContain("Explore feature X");
    });
  });

  describe("appendLog", () => {
    it("appends content to the branch log.md", () => {
      manager.createBranch("main", "Main branch");
      manager.appendLog(
        "main",
        "## Turn 1 | 2026-02-22 | anthropic/claude\n\nSome content\n"
      );
      manager.appendLog(
        "main",
        "## Turn 2 | 2026-02-22 | anthropic/claude\n\nMore content\n"
      );

      const log = manager.readLog("main");
      expect(log).toContain("## Turn 1");
      expect(log).toContain("## Turn 2");
    });
  });

  describe("appendCommit", () => {
    it("appends a commit entry to commits.md", () => {
      manager.createBranch("main", "Main branch");
      const entry =
        "---\n\n## Commit a1b2c3d4 | 2026-02-22\n\n### Branch Purpose\n\nMain branch\n";
      manager.appendCommit("main", entry);

      const commits = manager.readCommits("main");
      expect(commits).toContain("## Commit a1b2c3d4");
    });
  });

  describe("readLog / readCommits", () => {
    it("returns empty string if files are missing", () => {
      expect(manager.readLog("nonexistent")).toBe("");
      expect(manager.readCommits("nonexistent")).toBe("");
    });
  });

  describe("clearLog", () => {
    it("clears the log file", () => {
      manager.createBranch("main", "Main branch");
      manager.appendLog("main", "## Turn 1\n\nSome content\n");
      manager.clearLog("main");

      expect(manager.readLog("main")).toBe("");
    });
  });

  describe("listBranches", () => {
    it("lists only directories in .gcc/branches/", () => {
      manager.createBranch("main", "Main branch");
      manager.createBranch("feature-a", "Feature A");

      // Create a stray file that should be ignored
      fs.writeFileSync(path.join(gccDir, "branches/.gitkeep"), "");

      const branches = manager.listBranches();
      expect(branches).toContain("main");
      expect(branches).toContain("feature-a");
      expect(branches).not.toContain(".gitkeep");
    });

    it("returns empty array if branches dir is missing", () => {
      fs.rmSync(path.join(gccDir, "branches"), { recursive: true });
      expect(manager.listBranches()).toStrictEqual([]);
    });
  });

  describe("getLogTurnCount", () => {
    it("counts Turn header occurrences", () => {
      manager.createBranch("main", "Main branch");
      manager.appendLog("main", "## Turn 1 | 2026-02-22 | model\n\nContent\n");
      manager.appendLog("main", "## Turn 2 | 2026-02-22 | model\n\nContent\n");
      manager.appendLog("main", "## Turn 3 | 2026-02-22 | model\n\nContent\n");

      expect(manager.getLogTurnCount("main")).toBe(3);
    });

    it("returns 0 for empty or missing log", () => {
      expect(manager.getLogTurnCount("nonexistent")).toBe(0);
      manager.createBranch("main", "Main branch");
      expect(manager.getLogTurnCount("main")).toBe(0);
    });
  });

  describe("getLatestCommit", () => {
    it("returns null for empty commits.md", () => {
      manager.createBranch("main", "Main branch");
      expect(manager.getLatestCommit("main")).toBeNull();
    });

    it("returns null for missing branch", () => {
      expect(manager.getLatestCommit("nonexistent")).toBeNull();
    });

    it("returns the last commit entry", () => {
      manager.createBranch("main", "Main branch");
      const entry1 =
        "\n---\n\n## Commit aaaa1111 | 2026-02-22\n\n### Branch Purpose\n\nMain branch\n\n### This Commit's Contribution\n\nFirst commit\n";
      const entry2 =
        "\n---\n\n## Commit bbbb2222 | 2026-02-23\n\n### Branch Purpose\n\nMain branch\n\n### This Commit's Contribution\n\nSecond commit\n";

      manager.appendCommit("main", entry1);
      manager.appendCommit("main", entry2);

      const latest = manager.getLatestCommit("main");
      expect(latest).not.toBeNull();
      expect(latest).toContain("bbbb2222");
      expect(latest).toContain("Second commit");
      expect(latest).not.toContain("aaaa1111");
    });
  });

  describe("branchExists", () => {
    it("returns true for existing branches", () => {
      manager.createBranch("main", "Main branch");
      expect(manager.branchExists("main")).toBeTruthy();
    });

    it("returns false for non-existing branches", () => {
      expect(manager.branchExists("nope")).toBeFalsy();
    });
  });

  describe("readMetadata", () => {
    it("returns empty string for new branch", () => {
      manager.createBranch("main", "Main branch");
      expect(manager.readMetadata("main")).toBe("");
    });

    it("returns raw text content", () => {
      manager.createBranch("main", "Main branch");
      const metadataPath = path.join(gccDir, "branches/main/metadata.yaml");
      fs.writeFileSync(metadataPath, "file_structure:\n  src/: source code\n");

      expect(manager.readMetadata("main")).toBe(
        "file_structure:\n  src/: source code\n"
      );
    });
  });
});
