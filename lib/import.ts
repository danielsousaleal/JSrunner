import { saveWorkspace, type Workspace } from "./db";
import { generateId } from "./utils";

interface ImportData {
  exportVersion: number;
  exportedAt: string;
  workspace: Workspace;
}

function validateImport(data: unknown): data is ImportData {
  return (
    typeof data === "object" &&
    data !== null &&
    "exportVersion" in data &&
    (data as ImportData).exportVersion === 1 &&
    "workspace" in data &&
    typeof (data as ImportData).workspace === "object" &&
    "files" in (data as ImportData).workspace
  );
}

export async function importWorkspaceFromFile(
  file: File
): Promise<Workspace | null> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;

    if (!validateImport(data)) {
      throw new Error("Invalid workspace file format");
    }

    const workspace: Workspace = {
      ...data.workspace,
      version: 1,
      id: generateId(),
      consoleHistory: [],
      openTabs: data.workspace.openTabs ?? Object.keys(data.workspace.files),
      importMap: data.workspace.importMap ?? {},
      updatedAt: Date.now(),
    };

    await saveWorkspace(workspace);
    return workspace;
  } catch {
    return null;
  }
}
