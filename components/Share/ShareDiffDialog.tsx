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
  pending,
  actionError,
  onConfirm,
  onSendBack,
  onDecline,
  onClose,
}: {
  share: CodeShareSummary;
  pending: boolean;
  actionError?: string;
  onConfirm?: () => void;
  onSendBack?: () => void;
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
        const local = files[share.localPath]?.content;
        setPrevious(share.awaiting && local !== undefined ? local : diff.previous);
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
  }, [share.id, share.localPath, share.awaiting]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{share.path}</DialogTitle>
          <DialogDescription>
            {share.awaiting
              ? `Review what changed. Confirm receipt to open it. Closing leaves the file waiting.`
              : `Review what changed. Send back uses the copy in your editor and updates this same file.`}
          </DialogDescription>
        </DialogHeader>
        {error || actionError ? (
          <p className="text-xs text-[var(--console-error)]">{error || actionError}</p>
        ) : null}
        {!error && (
          <div className="h-80 overflow-hidden rounded border border-[var(--vscode-border)]">
            {ready && (
              <DiffEditor
                theme="js-runner-dark"
                language={getMonacoLanguage(share.localPath)}
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
          <Button type="button" variant="outline" size="xs" onClick={onClose}>
            Close
          </Button>
          {onDecline && share.awaiting && (
            <Button type="button" variant="outline" size="xs" disabled={pending || !ready} onClick={onDecline}>
              Decline
            </Button>
          )}
          {onSendBack && (
            <Button type="button" variant="outline" size="xs" disabled={pending || !ready} onClick={onSendBack}>
              Send back
            </Button>
          )}
          {onConfirm && share.awaiting && (
            <Button type="button" size="xs" disabled={pending || !ready} onClick={onConfirm}>
              Confirm receipt
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
