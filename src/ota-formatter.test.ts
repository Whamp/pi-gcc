import { formatOtaEntry } from "./ota-formatter.js";
import type { OtaEntryInput } from "./ota-formatter.js";

describe("formatOtaEntry", () => {
  it("formats a full turn with all fields", () => {
    const input: OtaEntryInput = {
      turnNumber: 1,
      timestamp: "2026-02-22T14:00:00Z",
      model: "anthropic/claude-sonnet-4",
      thought: "I need to read the file first.",
      thinking: "Let me analyze the structure of this codebase.",
      actions: ["read(src/index.ts)", "bash(ls -la)"],
      observations: ["read: success, 45 lines", "bash: exit 0, 3 files listed"],
    };

    const result = formatOtaEntry(input);

    expect(result).toContain(
      "## Turn 1 | 2026-02-22T14:00:00Z | anthropic/claude-sonnet-4"
    );
    expect(result).toContain("**Thought**: I need to read the file first.");
    expect(result).toContain(
      "**Thinking**: Let me analyze the structure of this codebase."
    );
    expect(result).toContain("**Action**: read(src/index.ts), bash(ls -la)");
    expect(result).toContain(
      "**Observation**: read: success, 45 lines; bash: exit 0, 3 files listed"
    );
  });

  it("omits thinking block when empty", () => {
    const input: OtaEntryInput = {
      turnNumber: 2,
      timestamp: "2026-02-22T14:01:00Z",
      model: "google/gemini-2.5-pro",
      thought: "The file looks correct.",
      thinking: "",
      actions: [],
      observations: [],
    };

    const result = formatOtaEntry(input);

    expect(result).toContain("## Turn 2");
    expect(result).toContain("**Thought**: The file looks correct.");
    expect(result).not.toContain("**Thinking**");
  });

  it("omits action and observation when no tools called", () => {
    const input: OtaEntryInput = {
      turnNumber: 3,
      timestamp: "2026-02-22T14:02:00Z",
      model: "anthropic/claude-sonnet-4",
      thought: "I understand the problem now.",
      thinking: "This is a design issue.",
      actions: [],
      observations: [],
    };

    const result = formatOtaEntry(input);

    expect(result).toContain("**Thought**: I understand the problem now.");
    expect(result).toContain("**Thinking**: This is a design issue.");
    expect(result).not.toContain("**Action**");
    expect(result).not.toContain("**Observation**");
  });

  it("ends with a trailing newline", () => {
    const input: OtaEntryInput = {
      turnNumber: 1,
      timestamp: "2026-02-22T14:00:00Z",
      model: "anthropic/claude-sonnet-4",
      thought: "Hello.",
      thinking: "",
      actions: [],
      observations: [],
    };

    const result = formatOtaEntry(input);
    expect(result.endsWith("\n")).toBeTruthy();
  });

  it("handles actions with observations of differing lengths", () => {
    const input: OtaEntryInput = {
      turnNumber: 4,
      timestamp: "2026-02-22T14:03:00Z",
      model: "anthropic/claude-sonnet-4",
      thought: "Running multiple tools.",
      thinking: "",
      actions: ["bash(pnpm test)", "edit(src/index.ts)"],
      observations: ["bash: exit 0, all tests pass"],
    };

    const result = formatOtaEntry(input);

    expect(result).toContain("**Action**: bash(pnpm test), edit(src/index.ts)");
    expect(result).toContain("**Observation**: bash: exit 0, all tests pass");
  });
});
