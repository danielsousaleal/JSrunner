# Persistence - IndexedDB

## Overview

All workspace data is persisted locally using IndexedDB via the `idb` library. There is no backend - everything stays in the user's browser.

---

## Database Schema

### Database Name

```
js-runner-workspace
```

### Version

```
1
```

### Object Store

```
workspace
  Key: 'current'
  Value: Workspace (full state)
```

---

## TypeScript Types

```typescript
// lib/db.ts
export interface Workspace {
  version: 1;
  id: string;
  name: string;
  files: Record<string, FileContent>;
  activeFile: string;
  importMap: Record<string, string>;
  settings: WorkspaceSettings;
  consoleHistory: ConsoleEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface FileContent {
  content: string;
  language: Language;
  cursor: CursorPosition;
  scrollPosition: number;
}

export type Language = 
  | 'javascript' 
  | 'typescript' 
  | 'json' 
  | 'html' 
  | 'css';

export interface CursorPosition {
  line: number;
  column: number;
}

export interface WorkspaceSettings {
  zoom: number;
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  minimap: boolean;
  autoSave: boolean;
  sidebarOpen: boolean;
}

export interface ConsoleEntry {
  id: string;
  executionId: string;
  timestamp: number;
  type: ConsoleEntryType;
  message: string;
  meta?: ConsoleMeta;
}

export type ConsoleEntryType =
  | 'log'
  | 'error'
  | 'warn'
  | 'info'
  | 'debug'
  | 'network'
  | 'table'
  | 'time'
  | 'timeEnd'
  | 'result';

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
```

---

## Database Operations

### Initialization

```typescript
// lib/db.ts
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'js-runner-workspace';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';

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
```

### Read/Write

```typescript
// Get workspace
async function getWorkspace(): Promise<Workspace | null> {
  const db = await getDB();
  return db.get(STORE_NAME, 'current') || null;
}

// Save workspace
async function saveWorkspace(workspace: Workspace): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, workspace, 'current');
}

// Delete workspace
async function deleteWorkspace(): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, 'current');
}

// Check if workspace exists
async function hasWorkspace(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count(STORE_NAME);
  return count > 0;
}
```

---

## Zustand Store Integration

### Store Definition

```typescript
// lib/store.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  getWorkspace, 
  saveWorkspace, 
  type Workspace, 
  type FileContent,
  type ConsoleEntry 
} from './db';

interface AppStore {
  // Workspace
  workspace: Workspace | null;
  initialized: boolean;
  
  // File operations
  addFile: (path: string, content: string, language: string) => void;
  updateFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  setActiveFile: (path: string) => void;
  
  // Settings
  updateSettings: (settings: Partial<Workspace['settings']>) => void;
  
  // Console
  addConsoleEntry: (entry: ConsoleEntry) => void;
  clearConsole: () => void;
  
  // Import map
  addPackage: (name: string, url: string) => void;
  removePackage: (name: string) => void;
  
  // Persistence
  initialize: () => Promise<void>;
  save: () => Promise<void>;
}

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => ({
    workspace: null,
    initialized: false,
    
    addFile: (path, content, language) => {
      const { workspace } = get();
      if (!workspace) return;
      
      const newWorkspace = {
        ...workspace,
        files: {
          ...workspace.files,
          [path]: {
            content,
            language,
            cursor: { line: 0, column: 0 },
            scrollPosition: 0,
          },
        },
        updatedAt: Date.now(),
      };
      
      set({ workspace: newWorkspace });
    },
    
    updateFile: (path, content) => {
      const { workspace } = get();
      if (!workspace) return;
      
      const file = workspace.files[path];
      if (!file) return;
      
      const newWorkspace = {
        ...workspace,
        files: {
          ...workspace.files,
          [path]: { ...file, content },
        },
        updatedAt: Date.now(),
      };
      
      set({ workspace: newWorkspace });
    },
    
    deleteFile: (path) => {
      const { workspace } = get();
      if (!workspace) return;
      
      const { [path]: _, ...remainingFiles } = workspace.files;
      
      const newWorkspace = {
        ...workspace,
        files: remainingFiles,
        activeFile: workspace.activeFile === path 
          ? Object.keys(remainingFiles)[0] || '' 
          : workspace.activeFile,
        updatedAt: Date.now(),
      };
      
      set({ workspace: newWorkspace });
    },
    
    renameFile: (oldPath, newPath) => {
      const { workspace } = get();
      if (!workspace) return;
      
      const file = workspace.files[oldPath];
      if (!file) return;
      
      const { [oldPath]: _, ...remainingFiles } = workspace.files;
      
      const newWorkspace = {
        ...workspace,
        files: {
          ...remainingFiles,
          [newPath]: file,
        },
        activeFile: workspace.activeFile === oldPath ? newPath : workspace.activeFile,
        updatedAt: Date.now(),
      };
      
      set({ workspace: newWorkspace });
    },
    
    setActiveFile: (path) => {
      const { workspace } = get();
      if (!workspace) return;
      
      set({ 
        workspace: { 
          ...workspace, 
          activeFile: path,
          updatedAt: Date.now(),
        } 
      });
    },
    
    updateSettings: (settings) => {
      const { workspace } = get();
      if (!workspace) return;
      
      set({
        workspace: {
          ...workspace,
          settings: { ...workspace.settings, ...settings },
          updatedAt: Date.now(),
        },
      });
    },
    
    addConsoleEntry: (entry) => {
      const { workspace } = get();
      if (!workspace) return;
      
      const maxEntries = 1000;
      const newHistory = [entry, ...workspace.consoleHistory].slice(0, maxEntries);
      
      set({
        workspace: {
          ...workspace,
          consoleHistory: newHistory,
          updatedAt: Date.now(),
        },
      });
    },
    
    clearConsole: () => {
      const { workspace } = get();
      if (!workspace) return;
      
      set({
        workspace: {
          ...workspace,
          consoleHistory: [],
          updatedAt: Date.now(),
        },
      });
    },
    
    addPackage: (name, url) => {
      const { workspace } = get();
      if (!workspace) return;
      
      set({
        workspace: {
          ...workspace,
          importMap: {
            ...workspace.importMap,
            [name]: url,
            [`${name}/`]: `${url}/`,
          },
          updatedAt: Date.now(),
        },
      });
    },
    
    removePackage: (name) => {
      const { workspace } = get();
      if (!workspace) return;
      
      const { [name]: _, [`${name}/`]: __, ...remaining } = workspace.importMap;
      
      set({
        workspace: {
          ...workspace,
          importMap: remaining,
          updatedAt: Date.now(),
        },
      });
    },
    
    initialize: async () => {
      const existing = await getWorkspace();
      
      if (existing) {
        set({ workspace: existing, initialized: true });
      } else {
        // Create default workspace
        const defaultWorkspace: Workspace = {
          version: 1,
          id: crypto.randomUUID(),
          name: 'My Project',
          files: {
            'index.ts': {
              content: `// Welcome to JS Runner! 🚀\n// \n// Click "Run" (▶) or press Ctrl+Enter to execute this code.\n// Your output will appear in the console below.\n\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet("World"));\n\n// Try editing this file, then run again!\nconst numbers = [1, 2, 3, 4, 5];\nconst doubled = numbers.map(n => n * 2);\nconsole.log("Doubled:", doubled);`,
              language: 'typescript',
              cursor: { line: 0, column: 0 },
              scrollPosition: 0,
            },
          },
          activeFile: 'index.ts',
          importMap: {},
          settings: {
            zoom: 1,
            fontSize: 14,
            tabSize: 2,
            wordWrap: 'on',
            minimap: false,
            autoSave: true,
            sidebarOpen: true,
          },
          consoleHistory: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        await saveWorkspace(defaultWorkspace);
        set({ workspace: defaultWorkspace, initialized: true });
      }
    },
    
    save: async () => {
      const { workspace } = get();
      if (!workspace) return;
      
      await saveWorkspace(workspace);
    },
  }))
);
```

### Auto-save Middleware

```typescript
// lib/store.ts
import { subscribeWithSelector } from 'zustand/middleware';

// Subscribe to workspace changes and auto-save
const autoSave = (store: typeof useAppStore) => {
  let saveTimeout: NodeJS.Timeout | null = null;
  
  store.subscribe(
    (state) => state.workspace,
    (workspace) => {
      if (!workspace) return;
      
      // Debounce saves by 500ms
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      saveTimeout = setTimeout(() => {
        saveWorkspace(workspace);
      }, 500);
    }
  );
};

// Apply auto-save
autoSave(useAppStore);
```

---

## Import/Export

### Export Workspace

```typescript
// lib/export.ts
import { useAppStore } from './store';
import type { Workspace } from './db';

interface ExportData {
  exportVersion: 1;
  exportedAt: string;
  workspace: Omit<Workspace, 'consoleHistory'>;
}

export function exportWorkspace(): void {
  const { workspace } = useAppStore.getState();
  
  if (!workspace) {
    throw new Error('No workspace to export');
  }
  
  const exportData: ExportData = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    workspace: {
      ...workspace,
      consoleHistory: [], // Don't export console history
    },
  };
  
  const blob = new Blob(
    [JSON.stringify(exportData, null, 2)],
    { type: 'application/json' }
  );
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `js-runner-${workspace.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### Import Workspace

```typescript
// lib/import.ts
import { useAppStore } from './store';
import { saveWorkspace, type Workspace } from './db';

interface ImportData {
  exportVersion: number;
  exportedAt: string;
  workspace: Workspace;
}

function validateImport(data: unknown): data is ImportData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'exportVersion' in data &&
    (data as any).exportVersion === 1 &&
    'workspace' in data &&
    typeof (data as any).workspace === 'object' &&
    'files' in (data as any).workspace
  );
}

export async function importWorkspace(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!validateImport(data)) {
      throw new Error('Invalid workspace file format');
    }
    
    const workspace: Workspace = {
      ...data.workspace,
      id: crypto.randomUUID(), // Generate new ID
      consoleHistory: [], // Fresh console
      updatedAt: Date.now(),
    };
    
    await saveWorkspace(workspace);
    useAppStore.setState({ workspace });
    
    return true;
  } catch (error) {
    console.error('Import failed:', error);
    return false;
  }
}
```

---

## Storage Limits

| Data | Size Limit | Cleanup Strategy |
|------|------------|------------------|
| Workspace | ~50MB | Prompt user to export & clear |
| Console history | 1000 entries | FIFO (remove oldest) |
| Import map | ~100 packages | User manages |
| File content | ~5MB per file | Warn user on large files |

### Monitoring Usage

```typescript
async function getStorageUsage(): Promise<{
  used: number;
  quota: number;
  percentage: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const { usage, quota } = await navigator.storage.estimate();
    return {
      used: usage || 0,
      quota: quota || 0,
      percentage: usage && quota ? (usage / quota) * 100 : 0,
    };
  }
  
  return { used: 0, quota: 0, percentage: 0 };
}
```

---

## Data Migration

When the workspace version changes:

```typescript
async function migrateWorkspace(
  workspace: any
): Promise<Workspace> {
  // Version 0 → 1
  if (!workspace.version || workspace.version < 1) {
    return {
      version: 1,
      id: workspace.id || crypto.randomUUID(),
      name: workspace.name || 'My Project',
      files: workspace.files || {},
      activeFile: workspace.activeFile || 'index.ts',
      importMap: workspace.importMap || {},
      settings: {
        zoom: 1,
        fontSize: 14,
        tabSize: 2,
        wordWrap: 'on',
        minimap: false,
        autoSave: true,
        sidebarOpen: true,
      },
      consoleHistory: [],
      createdAt: workspace.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
  }
  
  return workspace;
}
```