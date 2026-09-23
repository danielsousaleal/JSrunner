import { openDB } from "idb";
import { authorizedAccount } from "./account-client";

const DB_NAME = "js-runner-byok";
const STORE = "keys";
const DEVICE_KEY = "groq";

let sessionKey: string | null = null;

export type ByokPlace = "session" | "device" | "account";

async function keyDatabase() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE);
      }
    },
  });
}

export function rememberSessionKey(apiKey: string | null): void {
  sessionKey = apiKey;
}

export function currentSessionKey(): string | null {
  return sessionKey;
}

export async function readDeviceKey(): Promise<string | null> {
  const database = await keyDatabase();
  const value = await database.get(STORE, DEVICE_KEY);
  return typeof value === "string" && value ? value : null;
}

export async function writeDeviceKey(apiKey: string | null): Promise<void> {
  const database = await keyDatabase();
  if (!apiKey) {
    await database.delete(STORE, DEVICE_KEY);
    return;
  }
  await database.put(STORE, apiKey, DEVICE_KEY);
}

async function keyError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message || "The key request failed.";
}

export async function validateGroqKey(apiKey: string): Promise<string> {
  const response = await authorizedAccount("/api/account/groq-key/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) throw new Error(await keyError(response));
  const body = (await response.json()) as { last4?: string };
  return body.last4 ?? apiKey.slice(-4);
}

export async function saveAccountGroqKey(apiKey: string): Promise<string> {
  const response = await authorizedAccount("/api/account/groq-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) throw new Error(await keyError(response));
  const body = (await response.json()) as { last4?: string };
  return body.last4 ?? apiKey.slice(-4);
}

export async function removeAccountGroqKey(): Promise<void> {
  const response = await authorizedAccount("/api/account/groq-key", { method: "DELETE" });
  if (!response.ok) throw new Error(await keyError(response));
}

export async function setProviderMode(providerMode: "platform" | "byok"): Promise<void> {
  const response = await authorizedAccount("/api/account/ai", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ providerMode }),
  });
  if (!response.ok) throw new Error(await keyError(response));
}
