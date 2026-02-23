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

  it("creates the .gcc directory structure", () => {
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    expect(fs.existsSync(path.join(tmpDir, ".gcc/state.yaml"))).toBeTruthy();
    expect(fs.existsSync(path.join(tmpDir, ".gcc/AGENTS.md"))).toBeTruthy();
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

  it("writes correct state.yaml with active_branch: main", () => {
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    const state = fs.readFileSync(path.join(tmpDir, ".gcc/state.yaml"), "utf8");
    expect(state).toContain("active_branch: main");
    expect(state).toContain("initialized:");
  });

  it("creates root AGENTS.md with GCC section", () => {
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    const agents = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(agents).toContain("## GCC");
    expect(agents).toContain("gcc_context");
  });

  it("appends to existing AGENTS.md without duplicating", () => {
    fs.writeFileSync(
      path.join(tmpDir, "AGENTS.md"),
      "# My Project\n\nExisting content.\n"
    );

    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    const agents = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(agents).toContain("# My Project");
    expect(agents).toContain("Existing content.");
    expect(agents).toContain("## GCC");
  });

  it("is idempotent — running twice does not duplicate GCC section", () => {
    execFileSync("bash", [scriptPath], { cwd: tmpDir });
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    const agents = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    const gccMatches = agents.match(/## GCC/g);
    expect(gccMatches?.length).toBe(1);
  });

  it("does not overwrite existing .gcc files on second run", () => {
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    // Modify state to simulate usage
    const statePath = path.join(tmpDir, ".gcc/state.yaml");
    const originalState = fs.readFileSync(statePath, "utf8");
    fs.writeFileSync(statePath, `${originalState}\nmodified: true`);

    execFileSync("bash", [scriptPath], { cwd: tmpDir });

    const stateAfter = fs.readFileSync(statePath, "utf8");
    expect(stateAfter).toContain("modified: true");
  });

  it("writes .gcc/AGENTS.md with protocol reference", () => {
    execFileSync("bash", [scriptPath], { cwd: tmpDir });

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
