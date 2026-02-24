import { parseYaml, serializeYaml } from "./yaml.js";

describe("parseYaml", () => {
  it("parses flat key-value pairs", () => {
    const input = `active_branch: main\ninitialized: "2026-02-22T14:00:00Z"`;
    expect(parseYaml(input)).toStrictEqual({
      active_branch: "main",
      initialized: "2026-02-22T14:00:00Z",
    });
  });

  it("parses nested objects (one level)", () => {
    const input = `last_commit:\n  branch: main\n  hash: a1b2c3d4\n  summary: "Decided X"`;
    expect(parseYaml(input)).toStrictEqual({
      last_commit: { branch: "main", hash: "a1b2c3d4", summary: "Decided X" },
    });
  });

  it("parses top-level list of one-level objects", () => {
    const input = [
      "sessions:",
      "  - file: /tmp/session-1.jsonl",
      "    branch: main",
      '    started: "2026-02-23T00:00:00Z"',
      "  - file: /tmp/session-2.jsonl",
      "    branch: feature-x",
      '    started: "2026-02-23T01:00:00Z"',
    ].join("\n");

    expect(parseYaml(input)).toStrictEqual({
      sessions: [
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
      ],
    });
  });

  it("returns empty object for empty or whitespace input", () => {
    expect(parseYaml("")).toStrictEqual({});
    expect(parseYaml("  \n  ")).toStrictEqual({});
  });
});

describe("serializeYaml", () => {
  it("serializes flat key-value pairs", () => {
    const obj = { active_branch: "main", initialized: "2026-02-22" };
    expect(serializeYaml(obj)).toBe(
      `active_branch: main\ninitialized: "2026-02-22"`
    );
  });

  it("serializes nested objects (one level)", () => {
    const obj = { last_commit: { branch: "main", hash: "a1b2c3d4" } };
    expect(serializeYaml(obj)).toBe(
      `last_commit:\n  branch: main\n  hash: a1b2c3d4`
    );
  });

  it("serializes top-level list of one-level objects", () => {
    const obj = {
      sessions: [
        {
          file: "/tmp/session-1.jsonl",
          branch: "main",
          started: "2026-02-23T00:00:00Z",
        },
      ],
    };

    expect(serializeYaml(obj)).toBe(
      [
        "sessions:",
        '  - file: "/tmp/session-1.jsonl"',
        "    branch: main",
        '    started: "2026-02-23T00:00:00Z"',
      ].join("\n")
    );
  });

  it("round-trips through parse and serialize", () => {
    const original = {
      active_branch: "main",
      last_commit: { branch: "main", hash: "abc" },
      sessions: [
        {
          file: "/tmp/session.jsonl",
          branch: "main",
          started: "2026-02-23T00:00:00Z",
        },
      ],
    };
    expect(parseYaml(serializeYaml(original))).toStrictEqual(original);
  });
});
