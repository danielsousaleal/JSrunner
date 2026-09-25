import type { ConsoleEntry } from "./db";

export interface ConsoleJsonValue {
  id: string;
  entryId: string;
  timestamp: number;
  type: ConsoleEntry["type"];
  value: unknown;
}

export interface JsonMetrics {
  bytes: number;
  keys: number;
  depth: number;
}

function parseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function endOfJson(text: string, start: number): number {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
      continue;
    }
    if (char !== "}" && char !== "]") continue;
    if (stack.pop() !== char) return -1;
    if (stack.length === 0) return index;
  }
  return -1;
}

function jsonDocuments(message: string): unknown[] {
  const trimmed = message.trim();
  if (!trimmed) return [];
  const whole = parseJson(trimmed);
  if (whole !== null && typeof whole === "object") return [whole];

  const found: unknown[] = [];
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char !== "{" && char !== "[") continue;
    const end = endOfJson(trimmed, index);
    if (end < 0) continue;
    const parsed = parseJson(trimmed.slice(index, end + 1));
    if (parsed !== null && typeof parsed === "object") {
      found.push(parsed);
      index = end;
    }
  }
  return found;
}

export function consoleJsonValues(entries: ConsoleEntry[]): ConsoleJsonValue[] {
  const values: ConsoleJsonValue[] = [];
  for (const entry of entries) {
    jsonDocuments(entry.message).forEach((value, index) => {
      values.push({
        id: `${entry.id}:${index}`,
        entryId: entry.id,
        timestamp: entry.timestamp,
        type: entry.type,
        value,
      });
    });
  }
  return values;
}

export function jsonMetrics(value: unknown): JsonMetrics {
  const text = JSON.stringify(value) ?? "";
  let keys = 0;
  let depth = 1;

  const visit = (current: unknown, level: number) => {
    if (level > depth) depth = level;
    if (!current || typeof current !== "object") return;
    const names = Object.keys(current as object);
    keys += names.length;
    for (const name of names) visit((current as Record<string, unknown>)[name], level + 1);
  };
  visit(value, 1);

  return { bytes: text.length, keys, depth: text ? depth : 0 };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function jsonPreview(value: unknown): string {
  const text = JSON.stringify(value) ?? "";
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}
