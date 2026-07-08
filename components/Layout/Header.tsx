"use client";

import {
  Download,
  LayoutPanelLeft,
  Loader2,
  Minus,
  Play,
  Plus,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore } from "@/lib/store";

interface HeaderProps {
  onRun: () => void;
  onDownload: () => void;
  onImport: () => void;
}

export function Header({ onRun, onDownload, onImport }: HeaderProps) {
  const workspace = useAppStore((s) => s.workspace);
  const isRunning = useAppStore((s) => s.isRunning);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const zoom = workspace?.settings.zoom ?? 1;
  const activeFile = workspace?.activeFile ?? "";
  const sidebarOpen = workspace?.settings.sidebarOpen ?? true;

  const adjustZoom = (delta: number) => {
    const next = Math.min(2, Math.max(0.5, Math.round((zoom + delta) * 10) / 10));
    updateSettings({ zoom: next });
  };

  return (
    <header className="header flex h-8 items-center justify-between border-b border-[var(--vscode-border)] bg-[var(--vscode-bg-secondary)] px-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[13px] font-semibold text-[var(--vscode-fg)]">
          JS Runner
        </span>
        <span className="truncate text-xs text-[var(--vscode-fg-muted)]">
          {activeFile}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Toggle sidebar (Ctrl+Shift+E)"
                onClick={() => updateSettings({ sidebarOpen: !sidebarOpen })}
              />
            }
          >
            <LayoutPanelLeft className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Toggle sidebar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={() => adjustZoom(-0.1)}
              />
            }
          >
            <ZoomOut className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>

        <span
          className="min-w-[48px] text-center text-xs text-[var(--vscode-fg-muted)]"
          aria-label={`Zoom level: ${Math.round(zoom * 100)}%`}
        >
          {Math.round(zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={() => adjustZoom(0.1)}
              />
            }
          >
            <ZoomIn className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Reset zoom (Ctrl+0)"
                onClick={() => updateSettings({ zoom: 1 })}
              />
            }
          >
            <Minus className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Reset zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Download workspace"
                onClick={onDownload}
              />
            }
          >
            <Download className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Download workspace</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Import workspace"
                onClick={onImport}
              />
            }
          >
            <Upload className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Import workspace</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                className="bg-[var(--vscode-blue)] text-white hover:bg-[var(--vscode-blue-hover)]"
                aria-label="Run code (Ctrl+Enter)"
                disabled={isRunning}
                onClick={onRun}
              />
            }
          >
            {isRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
          </TooltipTrigger>
          <TooltipContent>Run (Ctrl+Enter)</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
