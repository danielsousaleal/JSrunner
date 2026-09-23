import { hasAccountSession } from "./account-client";
import {
  CloudRequestError,
  createCloudProject,
  loadCloudProject,
  updateCloudProject,
  type CloudProject,
  type CloudProjectBody,
} from "./cloud-client";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  saveWorkspace,
  type FileContent,
  type Workspace,
} from "./db";
import { syncMonacoWorkspace } from "./monaco-sync";
import { useAppStore } from "./store";
import { generateId } from "./utils";

const LINK_KEY = "jsrunner-cloud-link";

export type CloudStatus = "local" | "pending" | "syncing" | "saved" | "error" | "conflict";

export interface CloudLink {
  workspaceId: string;
  projectId: string;
  revision: number;
  name: string;
}

let link: CloudLink | null = null;
let status: CloudStatus = "local";
let message = "";
let conflictRevision: number | null = null;
let paused = false;
let uploaded = "";
let inflight = "";
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let checked = false;
const listeners = new Set<() => void>();
let snapshot: { link: CloudLink | null; status: CloudStatus; message: string } = {
  link: null,
  status: "local",
  message: "",
};

function emit(): void {
  snapshot = { link, status, message };
  listeners.forEach((listener) => listener());
}

function publish(next: CloudStatus, detail = ""): void {
  status = next;
  message = detail;
  emit();
}

export function cloudSnapshot(): { link: CloudLink | null; status: CloudStatus; message: string } {
  return snapshot;
}

export function subscribeCloud(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStoredLink(): CloudLink | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LINK_KEY) ?? "") as CloudLink;
    if (!parsed?.projectId || !parsed.workspaceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function cloudLinkFor(workspaceId: string): CloudLink | null {
  const current = link ?? readStoredLink();
  if (!current || current.workspaceId !== workspaceId) return null;
  return current;
}

function writeLink(next: CloudLink | null): void {
  link = next;
  if (typeof window !== "undefined") {
    if (next) window.localStorage.setItem(LINK_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(LINK_KEY);
  }
  emit();
}

export function projectBody(workspace: Workspace): CloudProjectBody {
  return {
    name: workspace.name.trim().slice(0, 80) || "Project",
    activeFile: workspace.activeFile,
    openTabs: workspace.openTabs,
    importMap: workspace.importMap,
    settings: workspace.settings,
    files: Object.entries(workspace.files).map(([path, file]) => ({
      path,
      language: file.language,
      content: file.content,
    })),
  };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)])
    );
  }
  return value;
}

export function fingerprint(workspace: Workspace): string {
  const body = projectBody(workspace);
  body.files = [...body.files].sort((left, right) => left.path.localeCompare(right.path));
  return JSON.stringify(stable(body));
}

function fingerprintProject(project: CloudProject): string {
  const body: CloudProjectBody = {
    name: project.name,
    activeFile: project.activeFile,
    openTabs: project.openTabs,
    importMap: project.importMap,
    settings: { ...DEFAULT_WORKSPACE_SETTINGS, ...project.settings },
    files: [...project.files].sort((left, right) => left.path.localeCompare(right.path)),
  };
  return JSON.stringify(stable(body));
}

function remember(project: CloudProject, workspaceId: string, workspace: Workspace): void {
  writeLink({
    workspaceId,
    projectId: project.id,
    revision: project.revision,
    name: project.name,
  });
  uploaded = fingerprint(workspace);
  paused = false;
  conflictRevision = null;
  publish("saved", "Saved to cloud");
}

export function applyCloudProject(project: CloudProject): void {
  const { workspace, replaceWorkspace } = useAppStore.getState();
  if (!workspace) return;
  const previous = Object.keys(workspace.files);
  const files: Record<string, FileContent> = {};
  for (const file of project.files) {
    files[file.path] = {
      content: file.content,
      language: file.language,
      cursor: { line: 0, column: 0 },
      scrollPosition: 0,
      dirty: false,
    };
  }
  const next: Workspace = {
    ...workspace,
    name: project.name,
    files,
    activeFile: project.activeFile,
    openTabs: project.openTabs.length > 0 ? project.openTabs : [project.activeFile],
    importMap: project.importMap,
    settings: { ...DEFAULT_WORKSPACE_SETTINGS, ...project.settings },
    updatedAt: Date.now(),
  };
  uploaded = fingerprint(next);
  replaceWorkspace(next);
  syncMonacoWorkspace(
    Object.fromEntries(project.files.map((file) => [file.path, file.content])),
    previous
  );
  void saveWorkspace(next);
  remember(project, next.id, next);
}

export async function saveCurrentToCloud(): Promise<void> {
  const workspace = useAppStore.getState().workspace;
  if (!workspace) return;
  if (!hasAccountSession()) throw new Error("Sign in required");
  publish("syncing", "Syncing");
  const project = await createCloudProject(projectBody(workspace));
  remember(project, workspace.id, workspace);
}

export async function pushCloud(): Promise<boolean> {
  const workspace = useAppStore.getState().workspace;
  const current = workspace ? cloudLinkFor(workspace.id) : null;
  if (!workspace || !current) return false;
  if (!hasAccountSession()) {
    paused = true;
    publish("error", "Sign in to sync");
    return false;
  }
  const mark = fingerprint(workspace);
  if (mark === uploaded || mark === inflight) {
    publish("saved", "Saved to cloud");
    return true;
  }
  inflight = mark;
  publish("syncing", "Syncing");
  try {
    await useAppStore.getState().save();
    const fresh = useAppStore.getState().workspace ?? workspace;
    const project = await updateCloudProject(current.projectId, current.revision, projectBody(fresh));
    remember(project, fresh.id, fresh);
    return true;
  } catch (error) {
    if (error instanceof CloudRequestError && error.code === "cloud_conflict" && error.revision) {
      paused = true;
      conflictRevision = error.revision;
      publish("conflict", "Cloud version changed on another device");
      return false;
    }
    paused = error instanceof Error && error.message === "Sign in required";
    publish("error", error instanceof Error ? error.message : "Sync error");
    return false;
  } finally {
    inflight = "";
  }
}

export async function useLocalCloudVersion(): Promise<void> {
  const workspace = useAppStore.getState().workspace;
  const current = workspace ? cloudLinkFor(workspace.id) : null;
  if (!workspace || !current || !conflictRevision) return;
  paused = false;
  const project = await updateCloudProject(
    current.projectId,
    conflictRevision,
    projectBody(workspace)
  );
  remember(project, workspace.id, workspace);
}

export async function useRemoteCloudVersion(): Promise<void> {
  const workspace = useAppStore.getState().workspace;
  const current = workspace ? cloudLinkFor(workspace.id) : null;
  if (!current) return;
  const project = await loadCloudProject(current.projectId);
  applyCloudProject(project);
}

export async function checkCloudRevision(): Promise<void> {
  const workspace = useAppStore.getState().workspace;
  const current = workspace ? cloudLinkFor(workspace.id) : null;
  if (!workspace || !current || !hasAccountSession() || paused) return;
  try {
    const project = await loadCloudProject(current.projectId);
    if (project.revision !== current.revision) {
      paused = true;
      conflictRevision = project.revision;
      publish("conflict", "Cloud version changed on another device");
      return;
    }
    const local = fingerprint(workspace);
    if (local === fingerprintProject(project)) {
      uploaded = local;
      publish("saved", "Saved to cloud");
      return;
    }
    uploaded = fingerprintProject(project);
    void pushCloud();
  } catch (error) {
    publish("error", error instanceof Error ? error.message : "Sync error");
  }
}

export function makeLocalCopy(): void {
  const { workspace, replaceWorkspace } = useAppStore.getState();
  if (!workspace) return;
  const next: Workspace = { ...workspace, id: generateId(), updatedAt: Date.now() };
  writeLink(null);
  uploaded = "";
  paused = false;
  conflictRevision = null;
  replaceWorkspace(next);
  void saveWorkspace(next);
  publish("local", "Local");
}

export function disableCloudSync(): void {
  writeLink(null);
  uploaded = "";
  paused = false;
  conflictRevision = null;
  publish("local", "Local");
}

export function noteCloudDeleted(projectId: string): void {
  if (link?.projectId === projectId) disableCloudSync();
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void pushCloud();
  }, 1500);
}

function watchWorkspace(workspace: Workspace | null): void {
  if (!workspace) return;
  const current = cloudLinkFor(workspace.id);
  if (!current) {
    checked = false;
    if (status !== "local") publish("local", "Local");
    return;
  }
  if (!checked) {
    checked = true;
    void checkCloudRevision();
    return;
  }
  if (paused) return;
  if (fingerprint(workspace) === uploaded) return;
  publish("pending", "Saved locally");
  schedule();
}

export function startCloudAutosync(): () => void {
  link = readStoredLink();
  if (started) return () => undefined;
  started = true;
  watchWorkspace(useAppStore.getState().workspace);
  const unsubscribe = useAppStore.subscribe(
    (state) => state.workspace,
    (workspace) => watchWorkspace(workspace)
  );
  return () => {
    unsubscribe();
    started = false;
    if (timer) clearTimeout(timer);
  };
}
