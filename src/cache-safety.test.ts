import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import fc from "fast-check";

import { BranchManager } from "./branches.js";
import activate from "./index.js";
import { buildStatusView } from "./memory-context.js";
import { MemoryState } from "./state.js";

interface RegisteredHandler {
  event: string;
  handler: (event: unknown, ctx: ExtensionContext) => unknown;
}

interface MockPi {
  tools: ToolDefinition[];
  handlers: RegisteredHandler[];
  api: ExtensionAPI;
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

function setupInitializedProject(): {
  projectDir: string;
  cleanup: () => void;
} {
  const projectDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "cache-safety-test-")
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

  fs.writeFileSync(path.join(branchDir, "log.md"), "");
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

function createCtx(projectDir: string): ExtensionContext {
  return {
    cwd: projectDir,
    ui: { notify() {}, setStatus() {} },
    sessionManager: {
      getSessionFile: () => "/tmp/pi-cache-safety.jsonl",
    },
  } as unknown as ExtensionContext;
}

function writeRoadmap(projectDir: string, token: string): void {
  fs.writeFileSync(
    path.join(projectDir, ".memory", "main.md"),
    `# Roadmap\n\n${token}`
  );
}

function readInjectedSystemPrompt(
  result: { systemPrompt?: string } | undefined
): string {
  expect(result).toBeDefined();
  expect(result?.systemPrompt).toBeDefined();
  return result?.systemPrompt ?? "";
}

function extractSnapshot(injectedPrompt: string, basePrompt: string): string {
  const prefix = `${basePrompt}\n\n`;
  expect(injectedPrompt.startsWith(prefix)).toBeTruthy();
  return injectedPrompt.slice(prefix.length);
}

describe("cache safety invariants", () => {
  it("should register exactly two stable memory tools", () => {
    // Arrange
    const mockPi = createMockPi();

    // Act
    activate(mockPi.api);

    // Assert
    expect(mockPi.tools.map((t) => t.name)).toStrictEqual([
      "memory_branch",
      "memory_commit",
    ]);
  });

  it("should create a valid initialized .memory structure", () => {
    // Arrange
    const { projectDir, cleanup } = setupInitializedProject();

    try {
      // Act / Assert
      expect(
        fs.existsSync(path.join(projectDir, ".memory", "state.yaml"))
      ).toBeTruthy();
      expect(
        fs.existsSync(
          path.join(projectDir, ".memory", "branches", "main", "log.md")
        )
      ).toBeTruthy();
    } finally {
      cleanup();
    }
  });

  // Mutation checklist (before_agent_start append + freeze semantics):
  // 1) Return only frozen snapshot without prefixing event.systemPrompt.
  // 2) Cache and replay the full injected prompt (including old base prompt).
  // 3) Skip injection on second call in same epoch.
  // This test should fail for all three.
  it("should append memory status while preserving per-call base prompt within an epoch", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        async (firstBasePrompt, secondBasePrompt) => {
          // Arrange
          const { projectDir, cleanup } = setupInitializedProject();

          try {
            const mockPi = createMockPi();
            activate(mockPi.api);

            writeRoadmap(projectDir, "[[ROADMAP:seed]]");

            const beforeStart = mockPi.handlers.find(
              (h) => h.event === "before_agent_start"
            )?.handler;
            const sessionStart = mockPi.handlers.find(
              (h) => h.event === "session_start"
            )?.handler;

            const ctx = createCtx(projectDir);
            await sessionStart?.({ type: "session_start" }, ctx);

            // Act
            const first = (await beforeStart?.(
              {
                type: "before_agent_start",
                prompt: "first",
                systemPrompt: firstBasePrompt,
              },
              ctx
            )) as { systemPrompt?: string; message?: unknown } | undefined;

            const second = (await beforeStart?.(
              {
                type: "before_agent_start",
                prompt: "second",
                systemPrompt: secondBasePrompt,
              },
              ctx
            )) as { systemPrompt?: string } | undefined;

            // Assert
            expect(first?.message).toBeUndefined();

            const firstPrompt = readInjectedSystemPrompt(first);
            const secondPrompt = readInjectedSystemPrompt(second);

            const firstSnapshot = extractSnapshot(firstPrompt, firstBasePrompt);
            const secondSnapshot = extractSnapshot(
              secondPrompt,
              secondBasePrompt
            );

            expect(firstSnapshot).toContain("# Memory Status");
            expect(firstSnapshot).toContain("[[ROADMAP:seed]]");
            expect(secondSnapshot).toBe(firstSnapshot);
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 60 }
    );
  });

  // Mutation checklist (epoch reset behavior):
  // 1) Do not clear frozen snapshot on session_start.
  // 2) Do not clear frozen snapshot on session_switch.
  // 3) Do not clear frozen snapshot on session_compact.
  // 4) Recompute snapshot on every before_agent_start (no freeze).
  // 5) Allow mid-epoch main.md edits to leak into frozen snapshot.
  // This test should fail for all five.
  it("should freeze roadmap content within an epoch and refresh only after reset events", async () => {
    const opArb = fc.array(
      fc.constantFrom(
        "before_agent_start",
        "edit_main_md",
        "session_start",
        "session_switch",
        "session_compact"
      ),
      { minLength: 1 }
    );

    await fc.assert(
      fc.asyncProperty(opArb, async (ops) => {
        // Arrange
        const { projectDir, cleanup } = setupInitializedProject();

        try {
          const mockPi = createMockPi();
          activate(mockPi.api);

          const getHandler = (name: string) =>
            mockPi.handlers.find((h) => h.event === name)?.handler;
          const beforeStart = getHandler("before_agent_start");
          const onSessionStart = getHandler("session_start");
          const onSessionSwitch = getHandler("session_switch");
          const onSessionCompact = getHandler("session_compact");

          const ctx = createCtx(projectDir);

          let roadmapVersion = 0;
          let activeRoadmapToken = `[[ROADMAP:${roadmapVersion}]]`;
          writeRoadmap(projectDir, activeRoadmapToken);

          await onSessionStart?.({ type: "session_start" }, ctx);

          let frozenSnapshot: string | undefined;
          let frozenRoadmapToken: string | undefined;
          let beforeStartCallCount = 0;

          for (const op of ops) {
            if (op === "edit_main_md") {
              roadmapVersion += 1;
              activeRoadmapToken = `[[ROADMAP:${roadmapVersion}]]`;
              writeRoadmap(projectDir, activeRoadmapToken);
              continue;
            }

            if (op === "session_start") {
              await onSessionStart?.({ type: "session_start" }, ctx);
              frozenSnapshot = undefined;
              frozenRoadmapToken = undefined;
              continue;
            }

            if (op === "session_switch") {
              await onSessionSwitch?.(
                {
                  type: "session_switch",
                  reason: "resume",
                  previousSessionFile: "/tmp/prev.jsonl",
                },
                ctx
              );
              frozenSnapshot = undefined;
              frozenRoadmapToken = undefined;
              continue;
            }

            if (op === "session_compact") {
              await onSessionCompact?.({ type: "session_compact" }, ctx);
              frozenSnapshot = undefined;
              frozenRoadmapToken = undefined;
              continue;
            }

            // Act (before_agent_start)
            const basePrompt = `base-${beforeStartCallCount}`;
            beforeStartCallCount += 1;

            const result = (await beforeStart?.(
              {
                type: "before_agent_start",
                prompt: `prompt-${beforeStartCallCount}`,
                systemPrompt: basePrompt,
              },
              ctx
            )) as { systemPrompt?: string } | undefined;

            const injectedPrompt = readInjectedSystemPrompt(result);
            const snapshot = extractSnapshot(injectedPrompt, basePrompt);

            // Assert
            const isFirstSnapshotInEpoch = frozenSnapshot === undefined;
            const expectedSnapshot = frozenSnapshot ?? snapshot;
            const expectedRoadmapToken =
              frozenRoadmapToken ?? activeRoadmapToken;

            expect(snapshot).toContain("# Memory Status");
            expect(snapshot).toBe(expectedSnapshot);
            expect(snapshot).toContain(expectedRoadmapToken);
            expect(snapshot.includes(activeRoadmapToken)).toBe(
              activeRoadmapToken === expectedRoadmapToken
            );

            if (isFirstSnapshotInEpoch) {
              frozenSnapshot = snapshot;
              frozenRoadmapToken = activeRoadmapToken;
            }
          }
        } finally {
          cleanup();
        }
      }),
      { numRuns: 40 }
    );
  });

  // Mutation checklist (determinism):
  // 1) Inject Date.now()/Math.random() output into buildStatusView.
  // 2) Make branch rendering order unstable for identical on-disk data.
  // This test should fail for both.
  it("should render a deterministic compact status view for identical on-disk state", () => {
    const branchNameArb = fc
      .stringMatching(/^[a-z][a-z0-9-]{0,12}$/)
      .map((name) => (name === "main" ? "main-branch" : name));

    fc.assert(
      fc.property(
        fc.uniqueArray(branchNameArb),
        fc.string(),
        (extraBranches, roadmap) => {
          // Arrange
          const { projectDir, cleanup } = setupInitializedProject();

          try {
            writeRoadmap(projectDir, roadmap);

            const firstBranches = new BranchManager(projectDir);
            for (let i = extraBranches.length - 1; i >= 0; i--) {
              const name = extraBranches[i];
              firstBranches.createBranch(name, `Purpose ${name}`);
            }

            const firstState = new MemoryState(projectDir);
            firstState.load();

            // Act
            const first = buildStatusView(
              firstState,
              firstBranches,
              projectDir,
              {
                compact: true,
                branchLimit: 8,
              }
            );

            const secondState = new MemoryState(projectDir);
            secondState.load();
            const secondBranches = new BranchManager(projectDir);

            const second = buildStatusView(
              secondState,
              secondBranches,
              projectDir,
              {
                compact: true,
                branchLimit: 8,
              }
            );

            // Assert
            expect(first).toBe(second);
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
