import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BranchManager } from "./branches.js";

describe("branchManager", () => {
  let tmpDir: string;
  let memoryDir: string;
  let manager: BranchManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-branch-test-"));
    memoryDir = path.join(tmpDir, ".memory");
    fs.mkdirSync(path.join(memoryDir, "branches"), { recursive: true });
    manager = new BranchManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("createBranch", () => {
    it("should create log.md, commits.md, and metadata.yaml", () => {
      // Act
      manager.createBranch("feature-x", "Explore feature X");

      // Assert
      const branchDir = path.join(memoryDir, "branches/feature-x");
      expect(fs.existsSync(path.join(branchDir, "log.md"))).toBeTruthy();
      expect(fs.existsSync(path.join(branchDir, "commits.md"))).toBeTruthy();
      expect(fs.existsSync(path.join(branchDir, "metadata.yaml"))).toBeTruthy();
    });

    it("should write branch purpose into commits.md header", () => {
      // Act
      manager.createBranch("feature-x", "Explore feature X");

      // Assert
      const commits = fs.readFileSync(
        path.join(memoryDir, "branches/feature-x/commits.md"),
        "utf8"
      );
      expect(commits).toContain("Explore feature X");
    });

    it("should handle branch names with slashes", () => {
      // Act
      manager.createBranch("feature/auth", "Auth work");

      // Assert
      const branchDir = path.join(memoryDir, "branches/feature/auth");
      expect(fs.existsSync(branchDir)).toBeTruthy();
      expect(manager.branchExists("feature/auth")).toBeTruthy();
    });
  });

  describe("appendLog", () => {
    it("should append content to the branch log.md", () => {
      // Arrange
      manager.createBranch("main", "Main branch");

      // Act
      manager.appendLog(
        "main",
        "## Turn 1 | 2026-02-22 | anthropic/claude\n\nSome content\n"
      );
      manager.appendLog(
        "main",
        "## Turn 2 | 2026-02-22 | anthropic/claude\n\nMore content\n"
      );

      // Assert
      const log = manager.readLog("main");
      expect(log).toContain("## Turn 1");
      expect(log).toContain("## Turn 2");
    });
  });

  describe("appendCommit", () => {
    it("should append a commit entry to commits.md", () => {
      // Arrange
      manager.createBranch("main", "Main branch");
      const entry =
        "---\n\n## Commit a1b2c3d4 | 2026-02-22\n\n### Branch Purpose\n\nMain branch\n";

      // Act
      manager.appendCommit("main", entry);

      // Assert
      const commits = manager.readCommits("main");
      expect(commits).toContain("## Commit a1b2c3d4");
    });
  });

  describe("readLog / readCommits", () => {
    it("should return empty string if files are missing", () => {
      // Act + Assert
      expect(manager.readLog("nonexistent")).toBe("");
      expect(manager.readCommits("nonexistent")).toBe("");
    });
  });

  describe("clearLog", () => {
    it("should clear the log file", () => {
      // Arrange
      manager.createBranch("main", "Main branch");
      manager.appendLog("main", "## Turn 1\n\nSome content\n");

      // Act
      manager.clearLog("main");

      // Assert
      expect(manager.readLog("main")).toBe("");
    });
  });

  describe("listBranches", () => {
    it("should list only directories in .memory/branches/", () => {
      // Arrange
      manager.createBranch("main", "Main branch");
      manager.createBranch("feature-a", "Feature A");
      fs.writeFileSync(path.join(memoryDir, "branches/.gitkeep"), "");

      // Act
      const branches = manager.listBranches();

      // Assert
      expect(branches).toContain("main");
      expect(branches).toContain("feature-a");
      expect(branches).not.toContain(".gitkeep");
    });

    it("should return empty array if branches dir is missing", () => {
      // Arrange
      fs.rmSync(path.join(memoryDir, "branches"), { recursive: true });

      // Act + Assert
      expect(manager.listBranches()).toStrictEqual([]);
    });

    it("should return branches in sorted order for deterministic status output", () => {
      class BranchManagerWithCustomEntries extends BranchManager {
        private readonly entries: readonly string[];

        constructor(projectDir: string, entries: readonly string[]) {
          super(projectDir);
          this.entries = entries;
        }

        protected override readBranchEntries(): string[] {
          return [...this.entries];
        }
      }

      // Arrange
      manager.createBranch("zeta", "Zeta");
      manager.createBranch("alpha", "Alpha");
      manager.createBranch("main", "Main");
      manager.createBranch("beta", "Beta");

      const customOrderManager = new BranchManagerWithCustomEntries(tmpDir, [
        "zeta",
        "main",
        "beta",
        "alpha",
      ]);

      // Act
      const branches = customOrderManager.listBranches();

      // Assert
      expect(branches).toStrictEqual(["alpha", "beta", "main", "zeta"]);
    });
  });

  describe("getLogTurnCount", () => {
    it("should count Turn header occurrences", () => {
      // Arrange
      manager.createBranch("main", "Main branch");
      manager.appendLog("main", "## Turn 1 | 2026-02-22 | model\n\nContent\n");
      manager.appendLog("main", "## Turn 2 | 2026-02-22 | model\n\nContent\n");
      manager.appendLog("main", "## Turn 3 | 2026-02-22 | model\n\nContent\n");

      // Act + Assert
      expect(manager.getLogTurnCount("main")).toBe(3);
    });

    it("should return 0 for empty or missing log", () => {
      // Act + Assert
      expect(manager.getLogTurnCount("nonexistent")).toBe(0);
      manager.createBranch("main", "Main branch");
      expect(manager.getLogTurnCount("main")).toBe(0);
    });
  });

  describe("getLogSizeBytes", () => {
    it("should return file size in bytes", () => {
      // Arrange
      manager.createBranch("main", "Main branch");
      manager.appendLog("main", "x".repeat(1000));

      // Act + Assert
      expect(manager.getLogSizeBytes("main")).toBe(1000);
    });

    it("should return 0 for missing branch", () => {
      // Act + Assert
      expect(manager.getLogSizeBytes("nonexistent")).toBe(0);
    });

    it("should return 0 for empty log", () => {
      // Arrange
      manager.createBranch("main", "Main branch");

      // Act + Assert
      expect(manager.getLogSizeBytes("main")).toBe(0);
    });
  });

  describe("getLatestCommit", () => {
    it("should return null for empty commits.md", () => {
      // Arrange
      manager.createBranch("main", "Main branch");

      // Act + Assert
      expect(manager.getLatestCommit("main")).toBeNull();
    });

    it("should return null for missing branch", () => {
      // Act + Assert
      expect(manager.getLatestCommit("nonexistent")).toBeNull();
    });

    it("should return the last commit entry", () => {
      // Arrange
      manager.createBranch("main", "Main branch");
      const entry1 =
        "\n---\n\n## Commit aaaa1111 | 2026-02-22\n\n### Branch Purpose\n\nMain branch\n\n### This Commit's Contribution\n\nFirst commit\n";
      const entry2 =
        "\n---\n\n## Commit bbbb2222 | 2026-02-23\n\n### Branch Purpose\n\nMain branch\n\n### This Commit's Contribution\n\nSecond commit\n";
      manager.appendCommit("main", entry1);
      manager.appendCommit("main", entry2);

      // Act
      const latest = manager.getLatestCommit("main");

      // Assert
      expect(latest).not.toBeNull();
      expect(latest).toContain("bbbb2222");
      expect(latest).toContain("Second commit");
      expect(latest).not.toContain("aaaa1111");
    });
  });

  describe("branchExists", () => {
    it("should return true for existing branches", () => {
      // Arrange
      manager.createBranch("main", "Main branch");

      // Act + Assert
      expect(manager.branchExists("main")).toBeTruthy();
    });

    it("should return false for non-existing branches", () => {
      // Act + Assert
      expect(manager.branchExists("nope")).toBeFalsy();
    });
  });

  describe("readMetadata", () => {
    it("should return empty string for new branch", () => {
      // Arrange
      manager.createBranch("main", "Main branch");

      // Act + Assert
      expect(manager.readMetadata("main")).toBe("");
    });

    it("should return raw text content", () => {
      // Arrange
      manager.createBranch("main", "Main branch");
      const metadataPath = path.join(memoryDir, "branches/main/metadata.yaml");
      fs.writeFileSync(metadataPath, "file_structure:\n  src/: source code\n");

      // Act + Assert
      expect(manager.readMetadata("main")).toBe(
        "file_structure:\n  src/: source code\n"
      );
    });
  });
});
