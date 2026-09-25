"use client";

import { useEffect, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMonacoLanguage } from "@/lib/db";
import { configureMonacoWorkers, initMonacoTheme } from "@/lib/monaco";
import { loadShareDiff, type CodeShareSummary } from "@/lib/share-client";
import { useAppStore } from "@/lib/store";

export function ShareDiffDialog({
  share,
  role,
  pending,
  onAccept,
  onDecline,
  onClose,
}: {
  share: CodeShareSummary;
  role: "sender" | "recipient";
  pending: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onClose: () => void;
}) {
  const [previous, setPrevious] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    configureMonacoWorkers();
    let cancelled = false;
    void loadShareDiff(share.id)
      .then((diff) => {
        if (cancelled) return;
        const files = useAppStore.getState().workspace?.files ?? {};
        const localPath = diff.openedPath ?? diff.path;
        const local = files[localPath]?.content;
        setPrevious(role === "recipient" && local !== undefined ? local : diff.previous);
        setNext(diff.next);
        setReady(true);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load the diff.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [share.id, role]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{share.path}</DialogTitle>
          <DialogDescription>
            {role === "recipient"
              ? `Review what ${share.senderUsername} changed before opening it.`
              : `This is what ${share.recipientUsername} will see before opening it.`}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-xs text-[var(--console-error)]">{error}</p>
        ) : (
          <div className="h-80 overflow-hidden rounded border border-[var(--vscode-border)]">
            {ready && (
              <DiffEditor
                theme="js-runner-dark"
                language={getMonacoLanguage(share.openedPath ?? share.path)}
                original={previous}
                modified={next}
                beforeMount={initMonacoTheme}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                }}
              />
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="xs" onClick={onClose}>
            Close
          </Button>
          {onDecline && (
            <Button variant="outline" size="xs" disabled={pending || !ready} onClick={onDecline}>
              Decline
            </Button>
          )}
          {onAccept && (
            <Button size="xs" disabled={pending || !ready} onClick={onAccept}>
              {share.phase === "update" ? "Update" : "Open"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
