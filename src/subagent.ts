import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { SubagentResult } from "./types.js";

const COMMITTER_MODEL = "google-antigravity/gemini-3-flash";
const COMMITTER_TOOLS = "read,grep,find,ls";

/**
 * Resolve the gcc-committer agent system prompt from the agent definition file.
 * The body (everything after the YAML frontmatter) is the system prompt.
 */
function resolveAgentPrompt(): string {
  const currentFile = new URL(import.meta.url).pathname;
  const currentDir = path.dirname(currentFile);
  const agentFile = path.resolve(currentDir, "../.pi/agents/gcc-committer.md");

  try {
    const content = fs.readFileSync(agentFile, "utf8");
    // Strip YAML frontmatter (--- ... ---) to get the system prompt body
    const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    return match ? match[1].trim() : content.trim();
  } catch {
    return "";
  }
}

export function buildCommitterTask(branch: string, summary: string): string {
  return [
    `Distill a GCC commit for branch "${branch}".`,
    `Summary: ${summary}`,
    "",
    "Read these files:",
    "- .gcc/AGENTS.md (protocol reference — read first)",
    `- .gcc/branches/${branch}/log.md (OTA trace to distill)`,
    `- .gcc/branches/${branch}/commits.md (previous commits for rolling summary)`,
    "",
    "Produce the three commit blocks.",
  ].join("\n");
}

/**
 * Extract the last assistant text from pi's JSON-mode stdout.
 * Each line is a JSON event; we want the last message_end with role=assistant.
 */
export function extractFinalText(stdout: string): string {
  let lastText = "";
  for (const line of stdout.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const evt = JSON.parse(line) as {
        type?: string;
        message?: {
          role?: string;
          content?: { type?: string; text?: string }[];
        };
      };
      if (evt.type === "message_end" && evt.message?.role === "assistant") {
        const texts = (evt.message.content ?? [])
          .filter((c) => c.type === "text" && typeof c.text === "string")
          .map((c) => c.text as string);
        if (texts.length > 0) {
          lastText = texts.join("\n\n");
        }
      }
    } catch {
      // Not JSON — skip
    }
  }
  return lastText;
}

/**
 * Extract the three commit blocks from subagent response text.
 * Returns the text from "### Branch Purpose" through the end of
 * "### This Commit's Contribution" content, stripping preamble
 * and trailing prose.
 */
export function extractCommitBlocks(text: string): string | null {
  const branchPurposeIndex = text.indexOf("### Branch Purpose");
  if (branchPurposeIndex === -1) {
    return null;
  }

  const progressIndex = text.indexOf("### Previous Progress Summary");
  if (progressIndex === -1) {
    return null;
  }

  const contributionIndex = text.indexOf("### This Commit's Contribution");
  if (contributionIndex === -1) {
    return null;
  }

  // Extract from "### Branch Purpose" onward
  const fromStart = text.slice(branchPurposeIndex);
  const lines = fromStart.split("\n");

  // Find where "### This Commit's Contribution" starts, then collect
  // content lines until we hit a blank line followed by non-content.
  let inContribution = false;
  let lastContentLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("### This Commit's Contribution")) {
      inContribution = true;
      lastContentLine = i;
      continue;
    }

    if (!inContribution) {
      lastContentLine = i;
      continue;
    }

    // In contribution block: keep content lines, stop at blank+non-blank
    if (line.trim() === "") {
      continue;
    }

    // Non-empty line in contribution section — is it still contribution content?
    // If there was a blank line gap since lastContentLine, check if this
    // looks like trailing prose (doesn't start with -, *, or indent).
    const gapHasBlank = lines
      .slice(lastContentLine + 1, i)
      .some((l) => l.trim() === "");

    if (
      gapHasBlank &&
      !line.startsWith("-") &&
      !line.startsWith("*") &&
      !line.startsWith(" ")
    ) {
      // Trailing text after the contribution block — stop here
      break;
    }

    lastContentLine = i;
  }

  return lines
    .slice(0, lastContentLine + 1)
    .join("\n")
    .trimEnd();
}

function writePromptToTempFile(prompt: string): {
  dir: string;
  filePath: string;
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-committer-"));
  const filePath = path.join(tmpDir, "system-prompt.md");
  fs.writeFileSync(filePath, prompt, { encoding: "utf8", mode: 0o600 });
  return { dir: tmpDir, filePath };
}

export function spawnCommitter(
  cwd: string,
  task: string,
  signal?: AbortSignal
): Promise<SubagentResult> {
  return new Promise((resolve) => {
    const args = [
      "--mode",
      "json",
      "--no-session",
      "--model",
      COMMITTER_MODEL,
      "--tools",
      COMMITTER_TOOLS,
      "-p",
      `Task: ${task}`,
    ];

    let tmpPromptDir: string | null = null;
    let tmpPromptPath: string | null = null;

    const systemPrompt = resolveAgentPrompt();
    if (systemPrompt) {
      const tmp = writePromptToTempFile(systemPrompt);
      tmpPromptDir = tmp.dir;
      tmpPromptPath = tmp.filePath;
      args.push("--append-system-prompt", tmpPromptPath);
    }

    const proc = spawn("pi", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    const cleanup = () => {
      if (tmpPromptPath) {
        try {
          fs.unlinkSync(tmpPromptPath);
        } catch {
          /* ignore */
        }
      }
      if (tmpPromptDir) {
        try {
          fs.rmdirSync(tmpPromptDir);
        } catch {
          /* ignore */
        }
      }
    };

    proc.on("close", (code) => {
      cleanup();
      const text = extractFinalText(stdout);
      resolve({
        text,
        exitCode: code ?? 1,
        error:
          code === 0
            ? undefined
            : stderr.trim() || "Subagent exited with non-zero code",
      });
    });

    proc.on("error", (err) => {
      cleanup();
      resolve({
        text: "",
        exitCode: 1,
        error: `Failed to spawn subagent: ${err.message}`,
      });
    });

    if (signal) {
      const kill = () => {
        proc.kill("SIGTERM");
        setTimeout(() => !proc.killed && proc.kill("SIGKILL"), 3000);
      };
      if (signal.aborted) {
        kill();
      } else {
        signal.addEventListener("abort", kill, { once: true });
        proc.on("close", () => signal.removeEventListener("abort", kill));
      }
    }
  });
}
