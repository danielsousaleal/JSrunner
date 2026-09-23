"use client";

import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { ByokControls } from "@/components/AI/ByokControls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AI_SETTING_DEFAULTS,
  REASONING_EFFORTS,
  restoreAiSettings,
  updateAiSettings,
  useAiSettings,
} from "@/lib/ai-settings";
import { loadAccount } from "@/lib/account-client";

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const settings = useAiSettings();

  useEffect(() => {
    if (!open) return;
    void loadAccount()
      .then((profile) => setSignedIn(Boolean(profile)))
      .catch(() => setSignedIn(false));
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Settings"
        onClick={() => setOpen(true)}
      >
        <Settings className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Assistant options used for the next message. Streaming stays on.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={settings.includeActiveFile}
                onChange={(event) => updateAiSettings({ includeActiveFile: event.target.checked })}
              />
              Include the active file with each message
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={settings.agent}
                onChange={(event) => updateAiSettings({ agent: event.target.checked })}
              />
              Agent. File changes stay as a preview until you Apply.
            </label>
            <label className="block space-y-1 text-xs">
              <span className="flex justify-between">
                Temperature
                <span>{settings.temperature.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature}
                aria-label="Temperature"
                onChange={(event) => updateAiSettings({ temperature: Number(event.target.value) })}
              />
              <span className="block text-[11px] text-[var(--vscode-fg-muted)]">
                Lower stays closer to the code. Higher varies the wording. Default {AI_SETTING_DEFAULTS.temperature.toFixed(1)}.
              </span>
            </label>
            <label className="block space-y-1 text-xs">
              <span className="flex justify-between">
                Top p
                <span>{settings.topP.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.topP}
                aria-label="Top p"
                onChange={(event) => updateAiSettings({ topP: Number(event.target.value) })}
              />
              <span className="block text-[11px] text-[var(--vscode-fg-muted)]">
                Cuts off the least likely words. Default {AI_SETTING_DEFAULTS.topP.toFixed(2)}.
              </span>
            </label>
            <label className="block space-y-1 text-xs">
              Reasoning
              <select
                className="w-full rounded-md border border-[var(--vscode-border)] bg-[var(--vscode-bg)] p-2"
                value={settings.reasoningEffort}
                aria-label="Reasoning"
                onChange={(event) =>
                  updateAiSettings({
                    reasoningEffort: event.target.value as (typeof REASONING_EFFORTS)[number],
                  })
                }
              >
                {REASONING_EFFORTS.map((effort) => (
                  <option key={effort} value={effort}>
                    {effort}
                  </option>
                ))}
              </select>
              <span className="block text-[11px] text-[var(--vscode-fg-muted)]">
                How long the model thinks before answering. Default stays on the model default.
              </span>
            </label>
            <label className="block space-y-1 text-xs">
              Max completion tokens
              <input
                type="number"
                min={16}
                max={8192}
                step={1}
                value={settings.maxCompletionTokens}
                aria-label="Max completion tokens"
                className="w-full rounded-md border border-[var(--vscode-border)] bg-[var(--vscode-bg)] p-2"
                onChange={(event) =>
                  updateAiSettings({ maxCompletionTokens: Number(event.target.value) })
                }
              />
              <span className="block text-[11px] text-[var(--vscode-fg-muted)]">
                Upper bound for one reply. Your plan can still cap it lower.
              </span>
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => restoreAiSettings()}>
              Restore defaults
            </Button>
            {signedIn ? (
              <ByokControls signedIn onTransport={() => undefined} />
            ) : (
              <p className="text-xs text-[var(--vscode-fg-muted)]">
                Sign in to choose JSRunner AI or your own Groq key.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
