"use client";

import { DiffEditor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import type { FileProposal } from "@/lib/agent-tools";

function languageFor(path: string): string {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "javascript";
  return "typescript";
}

export function FileProposals({
  proposals,
  onApply,
  onApplyAll,
  onReject,
  onRejectAll,
}: {
  proposals: FileProposal[];
  onApply: (proposal: FileProposal) => void;
  onApplyAll: () => void;
  onReject: (proposal: FileProposal) => void;
  onRejectAll: () => void;
}) {
  if (proposals.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-[var(--vscode-border)] p-2">
      {proposals.length > 1 && (
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={onApplyAll}>
            Apply all
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onRejectAll}>
            Reject all
          </Button>
        </div>
      )}
      {proposals.map((proposal) => (
        <div key={proposal.id} className="space-y-1">
          <p className="text-[11px]">
            {proposal.kind === "delete"
              ? `Delete ${proposal.path}`
              : proposal.kind === "create"
                ? `Create ${proposal.path}`
                : `Edit ${proposal.path}`}
          </p>
          <div className="h-40 overflow-hidden rounded border border-[var(--vscode-border)]">
            <DiffEditor
              height="160px"
              original={proposal.before}
              modified={proposal.after}
              originalModelPath={`proposal/${proposal.id}/before`}
              modifiedModelPath={`proposal/${proposal.id}/after`}
              language={languageFor(proposal.path)}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                renderSideBySide: false,
                scrollBeyondLastLine: false,
              }}
            />
          </div>
          <div className="relative z-10 flex gap-2">
            <Button type="button" size="sm" onClick={() => onApply(proposal)}>
              Apply
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onReject(proposal)}>
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
