"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantMessage } from "@/components/AI/AssistantMessage";
import { ByokControls, currentByokTransport } from "@/components/AI/ByokControls";
import { FileProposals } from "@/components/AI/FileProposals";
import { executeAgentTool, type FileProposal } from "@/lib/agent-tools";
import { getAiSettings, updateAiSettings, useAiSettings } from "@/lib/ai-settings";
import { streamAssistant, type AgentToolCall, type AssistantTurn } from "@/lib/ai-client";
import { loadAccount } from "@/lib/account-client";
import { syncMonacoFile } from "@/lib/monaco-sync";
import { useAppStore } from "@/lib/store";

interface Bubble {
  role: "user" | "assistant";
  content: string;
  display?: string;
}

export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const toggle = () => setOpen((current) => !current);
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.altKey || event.key.toLowerCase() !== "b") {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(".monaco-editor")) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("js-runner:toggle-ai", toggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("js-runner:toggle-ai", toggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!open) return null;

  return (
    <AssistantPanel
      width={width}
      onWidth={setWidth}
      onClose={() => setOpen(false)}
    />
  );
}

function AssistantPanel({
  width,
  onWidth,
  onClose,
}: {
  width: number;
  onWidth: (width: number) => void;
  onClose: () => void;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const aiSettings = useAiSettings();
  const [proposals, setProposals] = useState<FileProposal[]>([]);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<AssistantTurn[]>([]);

  useEffect(() => {
    void loadAccount()
      .then((profile) => setSignedIn(Boolean(profile)))
      .catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages]);

  const appendDelta = (delta: string) => {
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (!last || last.role !== "assistant") return current;
      next[next.length - 1] = { ...last, content: last.content + delta };
      return next;
    });
  };

  const send = async () => {
    const question = draft.trim();
    if (!question || pending) return;
    setError("");
    if (!signedIn) {
      setError("Sign in to use the assistant. The editor still runs without an account.");
      return;
    }

    const currentWorkspace = useAppStore.getState().workspace;
    const chunks: string[] = [];
    const mentions = [...question.matchAll(/@([\w./-]+)/g)].map((match) => match[1]);
    for (const path of mentions) {
      const file = currentWorkspace?.files[path];
      if (!file) continue;
      chunks.push(`@${path}\n${file.content.slice(0, 4_000)}`);
    }
    const ai = getAiSettings();
    if (ai.includeActiveFile && currentWorkspace?.activeFile && !mentions.includes(currentWorkspace.activeFile)) {
      const file = currentWorkspace.files[currentWorkspace.activeFile];
      if (file) chunks.unshift(`Active file ${currentWorkspace.activeFile}:\n${file.content.slice(0, 8_000)}`);
    }
    const content = chunks.length ? `${chunks.join("\n\n")}\n\n${question}` : question;

    historyRef.current = [...historyRef.current, { role: "user", content }];
    setMessages((current) => [
      ...current,
      { role: "user", content, display: question },
      { role: "assistant", content: "" },
    ]);
    setDraft("");
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for (let step = 0; step < (ai.agent ? 4 : 1); step += 1) {
        if (controller.signal.aborted) return;
        let assistantText = "";
        const calls = new Map<number, AgentToolCall>();
        await streamAssistant(
          historyRef.current,
          (delta) => {
            assistantText += delta;
            appendDelta(delta);
          },
          controller.signal,
          {
            ...currentByokTransport(),
            agent: ai.agent,
            temperature: ai.temperature,
            topP: ai.topP,
            reasoningEffort: ai.reasoningEffort,
            maxCompletionTokens: ai.maxCompletionTokens,
            onTool: (tool) => {
              const current = calls.get(tool.index) ?? { id: "", name: "", arguments: "" };
              if (tool.id) current.id = tool.id;
              if (tool.name) current.name = tool.name;
              if (tool.arguments) current.arguments += tool.arguments;
              calls.set(tool.index, current);
            },
          }
        );
        const finished = [...calls.values()].filter((call) => call.id && call.name);
        if (!ai.agent || finished.length === 0) {
          if (assistantText.trim()) {
            historyRef.current = [
              ...historyRef.current,
              { role: "assistant", content: assistantText },
            ];
          }
          break;
        }
        historyRef.current = [
          ...historyRef.current,
          { role: "assistant", content: assistantText, toolCalls: finished },
        ];
        const snapshot = useAppStore.getState().workspace;
        const files: Record<string, string> = {};
        for (const [path, file] of Object.entries(snapshot?.files ?? {})) {
          files[path] = file.content;
        }
        const staged: FileProposal[] = [];
        for (const call of finished) {
          const result = executeAgentTool(
            call.name,
            call.arguments,
            {
              files,
              activeFile: snapshot?.activeFile ?? "",
              consoleText: (snapshot?.consoleHistory ?? [])
                .slice(0, 20)
                .map((entry) => `${entry.type}: ${entry.message}`)
                .join("\n"),
            },
            staged
          );
          historyRef.current = [
            ...historyRef.current,
            { role: "tool", toolCallId: call.id, content: result },
          ];
        }
        if (staged.length) setProposals((current) => [...current, ...staged]);
        setMessages((current) => [...current, { role: "assistant", content: "" }]);
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : "The assistant is unavailable");
      }
    } finally {
      setMessages((current) => {
        const next = [...current];
        while (
          next.length > 0 &&
          next[next.length - 1]?.role === "assistant" &&
          !next[next.length - 1]?.content
        ) {
          next.pop();
        }
        return next;
      });
      setPending(false);
      abortRef.current = null;
    }
  };

  const applyProposal = (proposal: FileProposal) => {
    const store = useAppStore.getState();
    if (proposal.kind === "delete") {
      store.deleteFile(proposal.path);
      syncMonacoFile(proposal.path, null);
    } else if (!store.workspace?.files[proposal.path]) {
      store.addFile(proposal.path, proposal.after);
      syncMonacoFile(proposal.path, proposal.after);
      void useAppStore.getState().save();
    } else {
      store.updateFile(proposal.path, proposal.after);
      store.openTab(proposal.path);
      syncMonacoFile(proposal.path, proposal.after);
      void useAppStore.getState().save();
    }
    setProposals((current) => current.filter((item) => item.id !== proposal.id));
  };

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-[var(--vscode-border)] bg-[var(--vscode-bg-secondary)]"
      style={{ width }}
      aria-label="Assistant"
    >
      <div
        className="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize"
        onPointerDown={(event) => {
          const startX = event.clientX;
          const startWidth = width;
          const move = (ev: PointerEvent) => {
            onWidth(Math.min(520, Math.max(260, startWidth - (ev.clientX - startX))));
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      />
      <div className="flex h-8 items-center justify-between border-b border-[var(--vscode-border)] px-2">
        <span className="flex items-center gap-1 text-xs">
          <Sparkles className="size-3.5" />
          Assistant
        </span>
        <Button variant="ghost" size="icon-xs" aria-label="Close assistant" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>
      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
        {messages.length === 0 && (
          <p className="text-xs text-[var(--vscode-fg-muted)]">
            Ask about the code in the editor. Run still happens in your browser.
          </p>
        )}
        {messages.map((message, index) =>
          message.role === "user" ? (
            <p key={index} className="whitespace-pre-wrap text-xs">
              {message.display || message.content}
            </p>
          ) : (
            <div key={index}>
              {message.content ? (
                <AssistantMessage text={message.content} />
              ) : (
                pending && <p className="text-xs text-[var(--vscode-fg-muted)]">…</p>
              )}
            </div>
          )
        )}
      </div>
      <FileProposals
        proposals={proposals}
        onApply={applyProposal}
        onApplyAll={() => {
          for (const proposal of proposals) applyProposal(proposal);
        }}
        onReject={(proposal) =>
          setProposals((current) => current.filter((item) => item.id !== proposal.id))
        }
        onRejectAll={() => setProposals([])}
      />
      <ByokControls signedIn={signedIn === true} onTransport={() => undefined} />
      <form
        className="space-y-2 border-t border-[var(--vscode-border)] p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {signedIn === false && (
          <p className="text-xs text-[var(--vscode-fg-muted)]">
            Sign in to use the assistant. The editor still runs without an account.
          </p>
        )}
        {error && <p className="text-xs text-[var(--console-error)]">{error}</p>}
        <label className="flex items-center gap-2 text-[11px] text-[var(--vscode-fg-muted)]">
          <input
            type="checkbox"
            checked={aiSettings.includeActiveFile}
            onChange={(event) => updateAiSettings({ includeActiveFile: event.target.checked })}
          />
          Include active file
        </label>
        <label className="flex items-center gap-2 text-[11px] text-[var(--vscode-fg-muted)]">
          <input
            type="checkbox"
            checked={aiSettings.agent}
            onChange={(event) => updateAiSettings({ agent: event.target.checked })}
          />
          Agent. File changes stay as a preview until you Apply.
        </label>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask the assistant"
          rows={3}
          className="w-full resize-none rounded-md border border-[var(--vscode-border)] bg-[var(--vscode-bg)] p-2 text-xs"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending || !draft.trim()} className="flex-1">
            {pending ? "Please wait" : "Send"}
          </Button>
          {pending && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => abortRef.current?.abort()}
            >
              Stop
            </Button>
          )}
        </div>
      </form>
    </aside>
  );
}
