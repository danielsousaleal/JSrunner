/// <reference lib="webworker" />

import {
  newQuickJSWASMModuleFromVariant,
  shouldInterruptAfterDeadline,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSRuntime,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";
import releaseVariant from "@jitl/quickjs-ng-wasmfile-release-sync";
import {
  prefetchExternalModules,
  resolveModulePath,
  resolveRelativeImport,
  transpileAllFiles,
} from "../lib/bundler";
import type { WorkerRequest, WorkerResponse } from "../lib/execution-types";
import {
  parseErrorLocation,
  stringifyLive,
  type LiveCoverage,
  type LiveValue,
} from "../lib/live-values";
import { LIVE_MARK_FN, LIVE_REPORT_FN } from "../lib/quokka-instrument";

let quickJS: QuickJSWASMModule | null = null;
let interruptRequested = false;
let executing = false;
let queued: Extract<WorkerRequest, { type: "execute" }> | null = null;
let currentRunId: number | undefined;

function post(response: WorkerResponse) {
  self.postMessage({ ...response, runId: currentRunId });
}

function formatArg(context: QuickJSContext, arg: unknown): string {
  const val = context.dump(arg as never);
  if (typeof val === "object" && val !== null) {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function setupConsole(context: QuickJSContext) {
  const levels = ["log", "error", "warn", "info", "debug", "table"] as const;

  const consoleObj = context.newObject();

  for (const level of levels) {
    const fn = context.newFunction(level, (...args: unknown[]) => {
      const message = args.map((arg) => formatArg(context, arg)).join(" ");
      post({
        type: "console",
        level: level === "table" ? "log" : level,
        message,
        timestamp: Date.now(),
      });
    });
    context.setProp(consoleObj, level, fn);
  }

  context.setProp(
    consoleObj,
    "clear",
    context.newFunction("clear", () => {
      post({ type: "console-clear", timestamp: Date.now() });
    })
  );

  context.setProp(context.global, "console", consoleObj);
}

interface LiveCollector {
  reports: Array<{
    file: string;
    line: number;
    preview: string;
    full: string;
    kind: LiveValue["kind"];
    name?: string;
  }>;
  instrumented: Map<string, number[]>;
}

function setupLiveReporter(context: QuickJSContext): LiveCollector {
  const collector: LiveCollector = {
    reports: [],
    instrumented: new Map(),
  };

  const reportFn = context.newFunction(
    LIVE_REPORT_FN,
    (
      valueHandle: QuickJSHandle,
      lineHandle: QuickJSHandle,
      nameHandle: QuickJSHandle,
      fileHandle: QuickJSHandle
    ) => {
      const dumped = context.dump(valueHandle);
      const line = Number(context.dump(lineHandle));
      const name = String(context.dump(nameHandle) ?? "");
      const file = String(context.dump(fileHandle) ?? "");
      const kind: LiveValue["kind"] = name === "log" ? "log" : "value";
      const isLogArgs = kind === "log" && Array.isArray(dumped);
      const preview = isLogArgs
        ? dumped.map((item) => stringifyLive(item, 120)).join(" ")
        : stringifyLive(dumped, 80);
      const full = isLogArgs
        ? dumped.map((item) => stringifyLive(item, 500)).join(" ")
        : stringifyLive(dumped, 2000);
      collector.reports.push({
        file,
        line,
        preview: preview.length > 80 ? `${preview.slice(0, 79)}…` : preview,
        full: full.length > 2000 ? `${full.slice(0, 1999)}…` : full,
        kind,
        name: name && name !== "log" ? name : undefined,
      });
      return valueHandle.dup();
    }
  );

  const markFn = context.newFunction(
    LIVE_MARK_FN,
    (fileHandle, linesHandle) => {
      const file = String(context.dump(fileHandle as never) ?? "");
      const lines = context.dump(linesHandle as never);
      if (Array.isArray(lines)) {
        collector.instrumented.set(
          file,
          lines.map((line) => Number(line)).filter((line) => Number.isFinite(line))
        );
      }
    }
  );

  context.setProp(context.global, LIVE_REPORT_FN, reportFn);
  context.setProp(context.global, LIVE_MARK_FN, markFn);
  return collector;
}

function aggregateLiveValues(
  collector: LiveCollector,
  error?: { file?: string; line?: number; message: string }
): { values: LiveValue[]; coverage: LiveCoverage[] } {
  const grouped = new Map<
    string,
    LiveValue & { logParts?: string[] }
  >();

  for (const report of collector.reports) {
    const key = `${report.file}:${report.line}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        file: report.file,
        line: report.line,
        preview: report.preview,
        full: report.full,
        kind: report.kind,
        name: report.name,
        count: 1,
      });
      continue;
    }
    existing.count += 1;
    existing.preview = report.preview;
    existing.full = report.full;
    existing.kind = report.kind;
    if (report.name) existing.name = report.name;
  }

  if (error?.line) {
    const file = error.file ?? "";
    const key = `${file}:${error.line}`;
    grouped.set(key, {
      file,
      line: error.line,
      preview: `⚠ ${error.message}`,
      full: error.message,
      kind: "error",
      count: 1,
    });
  }

  const coverage: LiveCoverage[] = [...collector.instrumented.entries()].map(
    ([file, instrumented]) => ({
      file,
      instrumented,
      covered: [...new Set(
        collector.reports.filter((report) => report.file === file).map((report) => report.line)
      )],
    })
  );

  return { values: [...grouped.values()], coverage };
}

async function executeCode(payload: WorkerRequest & { type: "execute" }) {
  interruptRequested = false;
  currentRunId = payload.payload.runId;

  if (!quickJS) {
    quickJS = await newQuickJSWASMModuleFromVariant(releaseVariant);
  }

  const live = payload.payload.live === true;
  const silent = payload.payload.silent === true;
  const transpiledFiles = transpileAllFiles(payload.payload.files, live);
  const externalModules = await prefetchExternalModules(
    payload.payload.files,
    payload.payload.importMap
  );

  const runtime: QuickJSRuntime = quickJS.newRuntime();
  runtime.setMemoryLimit(50 * 1024 * 1024);
  runtime.setMaxStackSize(1024 * 1024);
  const deadlineHandler = shouldInterruptAfterDeadline(Date.now() + 5000);
  runtime.setInterruptHandler((rt) => interruptRequested || deadlineHandler(rt));

  const mainFile = payload.payload.mainFile;

  runtime.setModuleLoader(
    (moduleName) => {
      let resolved = moduleName;
      if (moduleName.startsWith(".") || moduleName.startsWith("@/")) {
        const filePath = resolveModulePath(transpiledFiles, resolved);
        if (!filePath) {
          throw new Error(`Cannot find module '${moduleName}'`);
        }
        return transpiledFiles[filePath];
      }

      if (externalModules.has(moduleName)) {
        return externalModules.get(moduleName)!;
      }

      throw new Error(`Cannot find module '${moduleName}'`);
    },
    (_baseModuleName, requestedName) => {
      if (requestedName.startsWith(".") || requestedName.startsWith("@/")) {
        return resolveRelativeImport(_baseModuleName, requestedName);
      }
      return requestedName;
    }
  );

  const context = runtime.newContext();
  setupConsole(context);
  const collector = live ? setupLiveReporter(context) : null;

  const mainPath = resolveModulePath(transpiledFiles, mainFile) ?? mainFile;
  const mainCode = transpiledFiles[mainPath];

  if (!mainCode) {
    post({
      type: "error",
      message: `Main file not found: ${mainFile}`,
      timestamp: Date.now(),
    });
    post({ type: "done", timestamp: Date.now() });
    try {
      context.dispose();
      runtime.dispose();
    } catch {
      // ignore
    }
    return;
  }

  const isModule =
    /\b(import|export)\b/.test(mainCode) || mainPath.endsWith(".mjs");

  let runtimeError: { file?: string; line?: number; message: string } | undefined;

  try {
    const evalResult = context.evalCode(mainCode, mainPath, {
      type: isModule ? "module" : "global",
    });

    context.unwrapResult(evalResult);
    let jobsRun = 0;
    while (runtime.hasPendingJob() && jobsRun < 100 && !interruptRequested) {
      runtime.executePendingJobs(1);
      jobsRun++;
    }
    if (!silent && !interruptRequested) {
      post({
        type: "result",
        value: "Execution completed",
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    if (interruptRequested) {
      // superseded by a newer run
    } else if (message.includes("interrupted") || message.includes("deadline")) {
      post({
        type: "timeout",
        message: "Execution timed out (possible infinite loop detected)",
        timestamp: Date.now(),
      });
      runtimeError = { message: "Execution timed out" };
    } else {
      post({
        type: "error",
        message,
        stack: (error as Error).stack,
        timestamp: Date.now(),
      });
      runtimeError = {
        ...parseErrorLocation(message, (error as Error).stack),
        message,
      };
    }
  } finally {
    if (live && collector && !interruptRequested) {
      const { values, coverage } = aggregateLiveValues(collector, runtimeError);
      post({
        type: "live-values",
        values,
        coverage,
        timestamp: Date.now(),
      });
    }
    post({ type: "done", timestamp: Date.now() });
    try {
      context.dispose();
      runtime.dispose();
    } catch {
      // ignore cleanup errors
    }
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "abort") {
    interruptRequested = true;
    return;
  }

  if (message.type === "execute") {
    if (executing) {
      interruptRequested = true;
      queued = message;
      return;
    }

    executing = true;
    try {
      let current: Extract<WorkerRequest, { type: "execute" }> | null = message;
      while (current) {
        interruptRequested = false;
        await executeCode(current);
        current = queued;
        queued = null;
      }
    } finally {
      executing = false;
    }
  }
};

post({ type: "ready" });
