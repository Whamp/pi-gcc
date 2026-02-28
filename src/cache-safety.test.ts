import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import fc from "fast-check";

import activate from "./index.js";

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
});
