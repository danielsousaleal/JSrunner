import type { ConsoleEntry } from "./db";
import type { WorkerRequest, WorkerResponse } from "./execution-types";
import { generateId } from "./utils";

const TIMEOUT_MS = 5000;

export class ExecutionController {
  private worker: Worker | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private executionId = "";

  run(
    payload: Extract<WorkerRequest, { type: "execute" }>["payload"],
    onEntry: (entry: ConsoleEntry) => void,
    onComplete: () => void
  ) {
    this.terminate();
    this.executionId = generateId();

    this.worker = new Worker(
      new URL("../workers/quickjs.worker.ts", import.meta.url)
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;

      switch (data.type) {
        case "console":
          onEntry({
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
          onEntry({
            id: generateId(),
            executionId: this.executionId,
            timestamp: data.timestamp,
            type: "network",
            message: `▶ ${data.method} ${data.url}`,
            meta: { url: data.url, method: data.method },
          });
          break;
        case "network-response":
          onEntry({
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
          onEntry({
            id: generateId(),
            executionId: this.executionId,
            timestamp: data.timestamp,
            type: "error",
            message: `Network error: ${data.error} (${data.url})`,
            meta: { url: data.url },
          });
          break;
        case "error":
          onEntry({
            id: generateId(),
            executionId: this.executionId,
            timestamp: data.timestamp,
            type: "error",
            message: data.message,
            meta: { stack: data.stack },
          });
          break;
        case "timeout":
          onEntry({
            id: generateId(),
            executionId: this.executionId,
            timestamp: data.timestamp,
            type: "error",
            message: data.message,
          });
          break;
        case "result":
          this.clearTimeout();
          onEntry({
            id: generateId(),
            executionId: this.executionId,
            timestamp: data.timestamp,
            type: "result",
            message: data.value,
          });
          break;
        case "done":
          this.clearTimeout();
          onComplete();
          this.terminate();
          break;
      }
    };

    this.worker.onerror = (error) => {
      onEntry({
        id: generateId(),
        executionId: this.executionId,
        timestamp: Date.now(),
        type: "error",
        message: error.message || "Worker error",
      });
      onComplete();
      this.terminate();
    };

    this.timeoutId = setTimeout(() => {
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

    const request: WorkerRequest = { type: "execute", payload };
    this.worker.postMessage(request);
  }

  abort() {
    this.worker?.postMessage({ type: "abort" } satisfies WorkerRequest);
    this.terminate();
  }

  terminate() {
    this.clearTimeout();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export const executionController = new ExecutionController();
