import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

describe("brain-init.sh", () => {
  let tmpDir: string;
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const scriptPath = path.resolve(
    testDir,
    "../skills/brain/scripts/brain-init.sh"
  );

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-init-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create the .memory directory structure", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    expect(fs.existsSync(path.join(tmpDir, ".memory/state.yaml"))).toBeTruthy();
    expect(fs.existsSync(path.join(tmpDir, ".memory/AGENTS.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(tmpDir, ".memory/main.md"))).toBeTruthy();
    expect(
      fs.existsSync(path.join(tmpDir, ".memory/branches/main/log.md"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(tmpDir, ".memory/branches/main/commits.md"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(tmpDir, ".memory/branches/main/metadata.yaml"))
    ).toBeTruthy();
  });

  it("should write correct state.yaml with active_branch: main", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const state = fs.readFileSync(
      path.join(tmpDir, ".memory/state.yaml"),
      "utf8"
    );
    expect(state).toContain("active_branch: main");
    expect(state).toContain("initialized:");
  });

  it("should create root AGENTS.md with static Brain section", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const agents = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(agents).toContain("## Brain");
    expect(agents).toContain(
      "Tools: memory_commit, memory_branch (create/switch/merge)"
    );
    expect(agents).not.toContain("Current branch:");
  });

  it("should append to existing AGENTS.md without duplicating", () => {
    // Arrange
    fs.writeFileSync(
      path.join(tmpDir, "AGENTS.md"),
      "# My Project\n\nExisting content.\n"
    );

    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const agents = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(agents).toContain("# My Project");
    expect(agents).toContain("Existing content.");
    expect(agents).toContain("## Brain");
  });

  it("should be idempotent — running twice does not duplicate Brain section", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const agents = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    const brainMatches = agents.match(/## Brain/g);
    expect(brainMatches?.length).toBe(1);
  });

  it("should not overwrite existing .memory files on second run", () => {
    // Arrange
    execFileSync("bash", [scriptPath], { cwd: tmpDir });
    const statePath = path.join(tmpDir, ".memory/state.yaml");
    const originalState = fs.readFileSync(statePath, "utf8");
    fs.writeFileSync(statePath, `${originalState}\nmodified: true`);

    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const stateAfter = fs.readFileSync(statePath, "utf8");
    expect(stateAfter).toContain("modified: true");
  });

  it("should add log.md pattern to .gitignore idempotently", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf8");
    const matches = gitignore.match(/^\.memory\/branches\/\*\/log\.md$/gm);
    expect(matches?.length).toBe(1);
  });

  it("should write .memory/AGENTS.md with protocol reference", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const memoryAgents = fs.readFileSync(
      path.join(tmpDir, ".memory/AGENTS.md"),
      "utf8"
    );
    expect(memoryAgents).toContain("memory_commit");
    expect(memoryAgents).toContain("memory_branch");
    expect(memoryAgents).toContain("create");
    expect(memoryAgents).toContain("switch");
    expect(memoryAgents).toContain("merge");
  });
});
