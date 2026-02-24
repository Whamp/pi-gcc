import { buildCommitterTask } from "./subagent.js";

describe("buildCommitterTask", () => {
  it("builds task string with branch, summary, and file paths", () => {
    const task = buildCommitterTask("main", "Fixed auth flow");

    expect(task).toContain('branch "main"');
    expect(task).toContain("Fixed auth flow");
    expect(task).toContain(".gcc/AGENTS.md");
    expect(task).toContain(".gcc/branches/main/log.md");
    expect(task).toContain(".gcc/branches/main/commits.md");
  });

  it("escapes branch names with special characters", () => {
    const task = buildCommitterTask("feature/auth-fix", "Summary");

    expect(task).toContain("feature/auth-fix");
    expect(task).toContain(".gcc/branches/feature/auth-fix/log.md");
  });
});
