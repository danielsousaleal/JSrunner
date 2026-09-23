import { authorizedAccount } from "./account-client";
import type { Language, WorkspaceSettings } from "./db";

export interface CloudFile {
  path: string;
  language: Language;
  content: string;
}

export interface CloudProjectBody {
  name: string;
  activeFile: string;
  openTabs: string[];
  importMap: Record<string, string>;
  settings: WorkspaceSettings;
  files: CloudFile[];
}

export interface CloudProject extends CloudProjectBody {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudProjectSummary {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
}

export class CloudRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly revision?: number
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<CloudRequestError> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
    revision?: number;
  } | null;
  return new CloudRequestError(
    body?.message || "Cloud storage is unavailable",
    body?.error || "unavailable",
    response.status,
    typeof body?.revision === "number" ? body.revision : undefined
  );
}

export async function listCloudProjects(): Promise<CloudProjectSummary[]> {
  const response = await authorizedAccount("/api/cloud/projects");
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as { projects?: CloudProjectSummary[] };
  return body.projects ?? [];
}

export async function createCloudProject(project: CloudProjectBody): Promise<CloudProject> {
  const response = await authorizedAccount("/api/cloud/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as CloudProject;
}

export async function loadCloudProject(id: string): Promise<CloudProject> {
  const response = await authorizedAccount(`/api/cloud/projects/${id}`);
  if (!response.ok) throw await readError(response);
  return (await response.json()) as CloudProject;
}

export async function updateCloudProject(
  id: string,
  baseRevision: number,
  project: CloudProjectBody
): Promise<CloudProject> {
  const response = await authorizedAccount(`/api/cloud/projects/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...project, baseRevision }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as CloudProject;
}

export async function deleteCloudProject(id: string): Promise<void> {
  const response = await authorizedAccount(`/api/cloud/projects/${id}`, { method: "DELETE" });
  if (!response.ok) throw await readError(response);
}
