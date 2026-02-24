/**
 * Manages the 2-step gcc_commit flow state.
 * Step 1 (executeGccCommit): Returns log for agent distillation.
 * Step 2 (handleAgentEnd): Extracts commit blocks from the agent's response.
 *
 * Pure class — no file I/O, no extension API dependency.
 */

interface CommitFlowResult {
  summary: string;
  commitContent: string;
}

interface MessageLike {
  role: string;
  content?: { type: string; text?: string }[];
}

function findLastAssistantText(messages: MessageLike[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.content) {
      const textParts = msg.content
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string);
      if (textParts.length > 0) {
        return textParts.join("\n\n");
      }
    }
  }
  return null;
}

function extractCommitBlocks(text: string): string | null {
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

export class CommitFlowManager {
  private pendingSummary: string | null = null;

  setPendingCommit(summary: string): void {
    this.pendingSummary = summary;
  }

  hasPending(): boolean {
    return this.pendingSummary !== null;
  }

  handleAgentEnd(messages: MessageLike[]): CommitFlowResult | null {
    if (!this.pendingSummary) {
      return null;
    }

    const text = findLastAssistantText(messages);
    if (!text) {
      return null;
    }

    const commitContent = extractCommitBlocks(text);
    if (!commitContent) {
      // Don't clear pending — agent can retry
      return null;
    }

    const summary = this.pendingSummary;
    this.pendingSummary = null;

    return { summary, commitContent };
  }
}
