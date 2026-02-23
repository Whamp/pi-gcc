import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { updateRootAgentsMd } from "./agents-md.js";

describe("updateRootAgentsMd", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-agents-md-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates AGENTS.md if it does not exist", () => {
    updateRootAgentsMd(tmpDir, "main", "Initial setup");

    const content = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(content).toContain("## GCC");
    expect(content).toContain("main");
    expect(content).toContain("Initial setup");
  });

  it("appends GCC section to existing AGENTS.md", () => {
    fs.writeFileSync(
      path.join(tmpDir, "AGENTS.md"),
      "# My Project\n\nSome rules.\n"
    );

    updateRootAgentsMd(tmpDir, "main", "Decided on architecture");

    const content = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Some rules.");
    expect(content).toContain("## GCC");
    expect(content).toContain("Decided on architecture");
  });

  it("replaces existing GCC section without touching surrounding content", () => {
    const initial = [
      "# Project",
      "",
      "Some content above.",
      "",
      "## GCC — Git Context Controller",
      "",
      "This project uses GCC for agent memory management.",
      "Current branch: main | Latest milestone: old summary",
      "Call `gcc_context` to load full project state.",
      "",
      "## Other Section",
      "",
      "Content below.",
    ].join("\n");

    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), initial);

    updateRootAgentsMd(tmpDir, "feature-x", "New milestone reached");

    const content = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    expect(content).toContain("# Project");
    expect(content).toContain("Some content above.");
    expect(content).toContain("feature-x");
    expect(content).toContain("New milestone reached");
    expect(content).not.toContain("old summary");
    expect(content).toContain("## Other Section");
    expect(content).toContain("Content below.");
  });

  it("does not duplicate GCC section on repeated calls", () => {
    updateRootAgentsMd(tmpDir, "main", "First");
    updateRootAgentsMd(tmpDir, "main", "Second");

    const content = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf8");
    const gccMatches = content.match(/## GCC/g);
    expect(gccMatches?.length).toBe(1);
    expect(content).toContain("Second");
    expect(content).not.toContain("First");
  });
});
