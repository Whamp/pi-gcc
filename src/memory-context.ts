import * as fs from "node:fs";
import * as path from "node:path";

import type { BranchManager } from "./branches.js";
import { LOG_SIZE_WARNING_BYTES } from "./constants.js";
import type { MemoryState } from "./state.js";

function extractCommitSummaryLine(commitEntry: string): string {
  const marker = "### This Commit's Contribution";
  const markerIndex = commitEntry.indexOf(marker);

  if (markerIndex !== -1) {
    const afterMarker = commitEntry.slice(markerIndex + marker.length);
    const firstContentLine = afterMarker
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (firstContentLine) {
      return firstContentLine.slice(0, 100);
    }
  }

  const headerMatch = /## Commit ([a-f0-9]+)/.exec(commitEntry);
  if (headerMatch) {
    return `commit ${headerMatch[1]}`;
  }

  return "(unknown)";
}

export function buildStatusView(
  state: MemoryState,
  branches: BranchManager,
  projectDir: string
): string {
  const lines = ["# Memory Status", ""];

  const mainMdPath = path.join(projectDir, ".memory", "main.md");
  if (fs.existsSync(mainMdPath)) {
    const roadmap = fs.readFileSync(mainMdPath, "utf8").trim();
    if (roadmap) {
      lines.push(roadmap, "");
    } else {
      lines.push(
        "Roadmap is empty. Update `.memory/main.md` with project goals and current state.",
        ""
      );
    }
  } else {
    lines.push(
      "No roadmap found. Create `.memory/main.md` to set project goals.",
      ""
    );
  }

  lines.push(`Active branch: ${state.activeBranch}`, "");

  const logSizeBytes = branches.getLogSizeBytes(state.activeBranch);
  if (logSizeBytes >= LOG_SIZE_WARNING_BYTES) {
    const sizeKB = Math.round(logSizeBytes / 1024);
    lines.push(
      `**Warning:** log.md is large (${sizeKB} KB). ` +
        "You should commit to distill this into structured memory.",
      ""
    );
  }

  const branchList = branches.listBranches();
  if (branchList.length > 0) {
    lines.push("## Branches", "");

    for (const name of branchList) {
      const latest = branches.getLatestCommit(name);
      const summary = latest
        ? extractCommitSummaryLine(latest)
        : "(no commits)";
      const marker = name === state.activeBranch ? " (active)" : "";
      lines.push(`- **${name}**${marker}: ${summary}`);
    }

    lines.push("");
  }

  lines.push("## Deep Retrieval", "");
  lines.push("Use `read .memory/branches/<name>/commits.md` for full history.");
  lines.push("Use `read .memory/branches/<name>/log.md` for OTA trace.");
  lines.push("Use `read .memory/branches/<name>/metadata.yaml` for metadata.");
  lines.push("Use `read .memory/main.md` for roadmap.");
  lines.push("Use `read .memory/AGENTS.md` for protocol details.");

  return lines.join("\n");
}
