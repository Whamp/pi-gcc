import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import fc from "fast-check";

import { GccState } from "./state.js";

describe("gccState", () => {
  let tmpDir: string;
  let gccDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-state-test-"));
    gccDir = path.join(tmpDir, ".gcc");
    fs.mkdirSync(gccDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load valid state.yaml", () => {
    // Arrange
    fs.writeFileSync(
      path.join(gccDir, "state.yaml"),
      `active_branch: main\ninitialized: "2026-02-22T14:00:00Z"`
    );

    // Act
    const state = new GccState(tmpDir);
    state.load();

    // Assert
    expect(state.activeBranch).toBe("main");
    expect(state.initialized).toBe("2026-02-22T14:00:00Z");
  });

  it("should fall back to defaults when state.yaml is empty", () => {
    // Arrange
    fs.writeFileSync(path.join(gccDir, "state.yaml"), "");

    // Act
    const state = new GccState(tmpDir);
    state.load();

    // Assert
    expect(state.activeBranch).toBe("main");
  });

  it("should fall back to defaults when state.yaml is missing", () => {
    // Act
    const state = new GccState(tmpDir);
    state.load();

    // Assert
    expect(state.activeBranch).toBe("main");
  });

  it("should report isInitialized correctly", () => {
    // Arrange
    const state = new GccState(tmpDir);

    // Assert (before load)
    expect(state.isInitialized).toBeFalsy();

    // Arrange
    fs.writeFileSync(
      path.join(gccDir, "state.yaml"),
      `active_branch: main\ninitialized: "2026-02-22T14:00:00Z"`
    );

    // Act
    state.load();

    // Assert
    expect(state.isInitialized).toBeTruthy();
  });

  it("should update active branch and persist", () => {
    // Arrange
    fs.writeFileSync(
      path.join(gccDir, "state.yaml"),
      `active_branch: main\ninitialized: "2026-02-22T14:00:00Z"`
    );
    const state = new GccState(tmpDir);
    state.load();

    // Act
    state.setActiveBranch("feature-x");
    state.save();

    // Assert
    const reloaded = new GccState(tmpDir);
    reloaded.load();
    expect(reloaded.activeBranch).toBe("feature-x");
  });

  it("should update last commit and persist", () => {
    // Arrange
    fs.writeFileSync(
      path.join(gccDir, "state.yaml"),
      `active_branch: main\ninitialized: "2026-02-22T14:00:00Z"`
    );
    const state = new GccState(tmpDir);
    state.load();

    // Act
    state.setLastCommit(
      "main",
      "a1b2c3d4",
      "2026-02-22T15:30:00Z",
      "Decided on X"
    );
    state.save();

    // Assert
    const reloaded = new GccState(tmpDir);
    reloaded.load();
    expect(reloaded.lastCommit).toStrictEqual({
      branch: "main",
      hash: "a1b2c3d4",
      timestamp: "2026-02-22T15:30:00Z",
      summary: "Decided on X",
    });
  });

  it("should update existing session branch while preserving started timestamp", () => {
    // Arrange
    fs.writeFileSync(
      path.join(gccDir, "state.yaml"),
      [
        "active_branch: main",
        'initialized: "2026-02-22T14:00:00Z"',
        "sessions:",
        "  - file: /tmp/session-1.jsonl",
        "    branch: main",
        '    started: "2026-02-23T00:00:00Z"',
      ].join("\n")
    );

    const state = new GccState(tmpDir);
    state.load();

    // Act
    state.upsertSession(
      "/tmp/session-1.jsonl",
      "feature-x",
      "2026-02-23T05:00:00Z"
    );
    state.save();

    // Assert
    const reloaded = new GccState(tmpDir);
    reloaded.load();

    expect(reloaded.sessions).toStrictEqual([
      {
        file: "/tmp/session-1.jsonl",
        branch: "feature-x",
        started: "2026-02-23T00:00:00Z",
      },
    ]);
  });

  it("should track sessions and persist them", () => {
    // Arrange
    fs.writeFileSync(
      path.join(gccDir, "state.yaml"),
      [
        "active_branch: main",
        'initialized: "2026-02-22T14:00:00Z"',
        "sessions:",
        "  - file: /tmp/session-1.jsonl",
        "    branch: main",
        '    started: "2026-02-23T00:00:00Z"',
      ].join("\n")
    );

    const state = new GccState(tmpDir);
    state.load();

    // Act
    state.upsertSession(
      "/tmp/session-2.jsonl",
      "feature-x",
      "2026-02-23T01:00:00Z"
    );
    state.upsertSession("/tmp/session-1.jsonl", "main", "2026-02-23T00:00:00Z");
    state.save();

    // Assert
    const reloaded = new GccState(tmpDir);
    reloaded.load();

    expect(reloaded.sessions).toStrictEqual([
      {
        file: "/tmp/session-1.jsonl",
        branch: "main",
        started: "2026-02-23T00:00:00Z",
      },
      {
        file: "/tmp/session-2.jsonl",
        branch: "feature-x",
        started: "2026-02-23T01:00:00Z",
      },
    ]);
  });

  describe("save/load roundtrip", () => {
    it("should preserve activeBranch through save and load", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,19}$/),
          (branch) => {
            // Arrange
            fs.writeFileSync(
              path.join(gccDir, "state.yaml"),
              'active_branch: main\ninitialized: "2026-02-22T14:00:00Z"'
            );
            const state = new GccState(tmpDir);
            state.load();

            // Act
            state.setActiveBranch(branch);
            state.save();
            const reloaded = new GccState(tmpDir);
            reloaded.load();

            // Assert
            expect(reloaded.activeBranch).toBe(branch);
          }
        )
      );
    });
  });
});
