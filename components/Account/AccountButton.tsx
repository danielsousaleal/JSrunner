"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  loadAccount,
  loginAccount,
  registerAccount,
  requestPasswordReset,
  signOutAccount,
  warmAccountService,
  type AccountProfile,
} from "@/lib/account-client";
import { ShareDiffDialog } from "@/components/Share/ShareDiffDialog";
import { availablePath, openReceivedFile } from "@/lib/receive-file";
import {
  acceptShare,
  declineShare,
  listShares,
  markSharesSeen,
  type CodeShareSummary,
} from "@/lib/share-client";
import { useAppStore } from "@/lib/store";

type Mode = "sign-in" | "register" | "forgot";

export function AccountButton() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("sign-in");
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [incoming, setIncoming] = useState<CodeShareSummary[]>([]);
  const [sent, setSent] = useState<CodeShareSummary[]>([]);
  const [shareError, setShareError] = useState("");
  const [review, setReview] = useState<{
    share: CodeShareSummary;
    role: "sender" | "recipient";
  } | null>(null);

  useEffect(() => {
    warmAccountService();
    void loadAccount()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!profile) {
      setIncoming([]);
      setSent([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void listShares()
        .then((next) => {
          if (!cancelled) {
            setIncoming(next.incoming);
            setSent(next.sent);
          }
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [profile]);

  useEffect(() => {
    if (!open || !sent.some((share) => share.unseen)) return;
    void markSharesSeen()
      .then(() => {
        setSent((current) => current.map((share) => ({ ...share, unseen: false })));
      })
      .catch(() => undefined);
  }, [open, sent]);

  const resetForm = () => {
    setError("");
    setNotice("");
    setPassword("");
  };

  const submit = async () => {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError("Use at least 8 characters in the password.");
      return;
    }
    setPending(true);
    try {
      if (mode === "forgot") {
        await requestPasswordReset(email.trim());
        setNotice("If an account exists for that email, a reset link is on the way.");
        return;
      }
      const next =
        mode === "register"
          ? await registerAccount(email.trim(), password)
          : await loginAccount(email.trim(), password);
      setProfile(next);
      setPassword("");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
    } finally {
      setPending(false);
    }
  };

  const openShare = async (share: CodeShareSummary) => {
    setShareError("");
    setPending(true);
    try {
      const files = useAppStore.getState().workspace?.files ?? {};
      const target =
        share.phase === "update" && share.openedPath
          ? share.openedPath
          : availablePath(files, share.path);
      const file = await acceptShare(share.id, share.phase === "update" ? undefined : target);
      openReceivedFile(file.path, file.content);
      setIncoming((current) => current.filter((item) => item.id !== share.id));
      setOpen(false);
    } catch (caught) {
      setShareError(caught instanceof Error ? caught.message : "Could not open the file.");
    } finally {
      setPending(false);
    }
  };

  const dismissShare = async (share: CodeShareSummary) => {
    setShareError("");
    setPending(true);
    try {
      await declineShare(share.id);
      setIncoming((current) => current.filter((item) => item.id !== share.id));
    } catch (caught) {
      setShareError(caught instanceof Error ? caught.message : "Could not decline the file.");
    } finally {
      setPending(false);
    }
  };

  const signOut = async () => {
    setPending(true);
    await signOutAccount();
    setProfile(null);
    setPending(false);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 max-w-36 px-2 text-xs"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        <UserRound className="size-3.5" />
        <span className="truncate">{profile?.username ?? "Sign in"}</span>
        {incoming.length + sent.filter((share) => share.unseen).length > 0 && (
          <span
            className="rounded-full bg-[var(--vscode-blue)] px-1.5 text-[10px] leading-4 text-white"
            aria-label={`${incoming.length + sent.filter((share) => share.unseen).length} share updates`}
          >
            {incoming.length + sent.filter((share) => share.unseen).length}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {profile
                ? "Account"
                : mode === "register"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Reset password"
                    : "Sign in"}
            </DialogTitle>
            <DialogDescription>
              The editor, local save, and Run keep working without an account.
            </DialogDescription>
          </DialogHeader>

          {profile ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--vscode-fg-muted)]">Incoming files</p>
                {incoming.length === 0 ? (
                  <p className="text-xs text-[var(--vscode-fg-muted)]">No files waiting.</p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-auto">
                    {incoming.map((share) => (
                      <div
                        key={share.id}
                        className="rounded border border-[var(--vscode-border)] p-2"
                      >
                        <p className="truncate text-sm">{share.path}</p>
                        <p className="text-xs text-[var(--vscode-fg-muted)]">
                          {share.phase === "update" ? "Update" : "File"} from {share.senderUsername}
                        </p>
                        {share.preview && (
                          <p className="truncate font-mono text-[11px] text-[var(--vscode-fg-muted)]">
                            {share.preview}
                          </p>
                        )}
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="xs"
                            disabled={pending}
                            onClick={() => setReview({ share, role: "recipient" })}
                          >
                            {share.phase === "update" ? "Review update" : "Review"}
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={pending}
                            onClick={() => void dismissShare(share)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {sent.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[var(--vscode-fg-muted)]">Sent files</p>
                    {sent.map((share) => (
                      <div key={share.id} className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-[var(--vscode-fg)]">
                          {share.path} · {share.recipientUsername} ·{" "}
                          {share.phase === "accepted"
                            ? "Opened"
                            : share.phase === "update"
                              ? "Update waiting"
                              : "Waiting"}
                        </p>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setReview({ share, role: "sender" })}
                        >
                          Diff
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {shareError && <p className="text-xs text-[var(--console-error)]">{shareError}</p>}
              </div>
              <p className="text-sm">
                <span className="text-[var(--vscode-fg-muted)]">Username </span>
                {profile.username}
              </p>
              <p className="truncate text-sm">
                <span className="text-[var(--vscode-fg-muted)]">Email </span>
                {profile.email}
              </p>
              <p className="text-sm capitalize">
                <span className="text-[var(--vscode-fg-muted)]">Plan </span>
                {profile.role}
              </p>
              <Button variant="outline" disabled={pending} onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <Input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {mode !== "forgot" && (
                <Input
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
              {error && <p className="text-xs text-[var(--console-error)]">{error}</p>}
              {notice && <p className="text-xs text-[var(--vscode-fg-muted)]">{notice}</p>}
              <Button type="submit" disabled={pending} className="w-full">
                {pending
                  ? "Please wait"
                  : mode === "register"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
              </Button>
              <div className="flex justify-between text-xs">
                <button
                  type="button"
                  className="text-[var(--vscode-fg-muted)] hover:text-[var(--vscode-fg)]"
                  onClick={() => {
                    resetForm();
                    setMode(mode === "register" ? "sign-in" : "register");
                  }}
                >
                  {mode === "register" ? "I already have an account" : "Create account"}
                </button>
                <button
                  type="button"
                  className="text-[var(--vscode-fg-muted)] hover:text-[var(--vscode-fg)]"
                  onClick={() => {
                    resetForm();
                    setMode(mode === "forgot" ? "sign-in" : "forgot");
                  }}
                >
                  {mode === "forgot" ? "Back to sign in" : "Forgot password"}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {review && (
        <ShareDiffDialog
          share={review.share}
          role={review.role}
          pending={pending}
          onClose={() => setReview(null)}
          onAccept={
            review.role === "recipient"
              ? () => {
                  const current = review.share;
                  setReview(null);
                  void openShare(current);
                }
              : undefined
          }
          onDecline={
            review.role === "recipient"
              ? () => {
                  const current = review.share;
                  setReview(null);
                  void dismissShare(current);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
