import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { SubagentResult } from "./types.js";
import { parseYaml } from "./yaml.js";

const COMMITTER_MODEL = "google-antigravity/gemini-3-flash";
const COMMITTER_TOOLS = "read,grep,find,ls";

interface AgentDefinition {
  prompt: string;
  model: string;
  tools: string;
  skills: string;
  extensions: string;
}

/**
 * Resolve the memory-committer agent definition from the agent definition file.
 * Checks multiple locations to support both local development and npm installs.
 * Parses the YAML frontmatter for properties and uses the body as the system prompt.
 */
function resolveAgentPrompt(): AgentDefinition {
  const currentFile = new URL(import.meta.url).pathname;
  const currentDir = path.dirname(currentFile);

  // Possible locations for the agent definition file
  const candidates = [
    // Installed package: dist/ or src/ -> ../agents/ (bundled in package)
    path.resolve(currentDir, "../agents/memory-committer.md"),
    // Local development: src/ -> ../.pi/agents/
    path.resolve(currentDir, "../.pi/agents/memory-committer.md"),
    // Fallback: check if bundled alongside source
    path.resolve(currentDir, "./agents/memory-committer.md"),
  ];

  for (const agentFile of candidates) {
    try {
      const content = fs.readFileSync(agentFile, "utf8");

      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      let frontmatter = "";
      let prompt = content.trim();

      if (match) {
        const [, matchedFrontmatter, matchedPrompt] = match;
        frontmatter = matchedFrontmatter;
        prompt = matchedPrompt.trim();
      }

      let parsed: Record<string, unknown> = {};
      if (frontmatter) {
        try {
          parsed = parseYaml(frontmatter) as Record<string, unknown>;
        } catch {
          // Ignore parse errors, fallback to defaults
        }
      }

      return {
        prompt,
        model:
          typeof parsed.model === "string" ? parsed.model : COMMITTER_MODEL,
        tools:
          typeof parsed.tools === "string" ? parsed.tools : COMMITTER_TOOLS,
        skills: typeof parsed.skills === "string" ? parsed.skills : "",
        extensions:
          typeof parsed.extensions === "string" ? parsed.extensions : "",
      };
    } catch {
      continue;
    }
  }

  throw new Error("Could not locate memory-committer.md agent definition file");
}

export function buildCommitterTask(branch: string, summary: string): string {
  return [
    `Distill a memory commit for branch "${branch}".`,
    `Summary: ${summary}`,
    "",
    "Read these files:",
    "- .memory/AGENTS.md (protocol reference — read first)",
    `- .memory/branches/${branch}/log.md (OTA trace to distill)`,
    `- .memory/branches/${branch}/commits.md (previous commits for rolling summary)`,
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-committer-"));
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
    let agentDef: AgentDefinition;
    try {
      agentDef = resolveAgentPrompt();
    } catch (error: unknown) {
      resolve({
        text: "",
        exitCode: 1,
        error:
          error instanceof Error
            ? error.message
            : "Failed to resolve agent definition",
      });
      return;
    }

    const args = [
      "--mode",
      "json",
      "--no-session",
      "--model",
      agentDef.model,
      "--tools",
      agentDef.tools,
      "-p",
      `Task: ${task}`,
    ];

    if (agentDef.skills) {
      const skills = agentDef.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const skill of skills) {
        args.push("--skill", skill);
      }
    }

    if (agentDef.extensions) {
      const exts = agentDef.extensions
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      for (const ext of exts) {
        args.push("--extension", ext);
      }
    }

    let tmpPromptDir: string | null = null;
    let tmpPromptPath: string | null = null;

    if (agentDef.prompt) {
      const tmp = writePromptToTempFile(agentDef.prompt);
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
