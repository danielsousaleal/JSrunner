import * as ts from "typescript";
import { mergeImportMaps } from "./importmap";

const IMPORT_REGEX =
  /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?|export\s+(?:\*|\{[^}]*\})\s+from\s+)['"]([^'"]+)['"]/g;

export function transpileTypeScript(code: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext !== "ts" && ext !== "tsx") return code;

  return ts.transpileModule(code, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      strict: false,
      esModuleInterop: true,
    },
  }).outputText;
}

export function transpileAllFiles(
  files: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    result[path] = transpileTypeScript(content, path);
    const jsPath = path.replace(/\.tsx?$/, (m) =>
      m === ".tsx" ? ".jsx" : ".js"
    );
    if (jsPath !== path) {
      result[jsPath] = result[path];
    }
  }
  return result;
}

export function extractImports(code: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(IMPORT_REGEX.source, "g");
  while ((match = regex.exec(code)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

export function resolveRelativeImport(
  basePath: string,
  request: string
): string {
  if (request.startsWith("@/")) {
    return request.slice(2);
  }

  if (!request.startsWith(".")) {
    return request;
  }

  const baseParts = basePath.split("/").slice(0, -1);
  const reqParts = request.split("/");

  for (const part of reqParts) {
    if (part === ".") continue;
    if (part === "..") baseParts.pop();
    else baseParts.push(part);
  }

  return baseParts.join("/");
}

export function resolveModulePath(
  files: Record<string, string>,
  request: string
): string | null {
  const candidates = [
    request,
    `${request}.ts`,
    `${request}.tsx`,
    `${request}.js`,
    `${request}.jsx`,
    `${request}.mjs`,
    `${request}/index.ts`,
    `${request}/index.js`,
  ];

  for (const candidate of candidates) {
    if (files[candidate] !== undefined) return candidate;
  }

  return null;
}

export function resolveImportMapUrl(
  specifier: string,
  importMap: Record<string, string>
): string | null {
  const merged = mergeImportMaps(importMap);

  if (merged[specifier]) return merged[specifier];

  const withSlash = `${specifier}/`;
  for (const [key, value] of Object.entries(merged)) {
    if (key.endsWith("/") && specifier.startsWith(key.slice(0, -1))) {
      return value + specifier.slice(key.length - 1);
    }
  }

  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
    return `https://esm.sh/${specifier}`;
  }

  return null;
}

export async function prefetchExternalModules(
  files: Record<string, string>,
  importMap: Record<string, string>
): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  const pending = new Set<string>();

  for (const content of Object.values(files)) {
    for (const imp of extractImports(content)) {
      if (imp.startsWith(".") || imp.startsWith("@/")) continue;
      pending.add(imp);
    }
  }

  await Promise.all(
    Array.from(pending).map(async (specifier) => {
      const url = resolveImportMapUrl(specifier, importMap);
      if (!url) return;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Cannot find module '${specifier}'`);
        }
        cache.set(specifier, await response.text());
      } catch {
        // Module prefetch failed; loader will report at runtime
      }
    })
  );

  return cache;
}
