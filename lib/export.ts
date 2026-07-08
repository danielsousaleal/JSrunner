import type { Workspace } from "./db";

interface ExportData {
  exportVersion: 1;
  exportedAt: string;
  workspace: Omit<Workspace, "consoleHistory">;
}

export function exportWorkspace(workspace: Workspace): void {
  const { consoleHistory: _, ...workspaceWithoutConsole } = workspace;

  const exportData: ExportData = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    workspace: workspaceWithoutConsole,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `js-runner-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
