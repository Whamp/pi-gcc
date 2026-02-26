import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@mariozechner/pi-coding-agent";

import activate from "./index.js";

// Helpers

interface RegisteredHandler {
  event: string;
  handler: (event: unknown, ctx: ExtensionContext) => unknown;
}

interface MockUi {
  notifications: { message: string; type: "info" | "warning" | "error" }[];
  notify: (message: string, type?: "info" | "warning" | "error") => void;
}

interface MockPi {
  tools: ToolDefinition[];
  handlers: RegisteredHandler[];
  api: ExtensionAPI;
}

function createMockUi(): MockUi {
  const notifications: {
    message: string;
    type: "info" | "warning" | "error";
  }[] = [];
  return {
    notifications,
    notify(message: string, type: "info" | "warning" | "error" = "info") {
      notifications.push({ message, type });
    },
  };
}

function createMockPi(): MockPi {
  const tools: ToolDefinition[] = [];
  const handlers: RegisteredHandler[] = [];

  const api = {
    registerTool(def: ToolDefinition) {
      tools.push(def);
    },
    on(
      event: string,
      handler: (event: unknown, ctx: ExtensionContext) => unknown
    ) {
      handlers.push({ event, handler });
    },
  } as unknown as ExtensionAPI;

  return { tools, handlers, api };
}

function getHandler(
  handlers: RegisteredHandler[],
  eventName: string
): ((event: unknown, ctx: ExtensionContext) => unknown) | undefined {
  return handlers.find((h) => h.event === eventName)?.handler;
}

function setupInitializedProject(): {
  projectDir: string;
  cleanup: () => void;
} {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-index-test-"));
  const gccDir = path.join(projectDir, ".gcc");
  const branchDir = path.join(gccDir, "branches", "main");

  fs.mkdirSync(branchDir, { recursive: true });
  fs.writeFileSync(
    path.join(gccDir, "state.yaml"),
    [
      "active_branch: main",
      'initialized: "2026-02-23T00:00:00Z"',
      "last_commit:",
      "  branch: main",
      "  hash: a1b2c3d4",
      '  timestamp: "2026-02-23T00:30:00Z"',
      '  summary: "Initial foundation"',
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(branchDir, "log.md"),
    "## Turn 1 | 2026-02-23T02:00:00Z | anthropic/claude\n\n**Thought**: setup\n\n"
  );
  fs.writeFileSync(
    path.join(branchDir, "commits.md"),
    "# main\n\n**Purpose:** Main branch\n"
  );
  fs.writeFileSync(path.join(branchDir, "metadata.yaml"), "");

  return {
    projectDir,
    cleanup: () => fs.rmSync(projectDir, { recursive: true, force: true }),
  };
}

function getFirstText(result: AgentToolResult<unknown> | undefined): string {
  const first = result?.content[0];
  if (first?.type !== "text") {
    return "";
  }

  return first.text;
}

describe("extensionWiring", () => {
  it("should register all GCC tools and required event handlers", () => {
    // Arrange
    const mockPi = createMockPi();

    // Act
    activate(mockPi.api);

    // Assert
    const toolNames = mockPi.tools.map((t) => t.name);
    expect(toolNames).toHaveLength(5);
    expect(toolNames).toContain("gcc_branch");
    expect(toolNames).toContain("gcc_commit");
    expect(toolNames).toContain("gcc_context");
    expect(toolNames).toContain("gcc_merge");
    expect(toolNames).toContain("gcc_switch");

    const handlerNames = mockPi.handlers.map((h) => h.event);
    expect(handlerNames).toContain("turn_end");
    expect(handlerNames).not.toContain("before_agent_start");
    expect(handlerNames).not.toContain("agent_end");
    expect(handlerNames).toContain("session_start");
    expect(handlerNames).not.toContain("session_shutdown");
    expect(handlerNames).toContain("session_before_compact");
    expect(handlerNames).toContain("resources_discover");
  });

  it("should return tool result shape and guard when GCC is uninitialized", async () => {
    // Arrange
    const mockPi = createMockPi();
    activate(mockPi.api);

    const ui = createMockUi();
    const ctx = {
      cwd: fs.mkdtempSync(path.join(os.tmpdir(), "gcc-uninit-")),
      ui,
    } as unknown as ExtensionContext;

    try {
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const gccContext = mockPi.tools.find((t) => t.name === "gcc_context");
      expect(gccContext).toBeDefined();

      // Act
      const result = await gccContext?.execute(
        "tc1",
        { level: "status" },
        undefined,
        undefined,
        ctx
      );

      // Assert
      expect(result?.content[0]?.type).toBe("text");
      expect(result?.details).toStrictEqual({});
      expect(getFirstText(result)).toContain("GCC not initialized");
    } finally {
      fs.rmSync((ctx as { cwd: string }).cwd, { recursive: true, force: true });
    }
  });

  it("should register session file in state.yaml on session_start", async () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ui = createMockUi();
      const ctx = {
        cwd: projectDir,
        ui,
        sessionManager: {
          getSessionFile: () => "/tmp/pi-session-123.jsonl",
        },
      } as unknown as ExtensionContext;

      const sessionStart = getHandler(mockPi.handlers, "session_start");

      // Act
      await sessionStart?.({ type: "session_start" }, ctx);
      await sessionStart?.({ type: "session_start" }, ctx);

      // Assert
      const stateYaml = fs.readFileSync(
        path.join(projectDir, ".gcc", "state.yaml"),
        "utf8"
      );

      expect(stateYaml).toContain("sessions:");
      expect(stateYaml).toContain("/tmp/pi-session-123.jsonl");
      const matches = stateYaml.match(/\/tmp\/pi-session-123\.jsonl/g);
      expect(matches?.length).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("should show warning notification when log.md exceeds size threshold", async () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const logPath = path.join(
        projectDir,
        ".gcc",
        "branches",
        "main",
        "log.md"
      );
      fs.writeFileSync(logPath, "x".repeat(700 * 1024));

      const ui = createMockUi();
      const ctx = {
        cwd: projectDir,
        ui,
        sessionManager: {
          getSessionFile: () => "/tmp/pi-session-large-log.jsonl",
        },
      } as unknown as ExtensionContext;

      const sessionStart = getHandler(mockPi.handlers, "session_start");

      // Act
      await sessionStart?.({ type: "session_start" }, ctx);

      // Assert
      expect(ui.notifications).toHaveLength(1);
      expect(ui.notifications[0].type).toBe("warning");
      expect(ui.notifications[0].message).toContain("log.md is large");
      expect(ui.notifications[0].message).toContain("should commit");
    } finally {
      cleanup();
    }
  });

  it("should update the active session branch mapping after gcc_branch", async () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ui = createMockUi();
      const ctx = {
        cwd: projectDir,
        ui,
        sessionManager: {
          getSessionFile: () => "/tmp/pi-session-branch-sync.jsonl",
        },
      } as unknown as ExtensionContext;

      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const gccBranch = mockPi.tools.find((t) => t.name === "gcc_branch");
      expect(gccBranch).toBeDefined();

      // Act
      await gccBranch?.execute(
        "tc-branch-sync",
        { name: "feature-x", purpose: "Investigate branch sync" },
        undefined,
        undefined,
        ctx
      );

      // Assert
      const stateYaml = fs.readFileSync(
        path.join(projectDir, ".gcc", "state.yaml"),
        "utf8"
      );

      expect(stateYaml).toMatch(
        /sessions:[\s\S]*file: "\/tmp\/pi-session-branch-sync\.jsonl"[\s\S]*branch: "feature-x"/
      );
    } finally {
      cleanup();
    }
  });

  it("should discover GCC skill path with ESM-safe resolution", async () => {
    // Arrange
    const mockPi = createMockPi();
    activate(mockPi.api);

    const resourcesDiscover = getHandler(mockPi.handlers, "resources_discover");
    expect(resourcesDiscover).toBeDefined();

    const ui = createMockUi();
    const ctx = { cwd: process.cwd(), ui } as unknown as ExtensionContext;

    // Act
    const result = (await resourcesDiscover?.(
      { type: "resources_discover", cwd: process.cwd(), reason: "startup" },
      ctx
    )) as { skillPaths?: string[] } | undefined;

    // Assert
    expect(result?.skillPaths?.length).toBe(1);
    expect(result?.skillPaths?.[0]).toContain("skills/gcc");
  });

  it("should lazily load state when .gcc/ is created after session_start", async () => {
    // Arrange
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-lazy-init-"));

    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ui = createMockUi();
      const ctx = {
        cwd: projectDir,
        ui,
        sessionManager: {
          getSessionFile: () => "/tmp/pi-session-lazy.jsonl",
        },
      } as unknown as ExtensionContext;

      // session_start fires with no .gcc/ directory
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const gccContext = mockPi.tools.find((t) => t.name === "gcc_context");

      // Tool returns "not initialized" before .gcc/ exists
      const before = await gccContext?.execute(
        "tc-lazy-before",
        {},
        undefined,
        undefined,
        ctx
      );
      expect(getFirstText(before)).toContain("GCC not initialized");

      // Simulate mid-session init: create .gcc/ structure
      const branchDir = path.join(projectDir, ".gcc", "branches", "main");
      fs.mkdirSync(branchDir, { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, ".gcc", "state.yaml"),
        ["active_branch: main", 'initialized: "2026-02-25T00:00:00Z"'].join(
          "\n"
        )
      );
      fs.writeFileSync(path.join(branchDir, "log.md"), "");
      fs.writeFileSync(
        path.join(branchDir, "commits.md"),
        "# main\n\n**Purpose:** Main branch\n"
      );
      fs.writeFileSync(path.join(branchDir, "metadata.yaml"), "");

      // Act
      const after = await gccContext?.execute(
        "tc-lazy-after",
        {},
        undefined,
        undefined,
        ctx
      );

      // Assert
      expect(getFirstText(after)).not.toContain("GCC not initialized");
      expect(getFirstText(after)).toContain("Active branch: main");

      const stateYaml = fs.readFileSync(
        path.join(projectDir, ".gcc", "state.yaml"),
        "utf8"
      );
      expect(stateYaml).toContain("/tmp/pi-session-lazy.jsonl");
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("should return error from gcc_commit when subagent fails", async () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ui = createMockUi();
      const ctx = {
        cwd: projectDir,
        ui,
        sessionManager: {
          getSessionFile: () => "/tmp/pi-session-commit-fail.jsonl",
        },
      } as unknown as ExtensionContext;

      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const gccCommit = mockPi.tools.find((t) => t.name === "gcc_commit");
      expect(gccCommit).toBeDefined();

      const controller = new AbortController();
      controller.abort();

      // Act
      const result = await gccCommit?.execute(
        "tc-commit",
        { summary: "Test commit" },
        controller.signal,
        undefined,
        ctx
      );

      // Assert
      expect(result?.content[0]?.type).toBe("text");
      expect(result?.details).toStrictEqual({});
    } finally {
      cleanup();
    }
  });
});
