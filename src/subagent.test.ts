import fc from "fast-check";

import {
  buildCommitterTask,
  extractCommitBlocks,
  extractFinalText,
} from "./subagent.js";

// Helpers

/** Generate valid JSON-mode stdout with message_end events */
const messageEndEventArb = fc.record({
  type: fc.constant("message_end"),
  message: fc.record({
    role: fc.oneof(fc.constant("assistant"), fc.constant("user")),
    content: fc.array(
      fc.record({
        type: fc.constant("text"),
        text: fc.string(),
      })
    ),
  }),
});

/**
 * Stdout guaranteed to contain at least one assistant message_end event
 * with at least one non-empty text content item.
 */
const validAssistantStdoutArb = fc
  .tuple(
    fc.array(messageEndEventArb),
    fc.record({
      type: fc.constant("message_end" as const),
      message: fc.record({
        role: fc.constant("assistant" as const),
        content: fc
          .tuple(
            fc.record({
              type: fc.constant("text"),
              text: fc.string({ minLength: 1 }),
            }),
            fc.array(
              fc.record({
                type: fc.constant("text"),
                text: fc.string(),
              })
            )
          )
          .map(([required, rest]) => [required, ...rest]),
      }),
    }),
    fc.array(messageEndEventArb)
  )
  .map(([before, required, after]) =>
    [...before, required, ...after].map((e) => JSON.stringify(e)).join("\n")
  );

/** Generate text that contains all three required headings */
const validCommitTextArb = fc
  .record({
    preamble: fc.string(),
    purpose: fc.string({ minLength: 1 }),
    progress: fc.string({ minLength: 1 }),
    contribution: fc.string({ minLength: 1 }),
    trailer: fc.string(),
  })
  .map((parts) =>
    [
      parts.preamble,
      "",
      "### Branch Purpose",
      parts.purpose,
      "",
      "### Previous Progress Summary",
      parts.progress,
      "",
      "### This Commit's Contribution",
      parts.contribution,
      "",
      parts.trailer,
    ].join("\n")
  );

describe("buildCommitterTask", () => {
  it("should build task string with branch, summary, and file paths", () => {
    const task = buildCommitterTask("main", "Fixed auth flow");

    expect(task).toContain('branch "main"');
    expect(task).toContain("Fixed auth flow");
    expect(task).toContain(".gcc/AGENTS.md");
    expect(task).toContain(".gcc/branches/main/log.md");
    expect(task).toContain(".gcc/branches/main/commits.md");
  });

  it("should escape branch names with special characters", () => {
    const task = buildCommitterTask("feature/auth-fix", "Summary");

    expect(task).toContain("feature/auth-fix");
    expect(task).toContain(".gcc/branches/feature/auth-fix/log.md");
  });
});

describe("extractFinalText", () => {
  it("should extract text from the last assistant message_end event", () => {
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

  it("should return the last assistant message when there are multiple", () => {
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

  it("should return empty string when stdout has no assistant messages", () => {
    expect(extractFinalText("")).toBe("");
    expect(extractFinalText("not json\n")).toBe("");
  });

  it("should handle multiple text content parts", () => {
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
  it("should extract three commit blocks from text", () => {
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

  it("should strip preamble and trailing text", () => {
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

  it("should return null when blocks are missing", () => {
    expect(extractCommitBlocks("No commit blocks here.")).toBeNull();
    expect(
      extractCommitBlocks("### Branch Purpose\nOnly one block.")
    ).toBeNull();
  });
});

describe("extractFinalText property-based tests", () => {
  it("should never throw on arbitrary input", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => extractFinalText(input)).not.toThrow();
      })
    );
  });

  it("should always return a string", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        // Act
        const result = extractFinalText(input);

        // Assert
        expect(result).toBeTypeOf("string");
      })
    );
  });

  it("should extract text from the last assistant message in valid stdout", () => {
    fc.assert(
      fc.property(validAssistantStdoutArb, (stdout) => {
        // Act
        const result = extractFinalText(stdout);

        // Assert
        const events = stdout.split("\n").map(
          (line) =>
            JSON.parse(line) as {
              message: {
                role: string;
                content: { text: string }[];
              };
            }
        );
        const assistantEvents = events.filter(
          (e) => e.message.role === "assistant"
        );
        const assistant = assistantEvents.at(-1) as (typeof assistantEvents)[0];
        const expectedTexts = assistant.message.content
          .map((c) => c.text)
          .filter((t) => t.length > 0);
        for (const text of expectedTexts) {
          expect(result).toContain(text);
        }
      })
    );
  });
});

describe("extractCommitBlocks property-based tests", () => {
  it("should never throw on arbitrary input", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => extractCommitBlocks(input)).not.toThrow();
      })
    );
  });

  it("should return null or a string", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        // Act
        const result = extractCommitBlocks(input);

        // Assert
        expect(result === null || typeof result === "string").toBeTruthy();
      })
    );
  });

  it("should extract all three headings when present", () => {
    fc.assert(
      fc.property(validCommitTextArb, (text) => {
        // Act
        const result = extractCommitBlocks(text);

        // Assert
        expect(result).not.toBeNull();
        expect(result).toContain("### Branch Purpose");
        expect(result).toContain("### Previous Progress Summary");
        expect(result).toContain("### This Commit's Contribution");
      })
    );
  });

  it("should start result with ### Branch Purpose", () => {
    fc.assert(
      fc.property(validCommitTextArb, (text) => {
        // Act
        const result = extractCommitBlocks(text);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.startsWith("### Branch Purpose")).toBeTruthy();
      })
    );
  });
});

describe("buildCommitterTask property-based tests", () => {
  it("should include branch name and summary in task", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (branch, summary) => {
          // Act
          const task = buildCommitterTask(branch, summary);

          // Assert
          expect(task).toContain(branch);
          expect(task).toContain(summary);
        }
      )
    );
  });

  it("should include all required file paths", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (branch, summary) => {
          // Act
          const task = buildCommitterTask(branch, summary);

          // Assert
          expect(task).toContain(".gcc/AGENTS.md");
          expect(task).toContain(`${branch}/log.md`);
          expect(task).toContain(`${branch}/commits.md`);
        }
      )
    );
  });
});
