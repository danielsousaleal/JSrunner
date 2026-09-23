import { publicEnv } from "./public-env";

const STORAGE_KEY = "jsrunner-account";

export interface AccountProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  role: string;
  aiEnabled: boolean;
  providerMode?: "platform" | "byok";
  groqKeyLast4?: string | null;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function apiUrl(path: string): string {
  const base = publicEnv.apiUrl.replace(/\/$/, "");
  if (!base) throw new Error("The account service URL is not configured");
  return `${base}${path}`;
}

function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession): StoredSession {
  const stored: StoredSession = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: Date.now() + Math.max(session.expiresIn, 60) * 1000,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export function clearAccountSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

async function parseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
  } | null;
  if (body?.error === "email_not_confirmed") {
    return "Confirm your email before signing in.";
  }
  return body?.message || "The account request failed.";
}

export async function authorizedAccount(
  path: string,
  init?: RequestInit
): Promise<Response> {
  let session = readSession();
  if (!session) throw new Error("Sign in required");
  if (session.expiresAt < Date.now() + 30_000) {
    const refreshed = await refreshAccount(session.refreshToken);
    session = writeSession(refreshed);
  }
  return fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${session.accessToken}`,
    },
  });
}

export async function loginAccount(
  email: string,
  password: string
): Promise<AccountProfile> {
  const response = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const session = (await response.json()) as AuthSession;
  writeSession(session);
  const profile = await loadAccount();
  if (!profile) throw new Error("Sign in required");
  return profile;
}

export async function registerAccount(
  email: string,
  password: string
): Promise<AccountProfile> {
  const response = await fetch(apiUrl("/api/auth/register"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return loginAccount(email, password);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(apiUrl("/api/auth/forgot-password"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error(await parseError(response));
}

async function refreshAccount(refreshToken: string): Promise<AuthSession> {
  const response = await fetch(apiUrl("/api/auth/refresh"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    clearAccountSession();
    throw new Error("Sign in again");
  }
  return (await response.json()) as AuthSession;
}

export async function loadAccount(): Promise<AccountProfile | null> {
  if (!readSession()) return null;
  const response = await authorizedAccount("/api/account");
  if (response.status === 401) {
    clearAccountSession();
    return null;
  }
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as AccountProfile;
}

export async function signOutAccount(): Promise<void> {
  const session = readSession();
  clearAccountSession();
  if (!session) return;
  await fetch(apiUrl("/api/auth/logout"), {
    method: "POST",
    headers: { authorization: `Bearer ${session.accessToken}` },
  }).catch(() => undefined);
}
