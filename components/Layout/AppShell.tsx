"use client";

import { CollapsibleSidebar } from "./CollapsibleSidebar";
import { Header } from "./Header";
import { ResizableSplit } from "./ResizableSplit";
import { useAppStore } from "@/lib/store";

interface AppShellProps {
  sidebar: React.ReactNode;
  editor: React.ReactNode;
  console: React.ReactNode;
  onRun: () => void;
  onDownload: () => void;
  onImport: () => void;
}

export function AppShell({
  sidebar,
  editor,
  console: consolePanel,
  onRun,
  onDownload,
  onImport,
}: AppShellProps) {
  const workspace = useAppStore((s) => s.workspace);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const sidebarOpen = workspace?.settings.sidebarOpen ?? true;
  const consoleHeight = workspace?.settings.consoleHeight ?? 200;
  const zoom = workspace?.settings.zoom ?? 1;

  return (
    <div
      className="app-shell"
      style={{
        gridTemplateRows: `32px 1fr 4px ${consoleHeight}px`,
        gridTemplateColumns: sidebarOpen ? "220px 1fr" : "0px 1fr",
      }}
    >
      <Header onRun={onRun} onDownload={onDownload} onImport={onImport} />

      <CollapsibleSidebar open={sidebarOpen}>{sidebar}</CollapsibleSidebar>

      <main
        className="editor-pane min-h-0 overflow-hidden"
        style={
          {
            "--zoom-level": zoom,
          } as React.CSSProperties
        }
      >
        <div className="editor-container h-full w-full">{editor}</div>
      </main>

      <ResizableSplit
        consoleHeight={consoleHeight}
        onResize={(height) => updateSettings({ consoleHeight: height })}
      />

      <section className="console min-h-0 overflow-hidden" aria-label="Console output">
        {consolePanel}
      </section>
    </div>
  );
}
