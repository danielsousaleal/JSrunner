import { openDB, type IDBPDatabase } from "idb";
import { generateId } from "./utils";

export type Language =
  | "javascript"
  | "typescript"
  | "json"
  | "html"
  | "css";

export interface CursorPosition {
  line: number;
  column: number;
}

export interface FileContent {
  content: string;
  language: Language;
  cursor: CursorPosition;
  scrollPosition: number;
  dirty?: boolean;
}

export interface WorkspaceSettings {
  zoom: number;
  fontSize: number;
  tabSize: number;
  wordWrap: "on" | "off";
  minimap: boolean;
  autoSave: boolean;
  sidebarOpen: boolean;
  consoleHeight: number;
}

export type ConsoleEntryType =
  | "log"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "network"
  | "table"
  | "time"
  | "timeEnd"
  | "result";

export interface ConsoleMeta {
  url?: string;
  method?: string;
  status?: number;
  duration?: number;
  stack?: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

export interface ConsoleEntry {
  id: string;
  executionId: string;
  timestamp: number;
  type: ConsoleEntryType;
  message: string;
  meta?: ConsoleMeta;
}

export interface Workspace {
  version: 1;
  id: string;
  name: string;
  files: Record<string, FileContent>;
  activeFile: string;
  openTabs: string[];
  importMap: Record<string, string>;
  settings: WorkspaceSettings;
  consoleHistory: ConsoleEntry[];
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "js-runner-workspace";
const DB_VERSION = 1;
const STORE_NAME = "workspace";

let db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });

  return db;
}

export async function getWorkspace(): Promise<Workspace | null> {
  const database = await getDB();
  return (await database.get(STORE_NAME, "current")) ?? null;
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const database = await getDB();
  await database.put(STORE_NAME, workspace, "current");
}

export async function deleteWorkspace(): Promise<void> {
  const database = await getDB();
  await database.delete(STORE_NAME, "current");
}

export async function hasWorkspace(): Promise<boolean> {
  const database = await getDB();
  const count = await database.count(STORE_NAME);
  return count > 0;
}

export function getLanguageFromPath(path: string): Language {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    default:
      return "javascript";
  }
}

export function getMonacoLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    default:
      return "javascript";
  }
}

export const DEFAULT_FILE_CONTENT = `// Welcome to JS Runner! 🚀
//
// Click "Run" (▶) or press Ctrl+Enter to execute this code.
// Your output will appear in the console below.

function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));

// Try editing this file, then run again!
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Doubled:", doubled);
`;

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  zoom: 1,
  fontSize: 14,
  tabSize: 2,
  wordWrap: "on",
  minimap: false,
  autoSave: true,
  sidebarOpen: true,
  consoleHeight: 200,
};

export function createDefaultWorkspace(): Workspace {
  return {
    version: 1,
    id: generateId(),
    name: "My Project",
    files: {
      "index.ts": {
        content: DEFAULT_FILE_CONTENT,
        language: "typescript",
        cursor: { line: 0, column: 0 },
        scrollPosition: 0,
        dirty: false,
      },
    },
    activeFile: "index.ts",
    openTabs: ["index.ts"],
    importMap: {},
    settings: { ...DEFAULT_WORKSPACE_SETTINGS },
    consoleHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
