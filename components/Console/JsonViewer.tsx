"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ConsoleEntry } from "@/lib/db";
import {
  consoleJsonValues,
  formatBytes,
  jsonMetrics,
  jsonPreview,
} from "@/lib/console-json";
import { JsonTree } from "./JsonTree";

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function JsonViewer({ entries }: { entries: ConsoleEntry[] }) {
  const values = useMemo(() => consoleJsonValues(entries), [entries]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [expanded, setExpanded] = useState<"auto" | "open" | "closed">("auto");
  const [path, setPath] = useState("$");
  const [notice, setNotice] = useState("");

  const newestId = values[0]?.id ?? "";
  useEffect(() => {
    setPinnedId(null);
    setPath("$");
    setExpanded("auto");
  }, [newestId]);

  const selected = values.find((item) => item.id === pinnedId) ?? values[0] ?? null;
  const metrics = selected ? jsonMetrics(selected.value) : null;

  const copy = (text: string, message: string) => {
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    };
    const finish = (copied: boolean) => {
      setNotice(copied ? message : "Could not copy");
      window.setTimeout(() => setNotice(""), 1600);
    };
    if (fallback()) {
      finish(true);
      return;
    }
    const write = navigator.clipboard?.writeText?.(text);
    if (!write) {
      finish(false);
      return;
    }
    void Promise.race([
      write,
      new Promise<void>((_, reject) => {
        window.setTimeout(() => reject(new Error("copy timeout")), 400);
      }),
    ]).then(
      () => finish(true),
      () => finish(false)
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--vscode-bg)]">
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-[var(--vscode-border)] px-2">
        <span className="text-[11px] text-[var(--vscode-fg-muted)]">
          {values.length} JSON
        </span>
        {values.length > 1 && (
          <select
            aria-label="JSON values from the console"
            className="h-6 max-w-56 truncate rounded border border-[var(--vscode-border)] bg-[var(--vscode-bg-secondary)] px-1 text-[11px]"
            value={selected?.id ?? ""}
            onChange={(event) => {
              setPinnedId(event.target.value);
              setPath("$");
            }}
          >
            {values.map((item) => (
              <option key={item.id} value={item.id}>
                {formatTime(item.timestamp)} {item.type} {jsonPreview(item.value)}
              </option>
            ))}
          </select>
        )}
        <input
          aria-label="Search JSON"
          value={term}
          placeholder="Search nodes"
          className="ml-auto h-6 w-36 rounded border border-[var(--vscode-border)] bg-[var(--vscode-bg)] px-2 text-[11px] outline-none"
          onChange={(event) => setTerm(event.target.value)}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Expand all"
          onClick={() => setExpanded("open")}
        >
          <ChevronsUpDown className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Collapse all"
          onClick={() => setExpanded("closed")}
        >
          <ChevronsDownUp className="size-3.5" />
        </Button>
      </div>
      <div className="flex h-6 shrink-0 items-center gap-2 border-b border-[var(--vscode-border)] px-2 text-[11px]">
        <span className="text-[var(--vscode-fg-subtle)]">Path</span>
        <span className="truncate text-[#9cdcfe]">{path}</span>
        <button
          type="button"
          className="ml-auto text-[var(--vscode-fg-muted)] hover:text-[var(--vscode-fg)]"
          onClick={() => copy(path, "Path copied")}
        >
          Copy path
        </button>
        {notice && <span className="text-[var(--console-info)]">{notice}</span>}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {!selected ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-[var(--vscode-fg-muted)]">
            Run code that logs an object or array.
          </div>
        ) : (
          <div className="p-2" role="tree">
            <JsonTree
              key={`${selected.id}:${expanded}:${term}`}
              value={selected.value}
              term={term}
              expanded={expanded}
              onSelect={setPath}
              onCopy={(text) => copy(text, "Copied")}
            />
          </div>
        )}
      </ScrollArea>
      <div className="flex h-6 shrink-0 items-center gap-3 border-t border-[var(--vscode-border)] px-2 font-mono text-[10px] text-[var(--vscode-fg-muted)]">
        <span>Size {metrics ? formatBytes(metrics.bytes) : "0 B"}</span>
        <span>Keys {metrics?.keys ?? 0}</span>
        <span>Depth {metrics?.depth ?? 0}</span>
        <span className="ml-auto">From the console, in this browser</span>
      </div>
    </div>
  );
}
