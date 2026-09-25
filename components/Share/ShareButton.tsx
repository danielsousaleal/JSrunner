"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { hasAccountSession } from "@/lib/account-client";
import { sendShare } from "@/lib/share-client";
import { useAppStore } from "@/lib/store";

export function ShareButton() {
  const workspace = useAppStore((state) => state.workspace);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const file = workspace?.activeFile ?? "";
  const signedIn = hasAccountSession();

  const send = async () => {
    setError("");
    setNotice("");
    const content = workspace?.files[file]?.content;
    if (!file || content === undefined) {
      setError("Open a file to send.");
      return;
    }
    if (!username.trim()) {
      setError("Enter the other account's username.");
      return;
    }
    setPending(true);
    try {
      const share = await sendShare({ username: username.trim(), path: file, content });
      const name = username.trim();
      if (share.phase === "update") {
        setNotice(`Update sent to ${name}. They can open it in the same file.`);
      } else if (share.phase === "accepted") {
        setNotice(`${name} already has this version.`);
      } else if (share.revision > 1) {
        setNotice(`Sent the latest ${file} to ${name}.`);
      } else {
        setNotice(`Sent ${file} to ${name}.`);
      }
      setUsername("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the file.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        className="px-2 text-[11px]"
        aria-label="Send the open file"
        title="Send the open file"
        disabled={!file}
        onClick={() => {
          setError("");
          setNotice("");
          setOpen(true);
        }}
      >
        <Share2 className="size-3.5" />
        Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send file</DialogTitle>
            <DialogDescription>
              {signedIn
                ? `${file || "This file"} goes to another account. Sending it again updates the copy they already opened.`
                : "Sign in to send this file to another account."}
            </DialogDescription>
          </DialogHeader>
          {signedIn && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <Input
                aria-label="Recipient username"
                placeholder="Username"
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              {error && <p className="text-xs text-[var(--console-error)]">{error}</p>}
              {notice && <p className="text-xs text-[var(--vscode-fg-muted)]">{notice}</p>}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Sending" : "Send"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
