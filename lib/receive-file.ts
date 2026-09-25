import { syncMonacoFile } from "./monaco-sync";
import { useAppStore } from "./store";

export function availablePath(files: Record<string, unknown>, path: string): string {
  if (!files[path]) return path;
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let count = 2;
  while (files[`${dir}${base}-${count}${ext}`]) count += 1;
  return `${dir}${base}-${count}${ext}`;
}

export function openReceivedFile(path: string, content: string): string {
  const { workspace, addFile, save } = useAppStore.getState();
  if (!workspace) throw new Error("The editor is still loading");
  const target = availablePath(workspace.files, path);
  addFile(target, content);
  syncMonacoFile(target, content);
  window.setTimeout(() => syncMonacoFile(target, content), 0);
  void save();
  return target;
}
