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
  const maxDepth = 3;
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
  if (value instanceof Set) {
    const items = [...value].slice(0, 8).map((item) => stringifyValue(item, depth + 1));
    if (value.size > 8) items.push("…");
    return `Set(${items.join(", ")})`;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 20).map((item) => stringifyValue(item, depth + 1));
    if (value.length > 20) items.push("…");
    return `[${items.join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const shown = entries
      .slice(0, 12)
      .map(([key, item]) => `${key}: ${stringifyValue(item, depth + 1)}`);
    if (entries.length > 12) shown.push("…");
    return `{${shown.join(", ")}}`;
  }
  return String(value);
}

export function formatLivePreview(value: LiveValue): string {
  const labeled =
    value.name && value.kind !== "log" && value.kind !== "error"
      ? `${value.name} = ${value.preview}`
      : value.preview;
  if (value.count > 1) return `${labeled}  ×${value.count}`;
  return labeled;
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
