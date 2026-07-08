"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export function FileTabs() {
  const workspace = useAppStore((s) => s.workspace);
  const setActiveFile = useAppStore((s) => s.setActiveFile);
  const closeTab = useAppStore((s) => s.closeTab);
  const dirtyFiles = useAppStore((s) => s.dirtyFiles);

  if (!workspace) return null;

  return (
    <div
      className="flex h-7 shrink-0 items-end gap-0 overflow-x-auto border-b border-[var(--vscode-border)] bg-[var(--vscode-bg-secondary)]"
      role="tablist"
      aria-label="File tabs"
    >
      {workspace.openTabs.map((path) => {
        const isActive = workspace.activeFile === path;
        const isDirty = dirtyFiles.has(path) || workspace.files[path]?.dirty;

        return (
          <div
            key={path}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "group flex h-7 max-w-[180px] cursor-pointer items-center gap-1 border-r border-[var(--vscode-border)] px-2 text-xs",
              isActive
                ? "bg-[var(--vscode-bg)] text-[var(--vscode-fg)]"
                : "bg-[var(--vscode-bg-secondary)] text-[var(--vscode-fg-muted)] hover:bg-[var(--vscode-bg-hover)]"
            )}
            onClick={() => setActiveFile(path)}
          >
            <span className="truncate">{path.split("/").pop()}</span>
            {isDirty && (
              <span
                className="size-2 shrink-0 rounded-full bg-orange-400"
                aria-label="Unsaved changes"
              />
            )}
            <button
              type="button"
              className="ml-auto hidden rounded p-0.5 hover:bg-[var(--vscode-bg-hover)] group-hover:inline-flex"
              aria-label={`Close ${path}`}
              onClick={(event) => {
                event.stopPropagation();
                closeTab(path);
              }}
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="flex h-7 items-center px-2 text-[var(--vscode-fg-muted)] hover:bg-[var(--vscode-bg-hover)]"
        aria-label="New file"
        onClick={() => {
          const name = prompt("New file name:", "untitled.ts");
          if (name) useAppStore.getState().addFile(name.trim());
        }}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
