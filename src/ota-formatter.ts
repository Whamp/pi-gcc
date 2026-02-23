/**
 * Formats OTA (Observation-Thought-Action) log entries for log.md.
 * Follows the GCC spec format with full fidelity.
 */

import type { OtaEntryInput } from "./types.js";

export type { OtaEntryInput } from "./types.js";

export function formatOtaEntry(input: OtaEntryInput): string {
  const lines = [
    `## Turn ${input.turnNumber} | ${input.timestamp} | ${input.model}`,
    "",
    `**Thought**: ${input.thought}`,
  ];

  if (input.thinking) {
    lines.push(`**Thinking**: ${input.thinking}`);
  }

  if (input.actions.length > 0) {
    lines.push(`**Action**: ${input.actions.join(", ")}`);
  }

  if (input.observations.length > 0) {
    lines.push(`**Observation**: ${input.observations.join("; ")}`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}
