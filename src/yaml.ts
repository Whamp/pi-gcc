/**
 * Minimal YAML parser and serializer for flat values, one-level nested objects,
 * and top-level lists of one-level objects.
 */

type YamlItem = Record<string, string>;
type YamlValue = string | Record<string, string> | YamlItem[];
type YamlObject = Record<string, YamlValue>;

const NEEDS_QUOTING = /[-:{}[\],&*?|>!%@`]|^\d{4}-\d{2}/;

function unquote(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function quoteIfNeeded(value: string): string {
  if (
    value === "" ||
    value.trim() !== value ||
    value.includes("'") ||
    NEEDS_QUOTING.test(value)
  ) {
    return `"${value}"`;
  }

  return value;
}

function parseKeyValue(text: string): { key: string; value: string } | null {
  const colonIdx = text.indexOf(":");
  if (colonIdx === -1) {
    return null;
  }

  return {
    key: text.slice(0, colonIdx).trim(),
    value: text.slice(colonIdx + 1).trim(),
  };
}

function parseNestedObject(
  lines: string[],
  startIndex: number
): {
  value: Record<string, string>;
  nextIndex: number;
} {
  const nested: Record<string, string> = {};
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    if (!line.startsWith("  ") || line.startsWith("    ")) {
      break;
    }

    const parsed = parseKeyValue(line.slice(2));
    if (parsed) {
      nested[parsed.key] = unquote(parsed.value);
    }

    i++;
  }

  return { value: nested, nextIndex: i };
}

function parseList(
  lines: string[],
  startIndex: number
): {
  value: YamlItem[];
  nextIndex: number;
} {
  const list: YamlItem[] = [];
  let currentItem: YamlItem | null = null;
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith("  - ")) {
      const item: YamlItem = {};
      const inline = line.slice(4).trim();
      if (inline !== "") {
        const parsed = parseKeyValue(inline);
        if (parsed) {
          item[parsed.key] = unquote(parsed.value);
        }
      }

      list.push(item);
      currentItem = item;
      i++;
      continue;
    }

    if (line.startsWith("    ") && currentItem !== null) {
      const parsed = parseKeyValue(line.slice(4));
      if (parsed) {
        currentItem[parsed.key] = unquote(parsed.value);
      }

      i++;
      continue;
    }

    break;
  }

  return { value: list, nextIndex: i };
}

export function parseYaml(input: string): YamlObject {
  const result: YamlObject = {};
  const lines = input.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith(" ")) {
      i++;
      continue;
    }

    const parsedTop = parseKeyValue(line);
    if (!parsedTop) {
      i++;
      continue;
    }

    const { key, value } = parsedTop;
    if (value !== "") {
      result[key] = unquote(value);
      i++;
      continue;
    }

    i++;
    while (i < lines.length && lines[i].trim() === "") {
      i++;
    }

    if (i >= lines.length || !lines[i].startsWith("  ")) {
      result[key] = {};
      continue;
    }

    if (lines[i].startsWith("  - ")) {
      const parsedList = parseList(lines, i);
      result[key] = parsedList.value;
      i = parsedList.nextIndex;
      continue;
    }

    const parsedNested = parseNestedObject(lines, i);
    result[key] = parsedNested.value;
    i = parsedNested.nextIndex;
  }

  return result;
}

export function serializeYaml(obj: YamlObject): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      lines.push(`${key}: ${quoteIfNeeded(value)}`);
      continue;
    }

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        const entries = Object.entries(item);
        if (entries.length === 0) {
          lines.push("  -");
          continue;
        }

        const [firstEntry, ...remainingEntries] = entries;
        const [firstKey, firstValue] = firstEntry;
        lines.push(`  - ${firstKey}: ${quoteIfNeeded(firstValue)}`);
        for (const [nestedKey, nestedValue] of remainingEntries) {
          lines.push(`    ${nestedKey}: ${quoteIfNeeded(nestedValue)}`);
        }
      }
      continue;
    }

    lines.push(`${key}:`);
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      lines.push(`  ${nestedKey}: ${quoteIfNeeded(nestedValue)}`);
    }
  }

  return lines.join("\n");
}
