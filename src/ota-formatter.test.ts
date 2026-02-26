import fc from "fast-check";

import { formatOtaEntry } from "./ota-formatter.js";
import type { OtaEntryInput } from "./ota-formatter.js";

// Helpers

const otaEntryArb = fc.record({
  turnNumber: fc.integer({ min: 1 }),
  timestamp: fc.string({ minLength: 1 }),
  model: fc.string({ minLength: 1 }),
  thought: fc.string(),
  thinking: fc.string(),
  actions: fc.array(fc.string({ minLength: 1 })),
  observations: fc.array(fc.string({ minLength: 1 })),
});

describe("formatOtaEntry", () => {
  it("should format a full turn with all fields", () => {
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

  it("should omit thinking block when empty", () => {
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

  it("should omit action and observation when no tools called", () => {
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

  it("should end with a trailing newline", () => {
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

  it("should handle actions with observations of differing lengths", () => {
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

describe("formatOtaEntry property-based tests", () => {
  it("should always start with ## Turn header", () => {
    fc.assert(
      fc.property(otaEntryArb, (input) => {
        // Act
        const result = formatOtaEntry(input);

        // Assert
        expect(result).toMatch(new RegExp(`^## Turn ${input.turnNumber} \\|`));
      })
    );
  });

  it("should always end with trailing newline", () => {
    fc.assert(
      fc.property(otaEntryArb, (input) => {
        // Act
        const result = formatOtaEntry(input);

        // Assert
        expect(result.endsWith("\n")).toBeTruthy();
      })
    );
  });

  it("should always contain **Thought** line", () => {
    fc.assert(
      fc.property(otaEntryArb, (input) => {
        // Act
        const result = formatOtaEntry(input);

        // Assert
        expect(result).toContain("**Thought**:");
      })
    );
  });

  it("should include **Thinking** iff thinking is non-empty", () => {
    fc.assert(
      fc.property(otaEntryArb, (input) => {
        // Act
        const result = formatOtaEntry(input);
        const hasThinking = result.includes("**Thinking**:");

        // Assert
        expect(hasThinking).toBe(input.thinking !== "");
      })
    );
  });

  it("should include **Action** iff actions array is non-empty", () => {
    fc.assert(
      fc.property(otaEntryArb, (input) => {
        // Act
        const result = formatOtaEntry(input);
        const hasAction = result.includes("**Action**:");

        // Assert
        expect(hasAction).toBe(input.actions.length > 0);
      })
    );
  });

  it("should include **Observation** iff observations array is non-empty", () => {
    fc.assert(
      fc.property(otaEntryArb, (input) => {
        // Act
        const result = formatOtaEntry(input);
        const hasObs = result.includes("**Observation**:");

        // Assert
        expect(hasObs).toBe(input.observations.length > 0);
      })
    );
  });

  it("should include turn number, timestamp, and model in header", () => {
    fc.assert(
      fc.property(otaEntryArb, (input) => {
        // Act
        const result = formatOtaEntry(input);
        const [headerLine] = result.split("\n");

        // Assert
        expect(headerLine).toContain(`Turn ${input.turnNumber}`);
        expect(headerLine).toContain(input.timestamp);
        expect(headerLine).toContain(input.model);
      })
    );
  });
});
