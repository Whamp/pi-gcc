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

describe("cache safety invariants", () => {
  it("registers exactly two stable memory tools", () => {
    const mockPi = createMockPi();
    activate(mockPi.api);

    expect(mockPi.tools.map((t) => t.name)).toStrictEqual([
      "memory_branch",
      "memory_commit",
    ]);
  });

  it("setupInitializedProject creates valid .memory structure", () => {
    const { projectDir, cleanup } = setupInitializedProject();
    try {
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

  it("fast-check is available for property tests", () => {
    expect(() =>
      fc.assert(fc.property(fc.boolean(), (b) => typeof b === "boolean"))
    ).not.toThrow();
  });

  it("before_agent_start never returns systemPrompt (append-only contract)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (prompt) => {
        const { projectDir, cleanup } = setupInitializedProject();
        try {
          const mockPi = createMockPi();
          activate(mockPi.api);

          const beforeStart = mockPi.handlers.find(
            (h) => h.event === "before_agent_start"
          )?.handler;
          const sessionStart = mockPi.handlers.find(
            (h) => h.event === "session_start"
          )?.handler;

          const ctx = {
            cwd: projectDir,
            ui: { notify() {}, setStatus() {} },
            sessionManager: {
              getSessionFile: () => "/tmp/pi-cache-safety.jsonl",
            },
          } as unknown as ExtensionContext;

          await sessionStart?.({ type: "session_start" }, ctx);

          const result = (await beforeStart?.(
            { type: "before_agent_start", prompt, systemPrompt: "base" },
            ctx
          )) as { systemPrompt?: string; message?: unknown } | undefined;

          // The handler may return undefined or a result with message,
          // but must never include systemPrompt (append-only contract).
          expect(result?.systemPrompt).toBeUndefined();
        } finally {
          cleanup();
        }
      }),
      { numRuns: 60 }
    );
  });

  it("injects at most one brain-status message per epoch and resets on session events", async () => {
    const opArb = fc.array(
      fc.constantFrom(
        "before_agent_start",
        "session_start",
        "session_switch",
        "session_compact"
      ),
      { minLength: 1, maxLength: 80 }
    );

    await fc.assert(
      fc.asyncProperty(opArb, async (ops) => {
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

          const ctx = {
            cwd: projectDir,
            ui: { notify() {}, setStatus() {} },
            sessionManager: {
              getSessionFile: () => "/tmp/pi-cache-safety.jsonl",
            },
          } as unknown as ExtensionContext;

          let canInject = true;

          for (const op of ops) {
            if (op === "session_start") {
              await onSessionStart?.({ type: "session_start" }, ctx);
              canInject = true;
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
              canInject = true;
              continue;
            }

            if (op === "session_compact") {
              await onSessionCompact?.({ type: "session_compact" }, ctx);
              canInject = true;
              continue;
            }

            const result = (await beforeStart?.(
              { type: "before_agent_start", prompt: "p", systemPrompt: "base" },
              ctx
            )) as { message?: { customType?: string } } | undefined;

            const actual = result
              ? {
                  hasResult: true,
                  customType: result.message?.customType,
                }
              : {
                  hasResult: false,
                  customType: undefined,
                };

            const expected = canInject
              ? {
                  hasResult: true,
                  customType: "brain-status",
                }
              : {
                  hasResult: false,
                  customType: undefined,
                };

            expect(actual).toStrictEqual(expected);

            canInject = false;
          }
        } finally {
          cleanup();
        }
      }),
      { numRuns: 40 }
    );
  });

  it("buildStatusView is deterministic for identical on-disk state", () => {
    const branchNameArb = fc
      .stringMatching(/^[a-z][a-z0-9-]{0,12}$/)
      .filter((name) => name !== "main");

    fc.assert(
      fc.property(
        fc.uniqueArray(branchNameArb, { maxLength: 8 }),
        fc.string(),
        (extraBranches, roadmap) => {
          const { projectDir, cleanup } = setupInitializedProject();
          try {
            fs.writeFileSync(
              path.join(projectDir, ".memory", "main.md"),
              `# Roadmap\n\n${roadmap}`
            );

            const branches = new BranchManager(projectDir);
            for (let i = extraBranches.length - 1; i >= 0; i--) {
              const name = extraBranches[i];
              branches.createBranch(name, `Purpose ${name}`);
            }

            const state = new MemoryState(projectDir);
            state.load();

            const first = buildStatusView(state, branches, projectDir, {
              compact: true,
              branchLimit: 8,
            });
            const second = buildStatusView(state, branches, projectDir, {
              compact: true,
              branchLimit: 8,
            });

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
