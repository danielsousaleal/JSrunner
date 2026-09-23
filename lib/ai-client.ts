import { authorizedAccount } from "./account-client";

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type AssistantTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: AgentToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };

export interface ToolStreamEvent {
  index: number;
  id?: string;
  name?: string;
  arguments?: string;
}

export async function streamAssistant(
  messages: AssistantTurn[],
  onDelta: (text: string) => void,
  signal: AbortSignal,
  options?: {
    provider?: "platform" | "byok";
    apiKey?: string;
    keySource?: "account" | "request";
    agent?: boolean;
    onTool?: (tool: ToolStreamEvent) => void;
  }
): Promise<void> {
  const response = await authorizedAccount("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages,
      provider: options?.provider ?? "platform",
      ...(options?.agent ? { agent: true } : {}),
      ...(options?.keySource ? { keySource: options.keySource } : {}),
      ...(options?.provider === "byok" && options.apiKey ? { apiKey: options.apiKey } : {}),
    }),
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || "The assistant is unavailable");
  }
  if (!response.body) throw new Error("The assistant is unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part
        .split("\n")
        .map((item) => item.trim())
        .find((item) => item.startsWith("data:"));
      if (!line) continue;
      const data = JSON.parse(line.slice(5).trim()) as {
        delta?: string;
        error?: string;
        tool?: ToolStreamEvent;
      };
      if (data.error) throw new Error(data.error);
      if (data.delta) onDelta(data.delta);
      if (data.tool) options?.onTool?.(data.tool);
    }
  }
}
