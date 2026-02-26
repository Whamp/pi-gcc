import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

describe("gcc-init.sh", () => {
  let tmpDir: string;
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const scriptPath = path.resolve(testDir, "../skills/gcc/scripts/gcc-init.sh");

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-init-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create the .gcc directory structure", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    expect(fs.existsSync(path.join(tmpDir, ".gcc/state.yaml"))).toBeTruthy();
    expect(fs.existsSync(path.join(tmpDir, ".gcc/AGENTS.md"))).toBeTruthy();
    expect(fs.existsSync(path.join(tmpDir, ".gcc/main.md"))).toBeTruthy();
    expect(
      fs.existsSync(path.join(tmpDir, ".gcc/branches/main/log.md"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(tmpDir, ".gcc/branches/main/commits.md"))
    ).toBeTruthy();
    expect(
      fs.existsSync(path.join(tmpDir, ".gcc/branches/main/metadata.yaml"))
    ).toBeTruthy();
  });

  it("should write correct state.yaml with active_branch: main", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const state = fs.readFileSync(path.join(tmpDir, ".gcc/state.yaml"), "utf8");
    expect(state).toContain("active_branch: main");
    expect(state).toContain("initialized:");
  });

  it("should create root AGENTS.md with static GCC section", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const agents = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(agents).toContain("## GCC");
    expect(agents).toContain(
      "Tools: gcc_commit, gcc_branch, gcc_merge, gcc_switch, gcc_context"
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
    expect(agents).toContain("## GCC");
  });

  it("should be idempotent — running twice does not duplicate GCC section", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const agents = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    const gccMatches = agents.match(/## GCC/g);
    expect(gccMatches?.length).toBe(1);
  });

  it("should not overwrite existing .gcc files on second run", () => {
    // Arrange
    execFileSync("bash", [scriptPath], { cwd: tmpDir });
    const statePath = path.join(tmpDir, ".gcc/state.yaml");
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
    const matches = gitignore.match(/^\.gcc\/branches\/\*\/log\.md$/gm);
    expect(matches?.length).toBe(1);
  });

  it("should write .gcc/AGENTS.md with protocol reference", () => {
    // Act
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Assert
    const gccAgents = fs.readFileSync(
      path.join(tmpDir, ".gcc/AGENTS.md"),
      "utf8"
    );
    expect(gccAgents).toContain("gcc_commit");
    expect(gccAgents).toContain("gcc_branch");
    expect(gccAgents).toContain("gcc_context");
    expect(gccAgents).toContain("gcc_merge");
    expect(gccAgents).toContain("gcc_switch");
  });
});
