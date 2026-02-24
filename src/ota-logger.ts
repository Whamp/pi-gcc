/**
 * Extracts OTA log input from a TurnEndEvent.
 * Pure function — no dependency on the extension runtime.
 */

import type { OtaEntryInput } from "./types.js";

interface ContentItem {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}

interface TurnEndEventLike {
  turnIndex: number;
  message: {
    role: string;
    content?: ContentItem[];
    provider?: string;
    model?: string;
    timestamp?: number;
  };
  toolResults: {
    toolName: string;
    isError: boolean;
  }[];
}

function formatArgValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return String(value);
}

function formatToolCallArgs(args: Record<string, unknown>): string {
  const pairs = Object.entries(args).map(
    ([key, val]) => `${key}: ${formatArgValue(val)}`
  );
  return pairs.join(", ");
}

function extractTexts(content: ContentItem[]): string {
  const texts = content
    .filter(
      (item): item is ContentItem & { text: string } =>
        item.type === "text" && typeof item.text === "string"
    )
    .map((item) => item.text);
  return texts.join("\n\n");
}

function extractThinking(content: ContentItem[]): string {
  const blocks = content
    .filter(
      (item): item is ContentItem & { thinking: string } =>
        item.type === "thinking" && typeof item.thinking === "string"
    )
    .map((item) => item.thinking);
  return blocks.join("\n\n");
}

function extractActions(content: ContentItem[]): string[] {
  return content
    .filter(
      (item): item is ContentItem & { name: string } =>
        item.type === "toolCall" && typeof item.name === "string"
    )
    .map((item) => {
      const argsStr = item.arguments ? formatToolCallArgs(item.arguments) : "";
      return argsStr ? `${item.name}(${argsStr})` : `${item.name}()`;
    });
}

function extractObservations(
  toolResults: TurnEndEventLike["toolResults"]
): string[] {
  return toolResults.map(
    (tr) => `${tr.toolName}: ${tr.isError ? "error" : "success"}`
  );
}

export function extractOtaInput(event: TurnEndEventLike): OtaEntryInput | null {
  const { message, turnIndex, toolResults } = event;

  if (message.role !== "assistant") {
    return null;
  }

  const content = message.content ?? [];
  const thought = extractTexts(content);
  const thinking = extractThinking(content);
  const actions = extractActions(content);

  // Skip empty turns — no text and no tool calls
  if (!thought && !thinking && actions.length === 0) {
    return null;
  }

  const observations = extractObservations(toolResults);
  const model = `${message.provider ?? "unknown"}/${message.model ?? "unknown"}`;
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toISOString()
    : new Date().toISOString();

  return {
    turnNumber: turnIndex + 1,
    timestamp,
    model,
    thought,
    thinking,
    actions,
    observations,
  };
}
