import {
  buildCommitterTask,
  extractCommitBlocks,
  extractFinalText,
} from "./subagent.js";

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

describe("extractFinalText", () => {
  it("extracts text from the last assistant message_end event", () => {
    const stdout = [
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "### Branch Purpose\nBuild GCC.\n\n### Previous Progress Summary\nInitial commit.\n\n### This Commit's Contribution\n- Added spawn module.",
            },
          ],
        },
      }),
    ].join("\n");

    const result = extractFinalText(stdout);
    expect(result).toContain("### Branch Purpose");
    expect(result).toContain("### This Commit's Contribution");
  });

  it("returns the last assistant message when there are multiple", () => {
    const stdout = [
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Let me read the files..." }],
        },
      }),
      JSON.stringify({
        type: "tool_result_end",
        message: {
          role: "tool",
          content: [{ type: "text", text: "file contents" }],
        },
      }),
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "### Branch Purpose\nFinal answer." },
          ],
        },
      }),
    ].join("\n");

    const result = extractFinalText(stdout);
    expect(result).toContain("Final answer.");
    expect(result).not.toContain("Let me read");
  });

  it("returns empty string when stdout has no assistant messages", () => {
    expect(extractFinalText("")).toBe("");
    expect(extractFinalText("not json\n")).toBe("");
  });

  it("handles multiple text content parts", () => {
    const stdout = JSON.stringify({
      type: "message_end",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Part one." },
          { type: "text", text: "Part two." },
        ],
      },
    });

    const result = extractFinalText(stdout);
    expect(result).toContain("Part one.");
    expect(result).toContain("Part two.");
  });
});

describe("extractCommitBlocks", () => {
  it("extracts three commit blocks from text", () => {
    const text = [
      "### Branch Purpose",
      "Build the GCC extension for persistent agent memory.",
      "",
      "### Previous Progress Summary",
      "Completed Phase 1 foundation: YAML parser, state manager, hash generator.",
      "",
      "### This Commit's Contribution",
      "Added OTA formatter and branch manager modules with full test coverage.",
    ].join("\n");

    const result = extractCommitBlocks(text);
    expect(result).toContain("### Branch Purpose");
    expect(result).toContain("### Previous Progress Summary");
    expect(result).toContain("### This Commit's Contribution");
  });

  it("strips preamble and trailing text", () => {
    const text = [
      "I've reviewed the log and here is the commit:",
      "",
      "### Branch Purpose",
      "Build the GCC extension.",
      "",
      "### Previous Progress Summary",
      "Phase 1 done.",
      "",
      "### This Commit's Contribution",
      "Phase 2 tools implemented.",
      "",
      "Let me know if you want to adjust anything.",
    ].join("\n");

    const result = extractCommitBlocks(text);
    expect(result).not.toContain("I've reviewed");
    expect(result).not.toContain("Let me know");
    expect(result).toContain("### Branch Purpose");
  });

  it("returns null when blocks are missing", () => {
    expect(extractCommitBlocks("No commit blocks here.")).toBeNull();
    expect(
      extractCommitBlocks("### Branch Purpose\nOnly one block.")
    ).toBeNull();
  });
});
