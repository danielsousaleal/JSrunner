"use client";

import { ChevronRight, Copy } from "lucide-react";
import { useState } from "react";

function matches(value: unknown, key: string | null, term: string): boolean {
  if (!term) return false;
  const query = term.toLowerCase();
  if (key?.toLowerCase().includes(query)) return true;
  if (value === null || typeof value !== "object") {
    return String(value).toLowerCase().includes(query);
  }
  return Object.entries(value as Record<string, unknown>).some(([name, child]) =>
    matches(child, name, term)
  );
}

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-[#c9a227] px-0.5 text-white">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
}

function ValueText({ value, term }: { value: unknown; term: string }) {
  if (typeof value === "string") {
    return (
      <span className="text-[#ce9178]">
        "<Highlight text={value} term={term} />"
      </span>
    );
  }
  if (typeof value === "number") {
    return (
      <span className="text-[#b5cea8]">
        <Highlight text={String(value)} term={term} />
      </span>
    );
  }
  if (typeof value === "boolean") {
    return <span className="text-[#569cd6]">{String(value)}</span>;
  }
  return <span className="text-[var(--vscode-fg-muted)]">null</span>;
}

export function JsonTree({
  value,
  name = null,
  path = "$",
  depth = 0,
  isLast = true,
  term,
  expanded,
  onSelect,
  onCopy,
}: {
  value: unknown;
  name?: string | null;
  path?: string;
  depth?: number;
  isLast?: boolean;
  term: string;
  expanded: "auto" | "open" | "closed";
  onSelect: (path: string) => void;
  onCopy: (text: string) => void;
}) {
  const complex = value !== null && typeof value === "object";
  const list = Array.isArray(value);
  const entries = complex ? Object.entries(value as Record<string, unknown>) : [];
  const selfMatches = matches(value, name, term);
  const defaultOpen =
    expanded === "open" ||
    (expanded === "auto" && (depth < 2 || (Boolean(term) && selfMatches)));
  const [open, setOpen] = useState(defaultOpen);

  const keyLabel =
    name === null ? null : (
      <span className="text-[#9cdcfe]">
        "<Highlight text={name} term={term} />"
      </span>
    );

  return (
    <div className="font-mono text-[12px] leading-5">
      <div
        role="treeitem"
        aria-label={path}
        className="group flex items-start gap-1 rounded-sm px-1 hover:bg-[var(--vscode-bg-hover)]"
        onClick={() => onSelect(path)}
      >
        {complex ? (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            className="mt-0.5 text-[var(--vscode-fg-muted)]"
              onClick={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          >
            <ChevronRight className={`size-3.5 ${open ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1 break-all">
          {keyLabel}
          {keyLabel ? <span className="text-[var(--vscode-fg-muted)]">: </span> : null}
          {complex ? (
            <span className="text-[var(--vscode-fg-muted)]">
              {list ? "[" : "{"}
              <span className="ml-1 text-[10px]">
                {list ? `Array(${entries.length})` : `Object{${entries.length}}`}
              </span>
              {open ? "" : list ? "]" : "}"}
            </span>
          ) : (
            <ValueText value={value} term={term} />
          )}
          {!complex && !isLast ? <span className="text-[var(--vscode-fg-subtle)]">,</span> : null}
        </span>
        <button
          type="button"
          aria-label="Copy value"
          className="invisible mt-0.5 text-[var(--vscode-fg-muted)] group-hover:visible"
          onClick={(event) => {
            event.stopPropagation();
            onCopy(typeof value === "string" ? value : JSON.stringify(value, null, 2));
          }}
        >
          <Copy className="size-3" />
        </button>
      </div>
      {complex && open && (
        <div className="ml-3 border-l border-dashed border-[var(--vscode-border)] pl-2">
          {entries.map(([childName, child], index) => (
            <JsonTree
              key={`${childName}:${index}`}
              name={list ? null : childName}
              value={child}
              path={list ? `${path}[${childName}]` : `${path}.${childName}`}
              depth={depth + 1}
              isLast={index === entries.length - 1}
              term={term}
              expanded={expanded}
              onSelect={onSelect}
              onCopy={onCopy}
            />
          ))}
          <div className="text-[var(--vscode-fg-muted)]">
            {list ? "]" : "}"}
            {!isLast && <span className="text-[var(--vscode-fg-subtle)]">,</span>}
          </div>
        </div>
      )}
    </div>
  );
}
