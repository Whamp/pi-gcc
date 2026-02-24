import { extractOtaInput } from "./ota-logger.js";

// Mock data matching the pi-coding-agent TurnEndEvent shape.
// Using plain objects — no need to import actual types.

function makeAssistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    role: "assistant" as const,
    content: [
      { type: "text", text: "I need to read the file first." },
      { type: "thinking", thinking: "Let me analyze the codebase." },
      {
        type: "toolCall",
        id: "tc1",
        name: "read",
        arguments: { path: "src/index.ts" },
      },
      {
        type: "toolCall",
        id: "tc2",
        name: "bash",
        arguments: { command: "ls -la" },
      },
    ],
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    timestamp: 1_740_268_800_000, // 2025-02-23T00:00:00.000Z
    api: "anthropic-messages",
    usage: { input: 100, output: 50, cacheRead: 0 },
    stopReason: "tool_use",
    ...overrides,
  };
}

function makeToolResult(
  toolName: string,
  isError: boolean,
  text: string,
  details?: unknown
) {
  return {
    role: "toolResult" as const,
    toolCallId: `tc-${toolName}`,
    toolName,
    content: [{ type: "text", text }],
    details,
    isError,
    timestamp: 1_740_268_801_000,
  };
}

describe("extractOtaInput", () => {
  it("extracts a full OtaEntryInput from a turn_end event", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 0,
      message: makeAssistantMessage(),
      toolResults: [
        makeToolResult("read", false, "file contents...", {
          path: "src/index.ts",
          lines: 45,
        }),
        makeToolResult("bash", false, "total 3 files", {
          command: "ls -la",
          exitCode: 0,
        }),
      ],
    };

    const result = extractOtaInput(event);

    expect(result).not.toBeNull();
    expect(result?.turnNumber).toBe(1); // turnIndex + 1
    expect(result?.timestamp).toBe("2025-02-23T00:00:00.000Z");
    expect(result?.model).toBe("anthropic/claude-sonnet-4-20250514");
    expect(result?.thought).toBe("I need to read the file first.");
    expect(result?.thinking).toBe("Let me analyze the codebase.");
    expect(result?.actions).toStrictEqual([
      'read(path: "src/index.ts")',
      'bash(command: "ls -la")',
    ]);
    expect(result?.observations).toStrictEqual([
      "read: success",
      "bash: success",
    ]);
  });

  it("handles tool result errors", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 2,
      message: makeAssistantMessage({
        content: [
          { type: "text", text: "Running a command." },
          {
            type: "toolCall",
            id: "tc1",
            name: "bash",
            arguments: { command: "false" },
          },
        ],
      }),
      toolResults: [makeToolResult("bash", true, "exit code 1")],
    };

    const result = extractOtaInput(event);

    expect(result).not.toBeNull();
    expect(result?.observations).toStrictEqual(["bash: error"]);
  });

  it("returns null for non-assistant messages", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 0,
      message: {
        role: "custom" as const,
        content: [] as { type: string }[],
        timestamp: 1_740_268_800_000,
      },
      toolResults: [],
    };

    const result = extractOtaInput(event);
    expect(result).toBeNull();
  });

  it("returns null for empty assistant messages (no text, no tool calls)", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 0,
      message: makeAssistantMessage({ content: [] }),
      toolResults: [],
    };

    const result = extractOtaInput(event);
    expect(result).toBeNull();
  });

  it("handles turns with text but no tool calls", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 4,
      message: makeAssistantMessage({
        content: [{ type: "text", text: "I understand the problem now." }],
      }),
      toolResults: [],
    };

    const result = extractOtaInput(event);

    expect(result).not.toBeNull();
    expect(result?.turnNumber).toBe(5);
    expect(result?.thought).toBe("I understand the problem now.");
    expect(result?.thinking).toBe("");
    expect(result?.actions).toStrictEqual([]);
    expect(result?.observations).toStrictEqual([]);
  });

  it("handles turns with only thinking and tool calls (no text)", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 1,
      message: makeAssistantMessage({
        content: [
          { type: "thinking", thinking: "Internal reasoning here." },
          {
            type: "toolCall",
            id: "tc1",
            name: "edit",
            arguments: { path: "src/foo.ts" },
          },
        ],
      }),
      toolResults: [
        makeToolResult("edit", false, "edited", { path: "src/foo.ts" }),
      ],
    };

    const result = extractOtaInput(event);

    expect(result).not.toBeNull();
    expect(result?.thought).toBe("");
    expect(result?.thinking).toBe("Internal reasoning here.");
    expect(result?.actions).toStrictEqual(['edit(path: "src/foo.ts")']);
  });

  it("concatenates multiple text blocks", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 0,
      message: makeAssistantMessage({
        content: [
          { type: "text", text: "First part." },
          { type: "text", text: "Second part." },
        ],
      }),
      toolResults: [],
    };

    const result = extractOtaInput(event);

    expect(result).not.toBeNull();
    expect(result?.thought).toBe("First part.\n\nSecond part.");
  });

  it("concatenates multiple thinking blocks", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 0,
      message: makeAssistantMessage({
        content: [
          { type: "thinking", thinking: "Step 1." },
          { type: "text", text: "Response." },
          { type: "thinking", thinking: "Step 2." },
        ],
      }),
      toolResults: [],
    };

    const result = extractOtaInput(event);

    expect(result).not.toBeNull();
    expect(result?.thinking).toBe("Step 1.\n\nStep 2.");
  });

  it("formats tool call arguments as key: value pairs", () => {
    const event = {
      type: "turn_end" as const,
      turnIndex: 0,
      message: makeAssistantMessage({
        content: [
          { type: "text", text: "Editing." },
          {
            type: "toolCall",
            id: "tc1",
            name: "edit",
            arguments: {
              path: "src/index.ts",
              oldText: "hello",
              newText: "world",
            },
          },
        ],
      }),
      toolResults: [makeToolResult("edit", false, "done")],
    };

    const result = extractOtaInput(event);

    expect(result).not.toBeNull();
    expect(result?.actions).toStrictEqual([
      'edit(path: "src/index.ts", oldText: "hello", newText: "world")',
    ]);
  });
});
