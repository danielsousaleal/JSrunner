import { useSyncExternalStore } from "react";

export const REASONING_EFFORTS = ["none", "default", "low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export interface AiSettings {
  includeActiveFile: boolean;
  agent: boolean;
  temperature: number;
  topP: number;
  reasoningEffort: ReasoningEffort;
  maxCompletionTokens: number;
}

export const AI_SETTING_DEFAULTS: AiSettings = {
  includeActiveFile: false,
  agent: false,
  temperature: 0.6,
  topP: 0.95,
  reasoningEffort: "default",
  maxCompletionTokens: 2048,
};

const STORAGE_KEY = "jsrunner-ai-settings";

let current = readStored();
const listeners = new Set<() => void>();

function readStored(): AiSettings {
  if (typeof window === "undefined") return { ...AI_SETTING_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...AI_SETTING_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return sanitize(parsed);
  } catch {
    return { ...AI_SETTING_DEFAULTS };
  }
}

function sanitize(value: Partial<AiSettings>): AiSettings {
  const reasoning = REASONING_EFFORTS.includes(value.reasoningEffort as ReasoningEffort)
    ? (value.reasoningEffort as ReasoningEffort)
    : AI_SETTING_DEFAULTS.reasoningEffort;
  return {
    includeActiveFile: value.includeActiveFile === true,
    agent: value.agent === true,
    temperature: clamp(value.temperature, 0, 2, AI_SETTING_DEFAULTS.temperature),
    topP: clamp(value.topP, 0, 1, AI_SETTING_DEFAULTS.topP),
    reasoningEffort: reasoning,
    maxCompletionTokens: Math.round(
      clamp(value.maxCompletionTokens, 16, 8192, AI_SETTING_DEFAULTS.maxCompletionTokens)
    ),
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function emit(next: AiSettings) {
  current = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

export function getAiSettings(): AiSettings {
  return current;
}

export function updateAiSettings(patch: Partial<AiSettings>): void {
  emit(sanitize({ ...current, ...patch }));
}

export function restoreAiSettings(): void {
  emit({ ...AI_SETTING_DEFAULTS });
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getAiSettings,
    () => AI_SETTING_DEFAULTS
  );
}
