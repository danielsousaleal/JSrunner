"use client";

import { useEffect, useMemo } from "react";
import type { BeforeMount, OnMount } from "@monaco-editor/react";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { getMonacoLanguage } from "@/lib/db";
import {
  configureMonacoWorkers,
  editorOptions,
  initMonacoTheme,
  setupKeyboardShortcuts,
} from "@/lib/monaco";
import { useAppStore } from "@/lib/store";
import { FileTabs } from "./FileTabs";

export default function MonacoEditorPanel() {
  const workspace = useAppStore((s) => s.workspace);
  const updateFile = useAppStore((s) => s.updateFile);

  useEffect(() => {
    configureMonacoWorkers();
  }, []);

  const activeFile = workspace?.activeFile ?? "";
  const activeContent = workspace?.files[activeFile]?.content ?? "";
  const language = useMemo(
    () => (activeFile ? getMonacoLanguage(activeFile) : "typescript"),
    [activeFile]
  );

  const handleBeforeMount: BeforeMount = (monacoApi) => {
    initMonacoTheme(monacoApi);
  };

  const handleMount: OnMount = (editorInstance, monacoApi) => {
    (window as unknown as { monaco: typeof monaco }).monaco = monaco;
    setupKeyboardShortcuts(editorInstance, monacoApi);
    editorInstance.focus();
  };

  const settings = workspace?.settings;

  if (!workspace || !activeFile) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-[#9c9c9c]">
        No file open
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e]">
      <FileTabs />
      <div className="monaco-editor-panel min-h-0 flex-1 bg-[#1e1e1e]">
        <Editor
          height="100%"
          theme="js-runner-dark"
          className="monaco-dark-editor"
          path={activeFile}
          language={language}
          defaultValue={activeContent}
          saveViewState
          keepCurrentModel
          beforeMount={handleBeforeMount}
          options={{
            ...editorOptions,
            fontSize: settings?.fontSize ?? 14,
            tabSize: settings?.tabSize ?? 2,
            wordWrap: settings?.wordWrap ?? "on",
            minimap: { enabled: settings?.minimap ?? false },
          }}
          onMount={handleMount}
          onChange={(value) => {
            updateFile(activeFile, value ?? "");
          }}
        />
      </div>
    </div>
  );
}
