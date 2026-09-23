"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { hasAccountSession, loadAccount } from "@/lib/account-client";
import {
  deleteCloudProject,
  listCloudProjects,
  loadCloudProject,
  type CloudProjectSummary,
} from "@/lib/cloud-client";
import {
  applyCloudProject,
  checkCloudRevision,
  cloudLinkFor,
  cloudSnapshot,
  disableCloudSync,
  makeLocalCopy,
  noteCloudDeleted,
  pushCloud,
  saveCurrentToCloud,
  startCloudAutosync,
  subscribeCloud,
  useLocalCloudVersion,
  useRemoteCloudVersion,
} from "@/lib/cloud-sync";
import { useAppStore } from "@/lib/store";

const STATUS_LABEL = {
  local: "Local",
  pending: "Saved locally",
  syncing: "Syncing",
  saved: "Cloud",
  error: "Sync error",
  conflict: "Conflict",
} as const;

export function CloudButton() {
  const workspace = useAppStore((s) => s.workspace);
  const setName = useAppStore((s) => s.setName);
  const cloud = useSyncExternalStore(subscribeCloud, cloudSnapshot, cloudSnapshot);
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [replaceId, setReplaceId] = useState<string | null>(null);

  useEffect(() => startCloudAutosync(), []);

  const link = workspace ? cloudLinkFor(workspace.id) : null;
  const linkedHere = Boolean(link);

  const refresh = async () => {
    if (!hasAccountSession()) {
      setSignedIn(false);
      setProjects([]);
      return;
    }
    const profile = await loadAccount().catch(() => null);
    setSignedIn(Boolean(profile));
    if (!profile) return;
    setProjects(await listCloudProjects());
    await checkCloudRevision();
  };

  useEffect(() => {
    if (!open) return;
    setError("");
    setReplaceId(null);
    void refresh().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Cloud storage is unavailable");
    });
  }, [open]);

  const run = async (action: () => Promise<void> | void) => {
    setError("");
    setPending(true);
    try {
      await action();
      if (hasAccountSession()) setProjects(await listCloudProjects());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cloud storage is unavailable");
    } finally {
      setPending(false);
    }
  };

  const openProject = (id: string) => {
    if (link?.projectId === id) return;
    if (!linkedHere) {
      setReplaceId(id);
      return;
    }
    void run(async () => {
      const synced = await pushCloud();
      if (!synced) throw new Error("Sync this project before opening another one.");
      applyCloudProject(await loadCloudProject(id));
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        className="px-2 text-[11px]"
        aria-label={`Cloud storage: ${STATUS_LABEL[cloud.status]}`}
        onClick={() => setOpen(true)}
      >
        <Cloud className="size-3.5" />
        {STATUS_LABEL[cloud.status]}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cloud projects</DialogTitle>
            <DialogDescription>
              {cloud.message || "This project stays in the browser until you save it to the cloud."}
            </DialogDescription>
          </DialogHeader>
          {workspace && (
            <Input
              aria-label="Project name"
              value={workspace.name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
          {!signedIn && (
            <p className="text-xs text-[var(--vscode-fg-muted)]">
              Sign in to save this project to the cloud. The editor keeps working without an account.
            </p>
          )}
          {signedIn && !linkedHere && (
            <Button type="button" disabled={pending} onClick={() => void run(saveCurrentToCloud)}>
              Save to Cloud
            </Button>
          )}
          {signedIn && linkedHere && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={() => void run(async () => { await pushCloud(); })}>
                Sync now
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={makeLocalCopy}>
                Make local copy
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={disableCloudSync}>
                Disable cloud sync
              </Button>
            </div>
          )}
          {cloud.status === "conflict" && (
            <div className="space-y-2 rounded-md border border-[var(--vscode-border)] p-2">
              <p className="text-xs">Cloud version changed on another device</p>
              <div className="flex gap-2">
                <Button type="button" disabled={pending} onClick={() => void run(useLocalCloudVersion)}>
                  Use local
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void run(useRemoteCloudVersion)}
                >
                  Use cloud
                </Button>
              </div>
            </div>
          )}
          {replaceId && (
            <div className="space-y-2 rounded-md border border-[var(--vscode-border)] p-2">
              <p className="text-xs">
                Opening a cloud project replaces the editor. Save this one to the cloud first if you
                want to keep it.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setReplaceId(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const id = replaceId;
                    setReplaceId(null);
                    void run(async () => applyCloudProject(await loadCloudProject(id)));
                  }}
                >
                  Replace editor
                </Button>
              </div>
            </div>
          )}
          {signedIn && projects.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-auto text-xs">
              {projects.map((project) => (
                <li key={project.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {project.name}
                    {link?.projectId === project.id ? " · open" : ""}
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className="underline" onClick={() => void openProject(project.id)}>
                      Open
                    </button>
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        void run(async () => {
                          await deleteCloudProject(project.id);
                          noteCloudDeleted(project.id);
                        })
                      }
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-xs text-[var(--console-error)]">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
