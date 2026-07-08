/// <reference lib="webworker" />

import {
  newQuickJSWASMModuleFromVariant,
  shouldInterruptAfterDeadline,
  type QuickJSContext,
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

let quickJS: QuickJSWASMModule | null = null;
let aborted = false;

function post(response: WorkerResponse) {
  self.postMessage(response);
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

async function executeCode(payload: WorkerRequest & { type: "execute" }) {
  aborted = false;

  if (!quickJS) {
    quickJS = await newQuickJSWASMModuleFromVariant(releaseVariant);
  }

  const transpiledFiles = transpileAllFiles(payload.payload.files);
  const externalModules = await prefetchExternalModules(
    payload.payload.files,
    payload.payload.importMap
  );

  const runtime: QuickJSRuntime = quickJS.newRuntime();
  runtime.setMemoryLimit(50 * 1024 * 1024);
  runtime.setMaxStackSize(1024 * 1024);
  runtime.setInterruptHandler(
    shouldInterruptAfterDeadline(Date.now() + 5000)
  );

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
    /\b(import|export)\b/.test(mainCode) ||
    mainPath.endsWith(".mjs");

  try {
    const evalResult = context.evalCode(mainCode, mainPath, {
      type: isModule ? "module" : "global",
    });

    context.unwrapResult(evalResult);
    // Drain microtasks with a cap — avoid hanging on stray pending jobs
    let jobsRun = 0;
    while (runtime.hasPendingJob() && jobsRun < 100) {
      runtime.executePendingJobs(1);
      jobsRun++;
    }
    post({
      type: "result",
      value: "Execution completed",
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    if (message.includes("interrupted") || message.includes("deadline")) {
      post({
        type: "timeout",
        message: "Execution timed out (possible infinite loop detected)",
        timestamp: Date.now(),
      });
    } else {
      post({
        type: "error",
        message,
        stack: (error as Error).stack,
        timestamp: Date.now(),
      });
    }
  } finally {
    // Signal completion before cleanup — dispose() can take several seconds
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
  if (aborted) return;

  const message = event.data;
  if (message.type === "abort") {
    aborted = true;
    post({ type: "done", timestamp: Date.now() });
    return;
  }

  if (message.type === "execute") {
    await executeCode(message);
  }
};

post({ type: "ready" });
