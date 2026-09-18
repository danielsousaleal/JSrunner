"use client";

import { useCallback, useEffect, useRef } from "react";
import { AppShell } from "@/components/Layout/AppShell";
import MonacoEditor from "@/components/Editor/MonacoProvider";
import { FileTree } from "@/components/Editor/FileTree";
import { ConsoleOutput } from "@/components/Console/ConsoleOutput";
import { executionController } from "@/lib/execution";
import { exportWorkspace } from "@/lib/export";
import { importWorkspaceFromFile } from "@/lib/import";
import { buildImportMapScript } from "@/lib/importmap";
import { isExecutablePath } from "@/lib/live-values";
import { useAppStore } from "@/lib/store";

export function IDEPage() {
  const initialized = useAppStore((s) => s.initialized);
  const workspace = useAppStore((s) => s.workspace);
  const initialize = useAppStore((s) => s.initialize);
  const addConsoleEntry = useAppStore((s) => s.addConsoleEntry);
  const clearConsole = useAppStore((s) => s.clearConsole);
  const setRunning = useAppStore((s) => s.setRunning);
  const setLiveResults = useAppStore((s) => s.setLiveResults);
  const clearLiveResults = useAppStore((s) => s.clearLiveResults);
  const replaceWorkspace = useAppStore((s) => s.replaceWorkspace);
  const save = useAppStore((s) => s.save);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!workspace) return;

    const scriptId = "js-runner-importmap";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "importmap";
      document.head.appendChild(script);
    }
    script.textContent = buildImportMapScript(workspace.importMap);
  }, [workspace?.importMap]);

  const handleRun = useCallback(
    (options: { silent?: boolean } = {}) => {
      if (!workspace?.activeFile) return;
      if (!isExecutablePath(workspace.activeFile)) return;

      const live = workspace.settings.livePreview ?? true;
      const silent = options.silent === true;

      if (!silent) setRunning(true);
      if (silent) clearConsole();
      if (!live) clearLiveResults();

      const files: Record<string, string> = {};
      for (const [path, file] of Object.entries(workspace.files)) {
        files[path] = file.content;
      }

      executionController.run(
        {
          mainFile: workspace.activeFile,
          files,
          importMap: workspace.importMap,
        },
        (entry) => {
          if (silent && entry.type === "result") return;
          addConsoleEntry(entry);
        },
        () => {
          setRunning(false);
        },
        {
          live,
          silent,
          onLiveValues: live ? setLiveResults : undefined,
        }
      );
    },
    [
      workspace,
      addConsoleEntry,
      setRunning,
      clearConsole,
      clearLiveResults,
      setLiveResults,
    ]
  );

  useEffect(() => {
    const onRun = () => handleRun();
    const onSave = () => void save();
    const onToggleSidebar = () => {
      updateSettings({ sidebarOpen: !workspace?.settings.sidebarOpen });
    };
    const onToggleLive = () => {
      updateSettings({
        livePreview: !(workspace?.settings.livePreview ?? true),
      });
    };
    const onFocusConsole = () => {
      document
        .querySelector('[aria-label="Console output"]')
        ?.scrollIntoView({ behavior: "smooth" });
    };

    window.addEventListener("js-runner:run", onRun);
    window.addEventListener("js-runner:save", onSave);
    window.addEventListener("js-runner:toggle-sidebar", onToggleSidebar);
    window.addEventListener("js-runner:toggle-live", onToggleLive);
    window.addEventListener("js-runner:focus-console", onFocusConsole);

    return () => {
      window.removeEventListener("js-runner:run", onRun);
      window.removeEventListener("js-runner:save", onSave);
      window.removeEventListener("js-runner:toggle-sidebar", onToggleSidebar);
      window.removeEventListener("js-runner:toggle-live", onToggleLive);
      window.removeEventListener("js-runner:focus-console", onFocusConsole);
    };
  }, [
    handleRun,
    save,
    updateSettings,
    workspace?.settings.sidebarOpen,
    workspace?.settings.livePreview,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === "s") {
          event.preventDefault();
          void save();
          return;
        }
        if (event.key === "0") {
          event.preventDefault();
          updateSettings({ zoom: 1 });
        }
        if (event.key === "=" || event.key === "+") {
          event.preventDefault();
          const zoom = workspace?.settings.zoom ?? 1;
          updateSettings({
            zoom: Math.min(2, Math.round((zoom + 0.1) * 10) / 10),
          });
        }
        if (event.key === "-") {
          event.preventDefault();
          const zoom = workspace?.settings.zoom ?? 1;
          updateSettings({
            zoom: Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10),
          });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [updateSettings, workspace?.settings.zoom, save]);

  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;

  const contentFingerprint = workspace
    ? Object.entries(workspace.files)
        .map(([path, file]) => `${path}\0${file.content}`)
        .join("\n")
    : "";
  const livePreview = workspace?.settings.livePreview ?? true;

  useEffect(() => {
    if (!livePreview) {
      clearLiveResults();
      return;
    }
    if (!workspace?.activeFile || !isExecutablePath(workspace.activeFile)) {
      return;
    }

    const timer = window.setTimeout(() => {
      handleRunRef.current({ silent: true });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [contentFingerprint, workspace?.activeFile, livePreview, clearLiveResults]);

  const handleDownload = () => {
    if (workspace) exportWorkspace(workspace);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        "Importing will replace your current workspace. Continue?"
      )
    ) {
      event.target.value = "";
      return;
    }

    const imported = await importWorkspaceFromFile(file);
    if (imported) {
      replaceWorkspace(imported);
    } else {
      alert("Failed to import workspace. Please check the file format.");
    }
    event.target.value = "";
  };

  if (!initialized || !workspace) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--vscode-bg)] text-[var(--vscode-fg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-2 border-[#007acc] border-t-transparent" />
          <span className="text-sm">Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileImport}
      />
      <AppShell
        sidebar={<FileTree />}
        editor={<MonacoEditor />}
        console={<ConsoleOutput />}
        onRun={handleRun}
        onDownload={handleDownload}
        onImport={handleImport}
      />
    </>
  );
}
