export type WorkerRequest =
  | {
      type: "execute";
      payload: {
        mainFile: string;
        files: Record<string, string>;
        importMap: Record<string, string>;
      };
    }
  | { type: "abort" };

export type WorkerResponse =
  | { type: "ready" }
  | {
      type: "console";
      level: string;
      message: string;
      timestamp: number;
    }
  | { type: "console-clear"; timestamp: number }
  | {
      type: "network-request";
      url: string;
      method: string;
      timestamp: number;
    }
  | {
      type: "network-response";
      url: string;
      status: number;
      statusText?: string;
      duration?: number;
      timestamp: number;
    }
  | {
      type: "network-error";
      url: string;
      error: string;
      timestamp: number;
    }
  | { type: "result"; value: string; timestamp: number }
  | { type: "error"; message: string; stack?: string; timestamp: number }
  | { type: "timeout"; message: string; timestamp: number }
  | { type: "done"; timestamp: number };
