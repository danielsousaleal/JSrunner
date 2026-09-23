"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
let choiceLocked = false;
const byokListeners = new Set<() => void>();

function emitByokView(next: ByokView, fromUser = false) {
  if (fromUser) choiceLocked = true;
  byokView = next;
  byokListeners.forEach((listener) => listener());
}

async function materialize(view: ByokView): Promise<ByokTransport> {
  if (view.provider !== "byok") return { provider: "platform" };
  if (view.place === "device") {
    const key = await readDeviceKey();
    if (key) return { provider: "byok", keySource: "request", apiKey: key };
  }
  if (view.place === "session") {
    const key = currentSessionKey();
    if (key) return { provider: "byok", keySource: "request", apiKey: key };
  }
  return { provider: "byok", keySource: "account" };
}

export async function transportForSend(): Promise<ByokTransport> {
  if (!choiceLocked) {
    const profile = await loadAccount().catch(() => null);
    if (profile && !choiceLocked) {
      const next: ByokView = { ...byokView };
      if (profile.groqKeyLast4) next.place = "account";
      if (profile.providerMode === "byok") next.provider = "byok";
      emitByokView(next);
    }
  }
  const choice = await materialize(byokView);
  publishByokTransport(choice);
  return choice;
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

export function ByokTransportSync({ signedIn }: { signedIn: boolean | null }) {
  const { provider, place } = useByokView();

  useEffect(() => {
    if (signedIn !== true || choiceLocked) return;
    let active = true;
    void loadAccount()
      .then((profile) => {
        if (!active || !profile || choiceLocked) return;
        const next: ByokView = { ...byokView };
        if (profile.groqKeyLast4) next.place = "account";
        if (profile.providerMode === "byok") next.provider = "byok";
        emitByokView(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (signedIn === false) {
      publishByokTransport({ provider: "platform" });
      return;
    }
    if (signedIn !== true) return;
    void materialize({ provider, place }).then(publishByokTransport);
  }, [signedIn, provider, place]);

  return null;
}

export function ByokControls({ signedIn }: { signedIn: boolean }) {
  const { provider, place } = useByokView();
  const setProvider = (next: ByokView["provider"]) =>
    emitByokView({ ...byokView, provider: next }, true);
  const setPlace = (next: ByokPlace) => emitByokView({ ...byokView, place: next }, true);
  const [draft, setDraft] = useState("");
  const [accountLast4, setAccountLast4] = useState<string | null>(null);
  const [deviceLast4, setDeviceLast4] = useState<string | null>(null);
  const [sessionLast4, setSessionLast4] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void Promise.all([loadAccount(), readDeviceKey()])
      .then(([profile, deviceKey]) => {
        if (!active) return;
        if (deviceKey) setDeviceLast4(deviceKey.slice(-4));
        if (profile?.groqKeyLast4) setAccountLast4(profile.groqKeyLast4);
        if (choiceLocked) return;
        const next: ByokView = { ...byokView };
        if (profile?.groqKeyLast4) next.place = "account";
        if (profile?.providerMode === "byok") next.provider = "byok";
        emitByokView(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [signedIn]);

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
            void setProviderMode("platform").catch((caught) => {
              setError(caught instanceof Error ? caught.message : "Could not switch to JSRunner AI");
            });
          }}
        >
          JSRunner AI
        </button>
        <button
          type="button"
          className={`rounded px-2 py-1 text-[11px] ${provider === "byok" ? "bg-[var(--vscode-blue)] text-white" : "text-[var(--vscode-fg-muted)]"}`}
          onClick={() => {
            emitByokView(
              {
                ...byokView,
                provider: "byok",
                place: accountLast4 ? "account" : byokView.place,
              },
              true
            );
            void setProviderMode("byok").catch((caught) => {
              setError(caught instanceof Error ? caught.message : "Could not switch to your key");
            });
          }}
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
