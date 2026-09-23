export interface FileProposal {
  id: string;
  path: string;
  kind: "edit" | "create" | "delete";
  before: string;
  after: string;
}

export interface AgentWorkspace {
  files: Record<string, string>;
  activeFile: string;
  consoleText: string;
}

const MAX_FILE_CHARS = 12_000;

function safePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/^\/+/, "");
  if (!path || path.length > 180 || path.includes("..") || path.includes("\\")) return null;
  return path;
}

function readArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function executeAgentTool(
  name: string,
  rawArguments: string,
  workspace: AgentWorkspace,
  proposals: FileProposal[]
): string {
  const args = readArgs(rawArguments);
  if (name === "list_files") {
    return Object.keys(workspace.files).sort().join("\n") || "(no files)";
  }
  if (name === "read_current_file") {
    const content = workspace.files[workspace.activeFile];
    if (content === undefined) return "No file is open.";
    return `${workspace.activeFile}\n${content.slice(0, MAX_FILE_CHARS)}`;
  }
  if (name === "get_console_output") {
    return workspace.consoleText.slice(-4_000) || "(console is empty)";
  }

  const path = safePath(args.path);
  if (!path) return "Invalid path.";

  if (name === "read_file") {
    const content = workspace.files[path];
    if (content === undefined) return `File not found: ${path}`;
    return content.slice(0, MAX_FILE_CHARS);
  }

  if (name === "delete_file") {
    if (workspace.files[path] === undefined) return `File not found: ${path}`;
    proposals.push({
      id: `${path}:delete:${proposals.length}`,
      path,
      kind: "delete",
      before: workspace.files[path],
      after: "",
    });
    return `Staged deletion of ${path}. The file is unchanged until the user applies it.`;
  }

  const content = typeof args.content === "string" ? args.content.slice(0, 24_000) : null;
  if (content === null) return "Missing content.";

  if (name === "create_file") {
    if (workspace.files[path] !== undefined) return `File already exists: ${path}`;
    proposals.push({
      id: `${path}:create:${proposals.length}`,
      path,
      kind: "create",
      before: "",
      after: content,
    });
    return `Staged new file ${path}. It is not created until the user applies it.`;
  }

  if (name === "propose_patch") {
    if (workspace.files[path] === undefined) return `File not found: ${path}`;
    proposals.push({
      id: `${path}:edit:${proposals.length}`,
      path,
      kind: "edit",
      before: workspace.files[path],
      after: content,
    });
    return `Staged a preview for ${path}. The file is unchanged until the user applies it.`;
  }

  return "Unknown tool.";
}
