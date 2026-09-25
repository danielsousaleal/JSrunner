import { authorizedAccount } from "./account-client";

export type SharePhase = "pending" | "accepted" | "update";

export interface CodeShareSummary {
  id: string;
  senderUsername: string;
  recipientUsername: string;
  path: string;
  openedPath: string | null;
  revision: number;
  phase: SharePhase;
  createdAt: string;
  updatedAt: string;
  preview: string;
  unseen: boolean;
}

export interface ShareMailbox {
  incoming: CodeShareSummary[];
  sent: CodeShareSummary[];
}

export interface ShareDiff {
  id: string;
  path: string;
  openedPath: string | null;
  phase: SharePhase;
  previous: string;
  next: string;
  role: "sender" | "recipient";
}

export interface CodeShareFile {
  id: string;
  senderUsername: string;
  path: string;
  content: string;
  update: boolean;
}

async function readError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return new Error(body?.message || "File sharing is unavailable");
}

export async function listShares(): Promise<ShareMailbox> {
  const response = await authorizedAccount("/api/shares");
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as Partial<ShareMailbox>;
  return { incoming: body.incoming ?? [], sent: body.sent ?? [] };
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

export async function loadShareDiff(id: string): Promise<ShareDiff> {
  const response = await authorizedAccount(`/api/shares/${id}`);
  if (!response.ok) throw await readError(response);
  return (await response.json()) as ShareDiff;
}

export async function acceptShare(id: string, openedPath?: string): Promise<CodeShareFile> {
  const response = await authorizedAccount(`/api/shares/${id}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(openedPath ? { openedPath } : {}),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as CodeShareFile;
}

export async function declineShare(id: string): Promise<void> {
  const response = await authorizedAccount(`/api/shares/${id}/decline`, { method: "POST" });
  if (!response.ok) throw await readError(response);
}

export async function markSharesSeen(): Promise<void> {
  const response = await authorizedAccount("/api/shares/seen", { method: "POST" });
  if (!response.ok) throw await readError(response);
}
