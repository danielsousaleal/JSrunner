import { authorizedAccount } from "./account-client";

export interface CodeShareSummary {
  id: string;
  senderUsername: string;
  path: string;
  createdAt: string;
  preview: string;
}

export interface CodeShareFile {
  id: string;
  senderUsername: string;
  path: string;
  content: string;
}

async function readError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return new Error(body?.message || "File sharing is unavailable");
}

export async function listShares(): Promise<CodeShareSummary[]> {
  const response = await authorizedAccount("/api/shares");
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as { shares?: CodeShareSummary[] };
  return body.shares ?? [];
}

export async function sendShare(input: {
  username: string;
  path: string;
  content: string;
}): Promise<CodeShareSummary> {
  const response = await authorizedAccount("/api/shares", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as CodeShareSummary;
}

export async function acceptShare(id: string): Promise<CodeShareFile> {
  const response = await authorizedAccount(`/api/shares/${id}/accept`, { method: "POST" });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as CodeShareFile;
}

export async function declineShare(id: string): Promise<void> {
  const response = await authorizedAccount(`/api/shares/${id}/decline`, { method: "POST" });
  if (!response.ok) throw await readError(response);
}
