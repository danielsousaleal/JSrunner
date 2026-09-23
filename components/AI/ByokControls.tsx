"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { loadAccount } from "@/lib/account-client";
import {
  currentSessionKey,
  readDeviceKey,
  rememberSessionKey,
  removeAccountGroqKey,
  saveAccountGroqKey,
  setProviderMode,
  validateGroqKey,
  writeDeviceKey,
  type ByokPlace,
} from "@/lib/byok-client";

export interface ByokTransport {
  provider: "platform" | "byok";
  apiKey?: string;
  keySource?: "account" | "request";
}

interface ByokView {
  provider: "platform" | "byok";
  place: ByokPlace;
}

let byokView: ByokView = { provider: "platform", place: "session" };
let publishedTransport: ByokTransport = { provider: "platform" };
const byokListeners = new Set<() => void>();

function emitByokView(next: ByokView) {
  byokView = next;
  byokListeners.forEach((listener) => listener());
}

export function currentByokTransport(): ByokTransport {
  return publishedTransport;
}

function publishByokTransport(choice: ByokTransport) {
  publishedTransport = choice;
}

function useByokView(): ByokView {
  return useSyncExternalStore(
    (listener) => {
      byokListeners.add(listener);
      return () => byokListeners.delete(listener);
    },
    () => byokView,
    () => byokView
  );
}

export function ByokControls({
  signedIn,
  onTransport,
}: {
  signedIn: boolean;
  onTransport: (choice: ByokTransport) => void;
}) {
  const { provider, place } = useByokView();
  const setProvider = (next: ByokView["provider"]) => emitByokView({ ...byokView, provider: next });
  const setPlace = (next: ByokPlace) => emitByokView({ ...byokView, place: next });
  const [draft, setDraft] = useState("");
  const [accountLast4, setAccountLast4] = useState<string | null>(null);
  const [deviceLast4, setDeviceLast4] = useState<string | null>(null);
  const [sessionLast4, setSessionLast4] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const notify = useRef(onTransport);
  notify.current = onTransport;

  useEffect(() => {
    if (!signedIn) {
      notify.current({ provider: "platform" });
      return;
    }
    void Promise.all([loadAccount(), readDeviceKey()])
      .then(([profile, deviceKey]) => {
        if (deviceKey) setDeviceLast4(deviceKey.slice(-4));
        if (profile?.groqKeyLast4) {
          setAccountLast4(profile.groqKeyLast4);
          setPlace("account");
        }
        if (profile?.providerMode === "byok") setProvider("byok");
      })
      .catch(() => undefined);
  }, [signedIn]);

  useEffect(() => {
    if (provider === "platform") {
      publishByokTransport({ provider: "platform" });
      notify.current({ provider: "platform" });
      return;
    }
    if (place === "account") {
      const choice = { provider: "byok" as const, keySource: "account" as const };
      publishByokTransport(choice);
      notify.current(choice);
      return;
    }
    if (place === "device") {
      void readDeviceKey().then((key) => {
        const choice = { provider: "byok" as const, keySource: "request" as const, apiKey: key ?? undefined };
        publishByokTransport(choice);
        notify.current(choice);
      });
      return;
    }
    const choice = {
      provider: "byok" as const,
      keySource: "request" as const,
      apiKey: currentSessionKey() ?? undefined,
    };
    publishByokTransport(choice);
    notify.current(choice);
  }, [provider, place, sessionLast4, deviceLast4, accountLast4]);

  const activeLast4 =
    place === "session" ? sessionLast4 : place === "device" ? deviceLast4 : accountLast4;

  const save = async () => {
    const apiKey = draft.trim();
    if (!apiKey || pending) return;
    setError("");
    setNotice("");
    setPending(true);
    try {
      if (place === "account") {
        const last4 = await saveAccountGroqKey(apiKey);
        setAccountLast4(last4);
      } else {
        const last4 = await validateGroqKey(apiKey);
        if (place === "device") {
          await writeDeviceKey(apiKey);
          setDeviceLast4(last4);
        } else {
          rememberSessionKey(apiKey);
          setSessionLast4(last4);
        }
        await setProviderMode("byok");
      }
      setProvider("byok");
      setDraft("");
      setNotice("Valid API key");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid API key");
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    setError("");
    setPending(true);
    try {
      if (place === "account") {
        await removeAccountGroqKey();
        setAccountLast4(null);
      } else if (place === "device") {
        await writeDeviceKey(null);
        setDeviceLast4(null);
      } else {
        rememberSessionKey(null);
        setSessionLast4(null);
      }
      setProvider("platform");
      setNotice("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The key request failed.");
    } finally {
      setPending(false);
    }
  };

  if (!signedIn) return null;

  return (
    <div className="space-y-2 border-b border-[var(--vscode-border)] px-2 py-2">
      <div className="flex gap-1">
        <button
          type="button"
          className={`rounded px-2 py-1 text-[11px] ${provider === "platform" ? "bg-[var(--vscode-blue)] text-white" : "text-[var(--vscode-fg-muted)]"}`}
          onClick={() => {
            setProvider("platform");
            void setProviderMode("platform").catch(() => undefined);
          }}
        >
          JSRunner AI
        </button>
        <button
          type="button"
          className={`rounded px-2 py-1 text-[11px] ${provider === "byok" ? "bg-[var(--vscode-blue)] text-white" : "text-[var(--vscode-fg-muted)]"}`}
          onClick={() => setProvider("byok")}
        >
          My Groq key
        </button>
      </div>
      {provider === "byok" && (
        <>
          <p className="text-[11px] text-[var(--vscode-fg-muted)]">
            Using your Groq API key. JSRunner daily AI quota does not apply.
          </p>
          <div className="flex flex-col gap-1 text-[11px] text-[var(--vscode-fg-muted)]">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="byok-place"
                checked={place === "session"}
                onChange={() => setPlace("session")}
              />
              This session only. It disappears on reload.
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="byok-place"
                checked={place === "device"}
                onChange={() => setPlace("device")}
              />
              This browser only. It is not sent to your account.
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="byok-place"
                checked={place === "account"}
                onChange={() => setPlace("account")}
              />
              Save to account, encrypted. Usable on other devices.
            </label>
          </div>
          {activeLast4 && (
            <p className="text-[11px]">
              Saved key ending in {activeLast4}
              <button type="button" className="ml-2 underline" onClick={() => void remove()}>
                Remove
              </button>
            </p>
          )}
          <input
            type="password"
            autoComplete="off"
            value={draft}
            placeholder="Groq API key"
            className="w-full rounded-md border border-[var(--vscode-border)] bg-[var(--vscode-bg)] p-2 text-xs"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            className="text-[11px] underline disabled:opacity-50"
            onClick={() => void save()}
          >
            {pending ? "Checking" : "Check and save"}
          </button>
          {notice && <p className="text-[11px] text-[var(--vscode-fg-muted)]">{notice}</p>}
          {error && <p className="text-[11px] text-[var(--console-error)]">{error}</p>}
        </>
      )}
    </div>
  );
}
