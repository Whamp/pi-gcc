import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import fc from "fast-check";

import activate from "./index.js";

// Helpers

interface RegisteredHandler {
  event: string;
  handler: (event: unknown, ctx: ExtensionContext) => unknown;
}

interface MockUi {
  notifications: { message: string; type: "info" | "warning" | "error" }[];
  statuses: Map<string, string | undefined>;
  notify: (message: string, type?: "info" | "warning" | "error") => void;
  setStatus: (key: string, text: string | undefined) => void;
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
  const statuses = new Map<string, string | undefined>();
  return {
    notifications,
    statuses,
    notify(message: string, type: "info" | "warning" | "error" = "info") {
      notifications.push({ message, type });
    },
    setStatus(key: string, text: string | undefined) {
      if (text === undefined) {
        statuses.delete(key);
      } else {
        statuses.set(key, text);
      }
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
  const projectDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "memory-index-test-")
  );
  const memoryDir = path.join(projectDir, ".memory");
  const branchDir = path.join(memoryDir, "branches", "main");

  fs.mkdirSync(branchDir, { recursive: true });
  fs.writeFileSync(
    path.join(memoryDir, "state.yaml"),
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

function createCtx(
  projectDir: string,
  options?: { ui?: MockUi; sessionFile?: string }
): ExtensionContext {
  const ui = options?.ui ?? createMockUi();
  const sessionFile = options?.sessionFile ?? "/tmp/pi-session-test.jsonl";
  return {
    cwd: projectDir,
    ui,
    sessionManager: {
      getSessionFile: () => sessionFile,
    },
  } as unknown as ExtensionContext;
}

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") {
    return [];
  }

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry])
    : Object.entries(value);

  const paths: string[] = [];
  for (const [key, child] of entries) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    paths.push(currentPath);
    paths.push(...collectKeyPaths(child, currentPath));
  }

  return paths;
}

function writeRoadmap(projectDir: string, body: string): void {
  fs.writeFileSync(path.join(projectDir, ".memory", "main.md"), body);
}

function readInjectedSystemPrompt(
  result: { systemPrompt?: string } | undefined
): string {
  expect(result).toBeDefined();
  expect(result?.systemPrompt).toBeDefined();
  return result?.systemPrompt ?? "";
}

function extractFrozenSnapshot(
  injectedPrompt: string,
  basePrompt: string
): string {
  const prefix = `${basePrompt}\n\n`;
  expect(injectedPrompt.startsWith(prefix)).toBeTruthy();
  return injectedPrompt.slice(prefix.length);
}

describe("extensionWiring", () => {
  it("should register 2 memory tools and required event handlers", () => {
    // Arrange
    const mockPi = createMockPi();

    // Act
    activate(mockPi.api);

    // Assert
    const toolNames = mockPi.tools.map((t) => t.name);
    expect(toolNames).toHaveLength(2);
    expect(toolNames).toContain("memory_branch");
    expect(toolNames).toContain("memory_commit");

    const handlerNames = mockPi.handlers.map((h) => h.event);
    expect(handlerNames).toContain("turn_end");
    expect(handlerNames).toContain("before_agent_start");
    expect(handlerNames).toContain("session_start");
    expect(handlerNames).toContain("session_switch");
    expect(handlerNames).toContain("session_compact");
    expect(handlerNames).toContain("session_before_compact");
    expect(handlerNames).toContain("resources_discover");
  });

  it('should constrain memory_branch "action" to create/switch/merge using enum', () => {
    // Arrange
    const mockPi = createMockPi();
    activate(mockPi.api);

    // Act
    const memoryBranch = mockPi.tools.find((t) => t.name === "memory_branch");
    expect(memoryBranch).toBeDefined();

    const actionSchema = (
      memoryBranch as {
        parameters: {
          properties?: {
            action?: {
              enum?: string[];
              anyOf?: unknown[];
            };
          };
        };
      }
    ).parameters.properties?.action;

    // Assert
    expect(actionSchema?.enum).toStrictEqual(["create", "switch", "merge"]);
    expect(actionSchema?.anyOf).toBeUndefined();
  });

  it('should keep memory_branch action schema free of "anyOf" and "const" keys', () => {
    // Arrange
    const mockPi = createMockPi();
    activate(mockPi.api);

    const memoryBranch = mockPi.tools.find((t) => t.name === "memory_branch");
    expect(memoryBranch).toBeDefined();

    const actionSchema = (
      memoryBranch as {
        parameters: {
          properties?: {
            action?: unknown;
          };
        };
      }
    ).parameters.properties?.action;

    const keyPaths = collectKeyPaths(actionSchema);
    expect(keyPaths.length).toBeGreaterThan(0);

    // Act / Assert
    fc.assert(
      fc.property(fc.integer({ min: 0, max: keyPaths.length - 1 }), (index) => {
        const segments = keyPaths[index]?.split(".") ?? [];
        expect(segments).not.toContain("anyOf");
        expect(segments).not.toContain("const");
      })
    );
  });

  it("should return tool result shape and guard when memory is uninitialized", async () => {
    // Arrange
    const mockPi = createMockPi();
    activate(mockPi.api);

    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-uninit-"));

    try {
      const ctx = createCtx(projectDir);

      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const memoryBranch = mockPi.tools.find((t) => t.name === "memory_branch");
      expect(memoryBranch).toBeDefined();

      // Act
      const result = await memoryBranch?.execute(
        "tc1",
        { action: "create", name: "test", purpose: "test" },
        undefined,
        undefined,
        ctx
      );

      // Assert
      expect(result?.content[0]?.type).toBe("text");
      expect(result?.details).toStrictEqual({});
      expect(getFirstText(result)).toContain("Brain not initialized");
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("should register session file in state.yaml on session_start", async () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);

      const sessionStart = getHandler(mockPi.handlers, "session_start");

      // Act
      await sessionStart?.({ type: "session_start" }, ctx);
      await sessionStart?.({ type: "session_start" }, ctx);

      // Assert
      const stateYaml = fs.readFileSync(
        path.join(projectDir, ".memory", "state.yaml"),
        "utf8"
      );

      expect(stateYaml).toContain("sessions:");
      expect(stateYaml).toContain("/tmp/pi-session-test.jsonl");
      const matches = stateYaml.match(/\/tmp\/pi-session-test\.jsonl/g);
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
        ".memory",
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

  it("should set footer status on session_start for initialized project", async () => {
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
          getSessionFile: () => "/tmp/pi-session-status.jsonl",
        },
      } as unknown as ExtensionContext;

      const sessionStart = getHandler(mockPi.handlers, "session_start");

      // Act
      await sessionStart?.({ type: "session_start" }, ctx);

      // Assert — should set persistent footer status
      expect(ui.statuses.get("brain")).toContain("main");
      expect(ui.statuses.get("brain")).toContain("1 uncommitted turn");
    } finally {
      cleanup();
    }
  });

  it("should set footer status even when log.md is large", async () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const logPath = path.join(
        projectDir,
        ".memory",
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
          getSessionFile: () => "/tmp/pi-session-large-status.jsonl",
        },
      } as unknown as ExtensionContext;

      const sessionStart = getHandler(mockPi.handlers, "session_start");

      // Act
      await sessionStart?.({ type: "session_start" }, ctx);

      // Assert — warning notification AND footer status
      expect(ui.notifications).toHaveLength(1);
      expect(ui.notifications[0].type).toBe("warning");
      expect(ui.statuses.get("brain")).toContain("main");
    } finally {
      cleanup();
    }
  });

  it("should clear footer status when session_start loads an uninitialized project", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    const uninitializedDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "memory-index-uninitialized-")
    );

    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ui = createMockUi();
      const sessionStart = getHandler(mockPi.handlers, "session_start");

      const initializedCtx = createCtx(projectDir, {
        ui,
        sessionFile: "/tmp/pi-session-initialized.jsonl",
      });
      await sessionStart?.({ type: "session_start" }, initializedCtx);
      expect(ui.statuses.get("brain")).toContain("main");

      const uninitializedCtx = createCtx(uninitializedDir, {
        ui,
        sessionFile: "/tmp/pi-session-uninitialized.jsonl",
      });
      await sessionStart?.({ type: "session_start" }, uninitializedCtx);

      expect(ui.statuses.get("brain")).toBeUndefined();
    } finally {
      cleanup();
      fs.rmSync(uninitializedDir, { recursive: true, force: true });
    }
  });

  it("should refresh footer status after memory_branch switches branches", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ui = createMockUi();
      const ctx = createCtx(projectDir, {
        ui,
        sessionFile: "/tmp/pi-session-footer-refresh.jsonl",
      });

      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const memoryBranch = mockPi.tools.find((t) => t.name === "memory_branch");
      await memoryBranch?.execute(
        "tc-footer-refresh",
        {
          action: "create",
          name: "feature-status",
          purpose: "Check footer updates",
        },
        undefined,
        undefined,
        ctx
      );

      expect(ui.statuses.get("brain")).toContain("feature-status");
    } finally {
      cleanup();
    }
  });

  it("should refresh footer status on session_switch for initialized project", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ui = createMockUi();
      const ctx = createCtx(projectDir, {
        ui,
        sessionFile: "/tmp/pi-session-switch-refresh.jsonl",
      });

      const sessionStart = getHandler(mockPi.handlers, "session_start");
      const sessionSwitch = getHandler(mockPi.handlers, "session_switch");
      const memoryBranch = mockPi.tools.find((t) => t.name === "memory_branch");

      await sessionStart?.({ type: "session_start" }, ctx);
      await memoryBranch?.execute(
        "tc-switch-refresh",
        {
          action: "create",
          name: "feature-switch",
          purpose: "Check switch refresh",
        },
        undefined,
        undefined,
        ctx
      );

      ui.setStatus("brain", "Brain: stale (99 uncommitted turns)");

      await sessionSwitch?.(
        {
          type: "session_switch",
          reason: "resume",
          previousSessionFile: "/tmp/previous-session.jsonl",
        },
        ctx
      );

      expect(ui.statuses.get("brain")).toContain("feature-switch");
      expect(ui.statuses.get("brain")).toContain("0 uncommitted turns");
    } finally {
      cleanup();
    }
  });

  it("should clear footer status on session_switch to an uninitialized project", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    const uninitializedDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "memory-index-switch-uninitialized-")
    );

    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ui = createMockUi();
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      const sessionSwitch = getHandler(mockPi.handlers, "session_switch");

      const initializedCtx = createCtx(projectDir, {
        ui,
        sessionFile: "/tmp/pi-session-switch-initialized.jsonl",
      });
      await sessionStart?.({ type: "session_start" }, initializedCtx);
      expect(ui.statuses.get("brain")).toContain("main");

      const uninitializedCtx = createCtx(uninitializedDir, {
        ui,
        sessionFile: "/tmp/pi-session-switch-uninitialized.jsonl",
      });
      await sessionSwitch?.(
        {
          type: "session_switch",
          reason: "new",
          previousSessionFile: "/tmp/pi-session-switch-initialized.jsonl",
        },
        uninitializedCtx
      );

      expect(ui.statuses.get("brain")).toBeUndefined();
    } finally {
      cleanup();
      fs.rmSync(uninitializedDir, { recursive: true, force: true });
    }
  });

  it("should update the active session branch mapping after memory_branch", async () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = {
        cwd: projectDir,
        ui: createMockUi(),
        sessionManager: {
          getSessionFile: () => "/tmp/pi-session-branch-sync.jsonl",
        },
      } as unknown as ExtensionContext;

      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const memoryBranch = mockPi.tools.find((t) => t.name === "memory_branch");
      expect(memoryBranch).toBeDefined();

      // Act
      await memoryBranch?.execute(
        "tc-branch-sync",
        {
          action: "create",
          name: "feature-x",
          purpose: "Investigate branch sync",
        },
        undefined,
        undefined,
        ctx
      );

      // Assert
      const stateYaml = fs.readFileSync(
        path.join(projectDir, ".memory", "state.yaml"),
        "utf8"
      );

      expect(stateYaml).toMatch(
        /sessions:[\s\S]*file: "\/tmp\/pi-session-branch-sync\.jsonl"[\s\S]*branch: "feature-x"/
      );
    } finally {
      cleanup();
    }
  });

  it("should discover Brain skill path with ESM-safe resolution", async () => {
    // Arrange
    const mockPi = createMockPi();
    activate(mockPi.api);

    const resourcesDiscover = getHandler(mockPi.handlers, "resources_discover");
    expect(resourcesDiscover).toBeDefined();

    const ctx = createCtx(process.cwd());

    // Act
    const result = (await resourcesDiscover?.(
      { type: "resources_discover", cwd: process.cwd(), reason: "startup" },
      ctx
    )) as { skillPaths?: string[] } | undefined;

    // Assert
    expect(result?.skillPaths?.length).toBe(1);
    expect(result?.skillPaths?.[0]).toContain("skills/brain");
  });

  it("should lazily load state when .memory/ is created after session_start", async () => {
    // Arrange
    const projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "memory-lazy-init-")
    );

    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);

      // session_start fires with no .memory/ directory
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const memoryBranch = mockPi.tools.find((t) => t.name === "memory_branch");

      // Tool returns "not initialized" before .memory/ exists
      const before = await memoryBranch?.execute(
        "tc-lazy-before",
        { action: "create", name: "test", purpose: "test" },
        undefined,
        undefined,
        ctx
      );
      expect(getFirstText(before)).toContain("Brain not initialized");

      // Simulate mid-session init: create .memory/ structure
      const branchDir = path.join(projectDir, ".memory", "branches", "main");
      fs.mkdirSync(branchDir, { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, ".memory", "state.yaml"),
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

      // Act — switch action to verify lazy loading
      const after = await memoryBranch?.execute(
        "tc-lazy-after",
        { action: "switch", branch: "main" },
        undefined,
        undefined,
        ctx
      );

      // Assert
      expect(getFirstText(after)).not.toContain("Brain not initialized");
      expect(getFirstText(after)).toContain("Active branch: main");

      const stateYaml = fs.readFileSync(
        path.join(projectDir, ".memory", "state.yaml"),
        "utf8"
      );
      expect(stateYaml).toContain("/tmp/pi-session-test.jsonl");
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("should freeze lazy-init snapshot after first successful before_agent_start", async () => {
    // Arrange
    const projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "memory-lazy-snapshot-")
    );

    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir, {
        sessionFile: "/tmp/pi-session-lazy-snapshot.jsonl",
      });
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      const beforeStart = getHandler(mockPi.handlers, "before_agent_start");
      expect(beforeStart).toBeDefined();

      await sessionStart?.({ type: "session_start" }, ctx);

      // before_agent_start should not inject before .memory exists
      const beforeInit = await beforeStart?.(
        {
          type: "before_agent_start",
          prompt: "pre-init",
          systemPrompt: "base-pre",
        },
        ctx
      );
      expect(beforeInit).toBeUndefined();

      // Simulate mid-session init
      const branchDir = path.join(projectDir, ".memory", "branches", "main");
      fs.mkdirSync(branchDir, { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, ".memory", "state.yaml"),
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

      const initialToken = "[[ROADMAP:lazy-initial]]";
      const updatedToken = "[[ROADMAP:lazy-updated]]";
      writeRoadmap(projectDir, `# Roadmap\n\n${initialToken}`);

      // Act
      const firstResult = (await beforeStart?.(
        {
          type: "before_agent_start",
          prompt: "first",
          systemPrompt: "base-one",
        },
        ctx
      )) as { systemPrompt?: string } | undefined;
      const firstSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(firstResult),
        "base-one"
      );

      writeRoadmap(projectDir, `# Roadmap\n\n${updatedToken}`);

      const secondResult = (await beforeStart?.(
        {
          type: "before_agent_start",
          prompt: "second",
          systemPrompt: "base-two",
        },
        ctx
      )) as { systemPrompt?: string } | undefined;
      const secondSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(secondResult),
        "base-two"
      );

      // Assert
      expect(firstSnapshot).toContain(initialToken);
      expect(firstSnapshot).not.toContain(updatedToken);
      expect(secondSnapshot).toBe(firstSnapshot);
      expect(secondSnapshot).toContain(initialToken);
      expect(secondSnapshot).not.toContain(updatedToken);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("should return error from memory_commit when subagent fails", async () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);

      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const memoryCommit = mockPi.tools.find((t) => t.name === "memory_commit");
      expect(memoryCommit).toBeDefined();

      const controller = new AbortController();
      controller.abort();

      // Act
      const result = await memoryCommit?.execute(
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

  // --- before_agent_start hook ---

  it("should inject status into systemPrompt on first before_agent_start", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const beforeStart = getHandler(mockPi.handlers, "before_agent_start");
      const basePrompt = "...";
      const result = (await beforeStart?.(
        {
          type: "before_agent_start",
          prompt: "hello",
          systemPrompt: basePrompt,
        },
        ctx
      )) as { systemPrompt?: string; message?: unknown } | undefined;

      expect(result).toBeDefined();
      expect(result?.message).toBeUndefined();
      expect(result?.systemPrompt).toContain(basePrompt);
      expect(result?.systemPrompt).toContain("# Memory Status");
      expect(result?.systemPrompt).toContain("Active branch:");
    } finally {
      cleanup();
    }
  });

  it("should cap roadmap size in before_agent_start injection", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      fs.writeFileSync(
        path.join(projectDir, ".memory", "main.md"),
        `# Roadmap\n\n${"x".repeat(80_000)}`
      );

      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const beforeStart = getHandler(mockPi.handlers, "before_agent_start");
      const result = (await beforeStart?.(
        { type: "before_agent_start", prompt: "hello", systemPrompt: "..." },
        ctx
      )) as { systemPrompt?: string } | undefined;

      expect(result).toBeDefined();
      expect(result?.systemPrompt).toContain("Roadmap truncated");
      expect(result?.systemPrompt).toContain("read .memory/main.md");
      expect(result?.systemPrompt?.length ?? 0).toBeLessThan(5000);
    } finally {
      cleanup();
    }
  });

  it("should inject status on EVERY before_agent_start call while keeping base prompt current", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      writeRoadmap(projectDir, "# Roadmap\n\n[[ROADMAP:base]]");

      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      await sessionStart?.({ type: "session_start" }, ctx);

      const beforeStart = getHandler(mockPi.handlers, "before_agent_start");

      const firstEvent = {
        type: "before_agent_start",
        prompt: "hello",
        systemPrompt: "base-one",
      };
      const secondEvent = {
        type: "before_agent_start",
        prompt: "hello",
        systemPrompt: "base-two",
      };

      // First call injects and freezes the memory snapshot
      const result1 = (await beforeStart?.(firstEvent, ctx)) as {
        systemPrompt?: string;
      };

      // Subsequent calls MUST also inject to prevent Pi from resetting to base prompt
      const result2 = (await beforeStart?.(secondEvent, ctx)) as {
        systemPrompt?: string;
      };

      const firstPrompt = readInjectedSystemPrompt(result1);
      const secondPrompt = readInjectedSystemPrompt(result2);

      const firstSnapshot = extractFrozenSnapshot(
        firstPrompt,
        firstEvent.systemPrompt
      );
      const secondSnapshot = extractFrozenSnapshot(
        secondPrompt,
        secondEvent.systemPrompt
      );

      expect(firstSnapshot).toContain("# Memory Status");
      expect(firstSnapshot).toContain("[[ROADMAP:base]]");
      expect(secondSnapshot).toBe(firstSnapshot);
    } finally {
      cleanup();
    }
  });

  it("should rebuild frozen snapshot after session_start resets the epoch", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const initialToken = "[[ROADMAP:before-session-start-reset]]";
      const updatedToken = "[[ROADMAP:after-session-start-reset]]";
      writeRoadmap(projectDir, `# Roadmap\n\n${initialToken}`);

      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      const beforeStart = getHandler(mockPi.handlers, "before_agent_start");
      const event = {
        type: "before_agent_start",
        prompt: "hello",
        systemPrompt: "base",
      };

      // First session: inject and freeze status
      await sessionStart?.({ type: "session_start" }, ctx);
      const result1 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const firstSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result1),
        event.systemPrompt
      );
      expect(firstSnapshot).toContain(initialToken);

      // Edit roadmap within same epoch: snapshot must remain frozen
      writeRoadmap(projectDir, `# Roadmap\n\n${updatedToken}`);

      const result2 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const secondSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result2),
        event.systemPrompt
      );
      expect(secondSnapshot).toBe(firstSnapshot);
      expect(secondSnapshot).not.toContain(updatedToken);

      // session_start resets the epoch and should rebuild from updated roadmap
      await sessionStart?.({ type: "session_start" }, ctx);

      const result3 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const thirdSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result3),
        event.systemPrompt
      );
      expect(thirdSnapshot).toContain("# Memory Status");
      expect(thirdSnapshot).toContain(updatedToken);
      expect(thirdSnapshot).not.toBe(firstSnapshot);
    } finally {
      cleanup();
    }
  });

  it("should rebuild frozen snapshot after session_switch resets the epoch", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const initialToken = "[[ROADMAP:before-session-switch-reset]]";
      const updatedToken = "[[ROADMAP:after-session-switch-reset]]";
      writeRoadmap(projectDir, `# Roadmap\n\n${initialToken}`);

      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      const beforeStart = getHandler(mockPi.handlers, "before_agent_start");
      const sessionSwitch = getHandler(mockPi.handlers, "session_switch");
      const event = {
        type: "before_agent_start",
        prompt: "hello",
        systemPrompt: "base",
      };

      await sessionStart?.({ type: "session_start" }, ctx);
      const result1 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const firstSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result1),
        event.systemPrompt
      );
      expect(firstSnapshot).toContain(initialToken);

      writeRoadmap(projectDir, `# Roadmap\n\n${updatedToken}`);

      const result2 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const secondSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result2),
        event.systemPrompt
      );
      expect(secondSnapshot).toBe(firstSnapshot);
      expect(secondSnapshot).not.toContain(updatedToken);

      await sessionSwitch?.(
        {
          type: "session_switch",
          reason: "resume",
          previousSessionFile: "/tmp/old-session.jsonl",
        },
        ctx
      );

      const result3 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const thirdSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result3),
        event.systemPrompt
      );
      expect(thirdSnapshot).toContain("# Memory Status");
      expect(thirdSnapshot).toContain(updatedToken);
      expect(thirdSnapshot).not.toBe(firstSnapshot);
    } finally {
      cleanup();
    }
  });

  it("should rebuild frozen snapshot after session_compact resets the epoch", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      const initialToken = "[[ROADMAP:before-session-compact-reset]]";
      const updatedToken = "[[ROADMAP:after-session-compact-reset]]";
      writeRoadmap(projectDir, `# Roadmap\n\n${initialToken}`);

      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      const beforeStart = getHandler(mockPi.handlers, "before_agent_start");
      const sessionCompact = getHandler(mockPi.handlers, "session_compact");
      const event = {
        type: "before_agent_start",
        prompt: "hello",
        systemPrompt: "base",
      };

      await sessionStart?.({ type: "session_start" }, ctx);
      const result1 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const firstSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result1),
        event.systemPrompt
      );
      expect(firstSnapshot).toContain(initialToken);

      writeRoadmap(projectDir, `# Roadmap\n\n${updatedToken}`);

      const result2 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const secondSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result2),
        event.systemPrompt
      );
      expect(secondSnapshot).toBe(firstSnapshot);
      expect(secondSnapshot).not.toContain(updatedToken);

      await sessionCompact?.({ type: "session_compact" }, ctx);

      const result3 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      const thirdSnapshot = extractFrozenSnapshot(
        readInjectedSystemPrompt(result3),
        event.systemPrompt
      );
      expect(thirdSnapshot).toContain("# Memory Status");
      expect(thirdSnapshot).toContain(updatedToken);
      expect(thirdSnapshot).not.toBe(firstSnapshot);
    } finally {
      cleanup();
    }
  });

  it("should keep frozen snapshot stable when main.md is edited mid-epoch", async () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
      // Write initial main.md
      fs.writeFileSync(
        path.join(projectDir, ".memory", "main.md"),
        "# Roadmap\n\nOriginal content before edit."
      );

      const mockPi = createMockPi();
      activate(mockPi.api);

      const ctx = createCtx(projectDir);
      const sessionStart = getHandler(mockPi.handlers, "session_start");
      const beforeStart = getHandler(mockPi.handlers, "before_agent_start");
      const event = {
        type: "before_agent_start",
        prompt: "hello",
        systemPrompt: "base",
      };

      // Session start + first injection captures snapshot
      await sessionStart?.({ type: "session_start" }, ctx);
      const result1 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      expect(result1?.systemPrompt).toContain("Original content before edit");

      // Edit main.md mid-session (simulates memory_commit updating roadmap)
      fs.writeFileSync(
        path.join(projectDir, ".memory", "main.md"),
        "# Roadmap\n\nCompletely rewritten after commit."
      );

      // Second call in same epoch must return the ORIGINAL snapshot
      const result2 = (await beforeStart?.(event, ctx)) as {
        systemPrompt?: string;
      };
      expect(result2?.systemPrompt).toBe(result1.systemPrompt);
      expect(result2?.systemPrompt).toContain("Original content before edit");
      expect(result2?.systemPrompt).not.toContain(
        "Completely rewritten after commit"
      );
    } finally {
      cleanup();
    }
  });
});
