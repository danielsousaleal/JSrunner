"use client";

import { useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ConsoleEntry } from "@/lib/db";
import { useAppStore } from "@/lib/store";

const FILTERS = ["all", "log", "error", "warn", "network"] as const;
type Filter = (typeof FILTERS)[number];

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function entryColor(type: ConsoleEntry["type"]) {
  switch (type) {
    case "error":
      return "text-[var(--console-error)]";
    case "warn":
      return "text-[var(--console-warn)]";
    case "info":
      return "text-[var(--console-info)]";
    case "debug":
      return "text-[var(--console-debug)]";
    case "network":
      return "text-[var(--console-net)]";
    case "result":
      return "text-[var(--console-info)]";
    default:
      return "text-[var(--console-log)]";
  }
}

export function ConsoleOutput() {
  const workspace = useAppStore((s) => s.workspace);
  const clearConsole = useAppStore((s) => s.clearConsole);
  const [filter, setFilter] = useState<Filter>("all");

  const entries = workspace?.consoleHistory ?? [];

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    if (filter === "log") {
      return entries.filter((e) =>
        ["log", "info", "debug", "result"].includes(e.type)
      );
    }
    return entries.filter((e) => e.type === filter);
  }, [entries, filter]);

  const copyLogs = () => {
    const text = filtered
      .map((e) => `[${formatTime(e.timestamp)}] ${e.type.toUpperCase()} ${e.message}`)
      .join("\n");
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--vscode-bg)]">
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-[var(--vscode-border)] px-2">
        {FILTERS.map((item) => (
          <Button
            key={item}
            variant={filter === item ? "secondary" : "ghost"}
            size="xs"
            className="h-6 text-[11px] capitalize"
            onClick={() => setFilter(item)}
          >
            {item}
          </Button>
        ))}
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy console output"
            onClick={copyLogs}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Clear console"
            onClick={clearConsole}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-[var(--vscode-fg-muted)]">
            ▶ Run code to see output
          </div>
        ) : (
          <div className="space-y-0.5 p-2 font-mono text-xs" role="log">
            {filtered.map((entry) => (
              <div key={entry.id} className="leading-5">
                <span className="text-[var(--vscode-fg-subtle)]">
                  {formatTime(entry.timestamp)}{" "}
                </span>
                <span
                  className={cn(
                    "mr-2 font-semibold uppercase",
                    entryColor(entry.type)
                  )}
                >
                  {entry.type}
                </span>
                <span className={entryColor(entry.type)}>{entry.message}</span>
                {entry.meta?.stack && (
                  <pre className="mt-1 whitespace-pre-wrap text-[var(--console-error)]">
                    {entry.meta.stack}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
