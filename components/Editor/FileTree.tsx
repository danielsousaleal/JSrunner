"use client";

import { useState } from "react";
import {
  FileCode,
  FileJson,
  Folder,
  PackagePlus,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { searchPackages } from "@/lib/packages";
import { useAppStore } from "@/lib/store";

function getFileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "json") return FileJson;
  return FileCode;
}

export function FileTree() {
  const workspace = useAppStore((s) => s.workspace);
  const setActiveFile = useAppStore((s) => s.setActiveFile);
  const openTab = useAppStore((s) => s.openTab);
  const addFile = useAppStore((s) => s.addFile);
  const deleteFile = useAppStore((s) => s.deleteFile);
  const renameFile = useAppStore((s) => s.renameFile);
  const addPackage = useAppStore((s) => s.addPackage);
  const dirtyFiles = useAppStore((s) => s.dirtyFiles);

  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [packageQuery, setPackageQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { name: string; description: string; version: string }[]
  >([]);

  if (!workspace) return null;

  const files = Object.keys(workspace.files).sort();

  const handleSearchPackages = async () => {
    const results = await searchPackages(packageQuery);
    setSearchResults(results);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--vscode-border)] px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-[var(--vscode-fg-muted)] uppercase">
          Files
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1">
          {files.map((path) => {
            const Icon = getFileIcon(path);
            const isActive = workspace.activeFile === path;
            const isDirty =
              dirtyFiles.has(path) || workspace.files[path]?.dirty;

            return (
              <ContextMenu key={path}>
                <ContextMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        "flex h-6 w-full items-center gap-2 px-3 text-left text-xs",
                        isActive
                          ? "border-l-2 border-[var(--vscode-blue)] bg-[var(--vscode-blue-muted)] text-[var(--vscode-fg)]"
                          : "border-l-2 border-transparent text-[var(--vscode-fg-muted)] hover:bg-[var(--vscode-bg-hover)]"
                      )}
                      onClick={() => {
                        openTab(path);
                        setActiveFile(path);
                      }}
                    />
                  }
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{path}</span>
                  {isDirty && (
                    <span className="ml-auto size-2 rounded-full bg-orange-400" />
                  )}
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => {
                      const newName = prompt("Rename file:", path);
                      if (newName && newName !== path) {
                        renameFile(path, newName.trim());
                      }
                    }}
                  >
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      const copy = prompt("Duplicate as:", path);
                      if (copy) {
                        addFile(copy.trim(), workspace.files[path].content);
                      }
                    }}
                  >
                    Duplicate
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Delete ${path}?`)) deleteFile(path);
                    }}
                  >
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </ScrollArea>

      <div className="space-y-1 border-t border-[var(--vscode-border)] p-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start text-xs"
          onClick={() => {
            const name = prompt("New file name:", "untitled.ts");
            if (name) addFile(name.trim());
          }}
        >
          <Plus className="size-3.5" />
          New File
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start text-xs"
          onClick={() => {
            const name = prompt("New folder path (e.g. src/utils.ts):", "src/index.ts");
            if (name) addFile(name.trim());
          }}
        >
          <Folder className="size-3.5" />
          New Folder
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start text-xs"
          onClick={() => setPackageDialogOpen(true)}
        >
          <PackagePlus className="size-3.5" />
          Add Package
        </Button>
      </div>

      {Object.keys(workspace.importMap).length > 0 && (
        <div className="border-t border-[var(--vscode-border)] p-2">
          <div className="mb-1 text-[10px] font-semibold tracking-wide text-[var(--vscode-fg-muted)] uppercase">
            Packages
          </div>
          <div className="space-y-1">
            {Array.from(
              new Set(
                Object.keys(workspace.importMap).filter((k) => !k.endsWith("/"))
              )
            ).map((name) => (
              <div
                key={name}
                className="flex items-center justify-between text-[11px] text-[var(--vscode-fg-muted)]"
              >
                <span>{name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => useAppStore.getState().removePackage(name)}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Package name (e.g. lodash)"
              value={packageQuery}
              onChange={(e) => setPackageQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearchPackages();
              }}
            />
            <Button size="sm" onClick={() => void handleSearchPackages()}>
              Search
            </Button>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {searchResults.map((pkg) => (
                <button
                  key={pkg.name}
                  type="button"
                  className="flex w-full flex-col rounded px-2 py-1 text-left hover:bg-muted"
                  onClick={() => {
                    const version =
                      pkg.version !== "latest" ? pkg.version : undefined;
                    const url = `https://esm.sh/${pkg.name}${version ? `@${version}` : ""}`;
                    addPackage(pkg.name, url);
                    setPackageDialogOpen(false);
                    setPackageQuery("");
                    setSearchResults([]);
                  }}
                >
                  <span className="text-sm font-medium">{pkg.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {pkg.description || pkg.version}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </div>
  );
}
