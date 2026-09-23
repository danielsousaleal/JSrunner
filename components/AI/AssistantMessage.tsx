import type { ReactNode } from "react";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const fence = /^```([\w.-]*)\s*$/.exec(line);
    if (fence) {
      const language = fence[1] ?? "";
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language, text: body.join("\n") });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+\.\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (index < lines.length) {
        const item = (ordered ? /^\d+\.\s+(.+)$/ : /^[-*]\s+(.+)$/).exec(lines[index] ?? "");
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() && !/^(```|#{1,3}\s|[-*]\s|\d+\.\s)/.test(lines[index] ?? "")) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function inlineText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-${index}`}
          className="rounded bg-[var(--vscode-bg)] px-1 font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<strong key={`${keyPrefix}-${index}`}>{token.slice(2, -2)}</strong>);
    }
    last = match.index + token.length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function AssistantMessage({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-2 text-xs leading-relaxed text-[var(--vscode-fg)]">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = block.level === 1 ? "h3" : "h4";
          return (
            <Tag key={index} className="font-medium text-[var(--vscode-fg)]">
              {inlineText(block.text, `h${index}`)}
            </Tag>
          );
        }
        if (block.type === "code") {
          return (
            <figure key={index} className="overflow-hidden rounded border border-[var(--vscode-border)]">
              {block.language && (
                <figcaption className="border-b border-[var(--vscode-border)] bg-[var(--vscode-bg)] px-2 py-1 text-[10px] text-[var(--vscode-fg-muted)]">
                  {block.language}
                </figcaption>
              )}
              <pre className="overflow-auto bg-[var(--vscode-bg)] p-2 font-mono text-[11px] leading-relaxed">
                <code>{block.text}</code>
              </pre>
            </figure>
          );
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={index}
              className={block.ordered ? "list-decimal space-y-1 pl-4" : "list-disc space-y-1 pl-4"}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inlineText(item, `li${index}-${itemIndex}`)}</li>
              ))}
            </Tag>
          );
        }
        return <p key={index}>{inlineText(block.text, `p${index}`)}</p>;
      })}
    </div>
  );
}
