import { CommitFlowManager } from "./commit-flow.js";

function makeAssistantMessage(text: string) {
  return {
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    timestamp: 1_740_268_800_000,
    api: "anthropic-messages",
    usage: { input: 100, output: 50, cacheRead: 0 },
    stopReason: "end_turn" as const,
  };
}

function makeUserMessage(text: string) {
  return {
    role: "user" as const,
    content: [{ type: "text" as const, text }],
    timestamp: 1_740_268_799_000,
  };
}

const COMMIT_RESPONSE = [
  "Here is the commit content:",
  "",
  "### Branch Purpose",
  "Build the GCC extension for persistent agent memory.",
  "",
  "### Previous Progress Summary",
  "Completed Phase 1 foundation: YAML parser, state manager, hash generator.",
  "",
  "### This Commit's Contribution",
  "Added OTA formatter and branch manager modules with full test coverage.",
].join("\n");

describe("commitFlowManager", () => {
  it("hasPending returns false initially", () => {
    const manager = new CommitFlowManager();
    expect(manager.hasPending()).toBeFalsy();
  });

  it("hasPending returns true after setPendingCommit", () => {
    const manager = new CommitFlowManager();
    manager.setPendingCommit("Added phase 1 modules");
    expect(manager.hasPending()).toBeTruthy();
  });

  it("extracts commit content from the last assistant message", () => {
    const manager = new CommitFlowManager();
    manager.setPendingCommit("Added phase 1 modules");

    const messages = [
      makeUserMessage("Please commit"),
      makeAssistantMessage("Let me prepare the commit..."),
      makeUserMessage("Here's the log content"),
      makeAssistantMessage(COMMIT_RESPONSE),
    ];

    const result = manager.handleAgentEnd(messages);

    expect(result).not.toBeNull();
    expect(result?.summary).toBe("Added phase 1 modules");
    expect(result?.commitContent).toContain("### Branch Purpose");
    expect(result?.commitContent).toContain("### Previous Progress Summary");
    expect(result?.commitContent).toContain("### This Commit's Contribution");
    expect(result?.commitContent).toContain(
      "Build the GCC extension for persistent agent memory."
    );
  });

  it("resets pending state after successful extraction", () => {
    const manager = new CommitFlowManager();
    manager.setPendingCommit("Added phase 1 modules");

    const messages = [makeAssistantMessage(COMMIT_RESPONSE)];
    manager.handleAgentEnd(messages);

    expect(manager.hasPending()).toBeFalsy();
  });

  it("returns null when no commit is pending", () => {
    const manager = new CommitFlowManager();

    const messages = [makeAssistantMessage(COMMIT_RESPONSE)];
    const result = manager.handleAgentEnd(messages);

    expect(result).toBeNull();
  });

  it("returns null when last assistant message lacks commit blocks", () => {
    const manager = new CommitFlowManager();
    manager.setPendingCommit("Added phase 1 modules");

    const messages = [
      makeAssistantMessage("I don't know how to respond to that."),
    ];

    const result = manager.handleAgentEnd(messages);

    expect(result).toBeNull();
    // Pending state should be preserved so the agent can retry
    expect(manager.hasPending()).toBeTruthy();
  });

  it("ignores non-assistant messages when finding the last response", () => {
    const manager = new CommitFlowManager();
    manager.setPendingCommit("Added phase 1 modules");

    // Last message is a user message, assistant message with commit is earlier
    const messages = [
      makeAssistantMessage(COMMIT_RESPONSE),
      makeUserMessage("thanks"),
    ];

    const result = manager.handleAgentEnd(messages);

    expect(result).not.toBeNull();
    expect(result?.commitContent).toContain("### Branch Purpose");
  });

  it("extracts only the commit blocks from a longer response", () => {
    const manager = new CommitFlowManager();
    manager.setPendingCommit("Phase 2 complete");

    const responseWithPreamble = [
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

    const messages = [makeAssistantMessage(responseWithPreamble)];
    const result = manager.handleAgentEnd(messages);

    expect(result).not.toBeNull();
    expect(result?.commitContent).toContain("### Branch Purpose");
    expect(result?.commitContent).not.toContain("I've reviewed the log");
    expect(result?.commitContent).not.toContain("Let me know");
  });
});
