import type { ConsoleEntry } from "./db";
import type { WorkerRequest, WorkerResponse } from "./execution-types";
import type { LiveCoverage, LiveValue } from "./live-values";
import { generateId } from "./utils";

const TIMEOUT_MS = 5000;

export interface RunOptions {
  live?: boolean;
  silent?: boolean;
  onLiveValues?: (values: LiveValue[], coverage: LiveCoverage[]) => void;
}

export class ExecutionController {
  private worker: Worker | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private executionId = "";
  private runId = 0;
  private readyPromise: Promise<void> | null = null;
  private callbacks: {
    runId: number;
    onEntry: (entry: ConsoleEntry) => void;
    onComplete: () => void;
    onLiveValues?: (values: LiveValue[], coverage: LiveCoverage[]) => void;
  } | null = null;

  run(
    payload: Omit<
      Extract<WorkerRequest, { type: "execute" }>["payload"],
      "runId" | "live" | "silent"
    >,
    onEntry: (entry: ConsoleEntry) => void,
    onComplete: () => void,
    options: RunOptions = {}
  ) {
    this.runId += 1;
    const runId = this.runId;
    this.executionId = generateId();
    this.callbacks = {
      runId,
      onEntry,
      onComplete,
      onLiveValues: options.onLiveValues,
    };

    if (this.worker) {
      this.worker.postMessage({ type: "abort", runId } satisfies WorkerRequest);
    }

    this.clearTimeout();
    this.timeoutId = setTimeout(() => {
      if (this.callbacks?.runId !== runId) return;
      const { onEntry, onComplete } = this.callbacks;
      this.callbacks = null;
      onEntry({
        id: generateId(),
        executionId: this.executionId,
        timestamp: Date.now(),
        type: "error",
        message: "Execution timed out (possible infinite loop detected)",
      });
      this.abort();
      onComplete();
    }, TIMEOUT_MS);

    void this.postExecute(payload, runId, options);
  }

  abort() {
    this.worker?.postMessage({ type: "abort" } satisfies WorkerRequest);
    this.clearTimeout();
  }

  terminate() {
    this.clearTimeout();
    this.callbacks = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.readyPromise = null;
    }
  }

  private async postExecute(
    payload: Omit<
      Extract<WorkerRequest, { type: "execute" }>["payload"],
      "runId" | "live" | "silent"
    >,
    runId: number,
    options: RunOptions
  ) {
    const worker = this.ensureWorker();
    await this.readyPromise;
    if (this.callbacks?.runId !== runId) return;

    const request: WorkerRequest = {
      type: "execute",
      payload: {
        ...payload,
        live: options.live,
        silent: options.silent,
        runId,
      },
    };
    worker.postMessage(request);
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    this.worker = new Worker(
      new URL("../workers/quickjs.worker.ts", import.meta.url)
    );

    this.readyPromise = new Promise((resolve) => {
      const worker = this.worker;
      if (!worker) {
        resolve();
        return;
      }

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;
        if (data.type === "ready") {
          resolve();
          return;
        }

        const callbacks = this.callbacks;
        if (!callbacks) return;
        if (data.runId !== undefined && data.runId !== callbacks.runId) return;

        switch (data.type) {
          case "console":
            callbacks.onEntry({
              id: generateId(),
              executionId: this.executionId,
              timestamp: data.timestamp,
              type: data.level as ConsoleEntry["type"],
              message: data.message,
            });
            break;
          case "console-clear":
            break;
          case "network-request":
            callbacks.onEntry({
              id: generateId(),
              executionId: this.executionId,
              timestamp: data.timestamp,
              type: "network",
              message: `▶ ${data.method} ${data.url}`,
              meta: { url: data.url, method: data.method },
            });
            break;
          case "network-response":
            callbacks.onEntry({
              id: generateId(),
              executionId: this.executionId,
              timestamp: data.timestamp,
              type: "network",
              message: `◀ ${data.status} ${data.url}${data.duration ? ` (${data.duration}ms)` : ""}`,
              meta: {
                url: data.url,
                status: data.status,
                duration: data.duration,
              },
            });
            break;
          case "network-error":
            callbacks.onEntry({
              id: generateId(),
              executionId: this.executionId,
              timestamp: data.timestamp,
              type: "error",
              message: `Network error: ${data.error} (${data.url})`,
              meta: { url: data.url },
            });
            break;
          case "error":
            callbacks.onEntry({
              id: generateId(),
              executionId: this.executionId,
              timestamp: data.timestamp,
              type: "error",
              message: data.message,
              meta: { stack: data.stack },
            });
            break;
          case "timeout":
            callbacks.onEntry({
              id: generateId(),
              executionId: this.executionId,
              timestamp: data.timestamp,
              type: "error",
              message: data.message,
            });
            break;
          case "result":
            this.clearTimeout();
            callbacks.onEntry({
              id: generateId(),
              executionId: this.executionId,
              timestamp: data.timestamp,
              type: "result",
              message: data.value,
            });
            break;
          case "live-values":
            callbacks.onLiveValues?.(data.values, data.coverage);
            break;
          case "done":
            this.clearTimeout();
            callbacks.onComplete();
            break;
        }
      };

      worker.onerror = (error) => {
        const callbacks = this.callbacks;
        callbacks?.onEntry({
          id: generateId(),
          executionId: this.executionId,
          timestamp: Date.now(),
          type: "error",
          message: error.message || "Worker error",
        });
        callbacks?.onComplete();
        this.terminate();
      };
    });

    return this.worker;
  }

  private clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export const executionController = new ExecutionController();
