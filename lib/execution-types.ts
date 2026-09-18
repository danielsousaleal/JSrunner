import type { LiveCoverage, LiveValue } from "./live-values";

export type { LiveCoverage, LiveValue };

export type WorkerRequest =
  | {
      type: "execute";
      payload: {
        mainFile: string;
        files: Record<string, string>;
        importMap: Record<string, string>;
        live?: boolean;
        silent?: boolean;
        runId: number;
      };
    }
  | { type: "abort"; runId?: number };

export type WorkerResponse =
  | { type: "ready" }
  | {
      type: "console";
      level: string;
      message: string;
      timestamp: number;
      runId?: number;
    }
  | { type: "console-clear"; timestamp: number; runId?: number }
  | {
      type: "network-request";
      url: string;
      method: string;
      timestamp: number;
      runId?: number;
    }
  | {
      type: "network-response";
      url: string;
      method?: string;
      status: number;
      statusText?: string;
      duration?: number;
      timestamp: number;
      runId?: number;
    }
  | {
      type: "network-error";
      url: string;
      error: string;
      timestamp: number;
      runId?: number;
    }
  | { type: "result"; value: string; timestamp: number; runId?: number }
  | {
      type: "error";
      message: string;
      stack?: string;
      timestamp: number;
      runId?: number;
    }
  | { type: "timeout"; message: string; timestamp: number; runId?: number }
  | {
      type: "live-values";
      values: LiveValue[];
      coverage: LiveCoverage[];
      timestamp: number;
      runId?: number;
    }
  | { type: "done"; timestamp: number; runId?: number };
