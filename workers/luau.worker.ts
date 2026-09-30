/// <reference lib="webworker" />

import { LuauState, preloadLuau } from "../lib/luau-engine";
import type { WorkerRequest, WorkerResponse } from "../lib/execution-types";
import {
  buildLuauPrelude,
  formatLuauValue,
  isLuauPath,
  luaString,
  luauModuleGlobal,
} from "../lib/luau";
import { installRobloxSandbox } from "../lib/luau-roblox";

let currentRunId: number | undefined;
let executing = false;
let interruptRequested = false;
let queued: Extract<WorkerRequest, { type: "execute" }> | null = null;

function post(response: WorkerResponse) {
  self.postMessage({ ...response, runId: currentRunId });
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

let printListener: ((message: string) => void) | null = null;
const originalLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  const message = args.map((arg) => (typeof arg === "string" ? arg : String(arg))).join(" ");
  if (printListener) printListener(message);
  else originalLog(...args);
};

async function executeCode(message: Extract<WorkerRequest, { type: "execute" }>) {
  const { mainFile, files, silent } = message.payload;
  currentRunId = message.payload.runId;

  if (initError) {
    post({ type: "error", message: initError, timestamp: Date.now() });
    post({ type: "done", timestamp: Date.now() });
    return;
  }

  if (!isLuauPath(mainFile) || files[mainFile] === undefined) {
    post({
      type: "error",
      message: `Main file not found: ${mainFile}`,
      timestamp: Date.now(),
    });
    post({ type: "done", timestamp: Date.now() });
    return;
  }

  const state = await LuauState.createAsync();
  try {
    const modules = Object.keys(files)
      .filter((path) => isLuauPath(path))
      .sort()
      .map((path, index) => ({ path, globalName: luauModuleGlobal(index), source: files[path] ?? "" }));

    const env = state.env;
    if (!env) throw new Error("Luau runtime is unavailable");
    env.set(
      "warn",
      (message: unknown) => {
        post({
          type: "console",
          level: "warn",
          message: formatLuauValue(message),
          timestamp: Date.now(),
        });
      },
      true
    );
    const showValue = await installRobloxSandbox(state);

    for (const module of modules) {
      const compiled = state.loadstring(module.source, module.path, true);
      if (!env.set(module.globalName, compiled, true)) {
        throw new Error(`Could not prepare ${module.path}`);
      }
    }

    const prelude = state.loadstring(
      buildLuauPrelude(modules.map(({ path, globalName }) => ({ path, globalName }))),
      "prelude.luau",
      true
    );
    await prelude();

    const boot = state.loadstring(
      `__luau_enter(${luaString(mainFile)})\n__luau_enter = nil\n`,
      "boot.luau",
      true
    );
    await boot();

    if (interruptRequested) return;

    const main = state.loadstring(files[mainFile] ?? "", mainFile, true);
    printListener = (message) => {
      post({
        type: "console",
        level: "log",
        message,
        timestamp: Date.now(),
      });
    };
    const returned = await main();

    if (!silent && !interruptRequested) {
      const values = Array.isArray(returned) ? returned : [returned];
      const visible = values.filter((value) => value !== undefined);
      let value = "Execution completed";
      if (visible.length > 0) {
        const shown = await Promise.all(visible.map(async (item) => {
          try {
            return await showValue(item);
          } catch {
            return formatLuauValue(item);
          }
        }));
        value = shown.join("\t");
      }
      post({
        type: "result",
        value,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    if (!interruptRequested) {
      post({
        type: "error",
        message: errorText(error),
        timestamp: Date.now(),
      });
    }
  } finally {
    printListener = null;
    post({ type: "done", timestamp: Date.now() });
  }
}

let initError = "";

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "abort") {
    interruptRequested = true;
    return;
  }

  if (message.type !== "execute") return;
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
};

void preloadLuau()
  .then(() => {
    post({ type: "ready" });
  })
  .catch((error) => {
    initError = errorText(error);
    post({ type: "ready" });
  });
