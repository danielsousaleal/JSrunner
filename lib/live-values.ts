export type LiveValueKind = "value" | "log" | "error";

export interface LiveValue {
  file: string;
  line: number;
  preview: string;
  full: string;
  kind: LiveValueKind;
  name?: string;
  count: number;
}

export interface LiveCoverage {
  file: string;
  instrumented: number[];
  covered: number[];
}

export function isExecutablePath(path: string): boolean {
  return /\.(m?[jt]sx?|cjs)$/.test(path);
}

export function normalizeLivePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/\\/g, "/");
}

export function stringifyLive(value: unknown, maxLength: number): string {
  const text = stringifyValue(value, 0);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function stringifyValue(value: unknown, depth: number): string {
  const maxDepth = 2;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return String(value);
  }
  if (typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") {
    const name = (value as { name?: string }).name;
    return name ? `[Function ${name}]` : "[Function]";
  }
  if (depth >= maxDepth) {
    return Array.isArray(value) ? "[…]" : "{…}";
  }
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Set) return `Set(${value.size})`;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const maxItems = depth === 0 ? 2 : 1;
    const items = value
      .slice(0, maxItems)
      .map((item) => stringifyValue(item, depth + 1));
    if (value.length > maxItems) items.push("…");
    return `[${items.join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const maxKeys = depth === 0 ? 2 : 1;
    const shown = entries
      .slice(0, maxKeys)
      .map(([key, item]) => `${key}: ${stringifyValue(item, depth + 1)}`);
    if (entries.length > maxKeys) shown.push("…");
    return `{${shown.join(", ")}}`;
  }
  return String(value);
}

export function formatLivePreview(value: LiveValue): string {
  return value.preview;
}

export function parseErrorLocation(
  message: string,
  stack?: string
): { file?: string; line?: number } {
  const text = `${message}\n${stack ?? ""}`;
  const matches = [
    ...text.matchAll(/([^\s()]+?\.(?:m?[jt]sx?|cjs)):(\d+)(?::\d+)?/g),
  ];
  const last = matches.at(-1);
  if (!last) return {};
  return { file: normalizeLivePath(last[1]), line: Number(last[2]) };
}
