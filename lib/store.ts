import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_SETTINGS,
  getLanguageFromPath,
  getWorkspace,
  saveWorkspace,
  type ConsoleEntry,
  type FileContent,
  type Workspace,
  type WorkspaceSettings,
} from "./db";

interface AppStore {
  workspace: Workspace | null;
  initialized: boolean;
  isRunning: boolean;
  dirtyFiles: Set<string>;

  initialize: () => Promise<void>;
  save: () => Promise<void>;

  addFile: (path: string, content?: string) => void;
  updateFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  setActiveFile: (path: string) => void;
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  markFileClean: (path: string) => void;

  updateSettings: (settings: Partial<WorkspaceSettings>) => void;

  addConsoleEntry: (entry: ConsoleEntry) => void;
  clearConsole: () => void;
  setConsoleHistory: (entries: ConsoleEntry[]) => void;

  addPackage: (name: string, url: string) => void;
  removePackage: (name: string) => void;

  setRunning: (running: boolean) => void;
  replaceWorkspace: (workspace: Workspace) => void;
}

function updateWorkspace(
  workspace: Workspace,
  patch: Partial<Workspace>
): Workspace {
  return { ...workspace, ...patch, updatedAt: Date.now() };
}

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => ({
    workspace: null,
    initialized: false,
    isRunning: false,
    dirtyFiles: new Set(),

    initialize: async () => {
      try {
        const existing = await getWorkspace();
        if (existing) {
          set({
            workspace: {
              ...existing,
              openTabs: existing.openTabs ?? Object.keys(existing.files),
              importMap: existing.importMap ?? {},
              settings: {
                ...DEFAULT_WORKSPACE_SETTINGS,
                ...existing.settings,
              },
            },
            initialized: true,
          });
        } else {
          const defaultWorkspace = createDefaultWorkspace();
          await saveWorkspace(defaultWorkspace);
          set({ workspace: defaultWorkspace, initialized: true });
        }
      } catch {
        const defaultWorkspace = createDefaultWorkspace();
        set({ workspace: defaultWorkspace, initialized: true });
      }
    },

    save: async () => {
      const { workspace } = get();
      if (!workspace) return;

      const files = Object.fromEntries(
        Object.entries(workspace.files).map(([path, file]) => [
          path,
          { ...file, dirty: false },
        ])
      );

      const savedWorkspace = {
        ...workspace,
        files,
        updatedAt: Date.now(),
      };

      await saveWorkspace(savedWorkspace);
      set({ workspace: savedWorkspace, dirtyFiles: new Set() });
    },

    addFile: (path, content = "") => {
      const { workspace } = get();
      if (!workspace || workspace.files[path]) return;

      const file: FileContent ={
        content,
        language: getLanguageFromPath(path),
        cursor: { line: 0, column: 0 },
        scrollPosition: 0,
        dirty: false,
      };

      set({
        workspace: updateWorkspace(workspace, {
          files: { ...workspace.files, [path]: file },
          activeFile: path,
          openTabs: [...workspace.openTabs, path],
        }),
      });
    },

    updateFile: (path, content) => {
      const { workspace, dirtyFiles } = get();
      if (!workspace) return;
      const file = workspace.files[path];
      if (!file) return;

      const newDirty = new Set(dirtyFiles);
      newDirty.add(path);

      set({
        dirtyFiles: newDirty,
        workspace: updateWorkspace(workspace, {
          files: {
            ...workspace.files,
            [path]: { ...file, content, dirty: true },
          },
        }),
      });
    },

    deleteFile: (path) => {
      const { workspace, dirtyFiles } = get();
      if (!workspace) return;

      const { [path]: _, ...remainingFiles } = workspace.files;
      const openTabs = workspace.openTabs.filter((tab) => tab !== path);
      const activeFile =
        workspace.activeFile === path
          ? openTabs[0] ?? Object.keys(remainingFiles)[0] ?? ""
          : workspace.activeFile;

      const newDirty = new Set(dirtyFiles);
      newDirty.delete(path);

      set({
        dirtyFiles: newDirty,
        workspace: updateWorkspace(workspace, {
          files: remainingFiles,
          openTabs,
          activeFile,
        }),
      });

      void saveWorkspace(get().workspace!);
    },

    renameFile: (oldPath, newPath) => {
      const { workspace } = get();
      if (!workspace) return;
      const file = workspace.files[oldPath];
      if (!file) return;

      const { [oldPath]: _, ...remainingFiles } = workspace.files;

      set({
        workspace: updateWorkspace(workspace, {
          files: {
            ...remainingFiles,
            [newPath]: { ...file, language: getLanguageFromPath(newPath) },
          },
          activeFile:
            workspace.activeFile === oldPath ? newPath : workspace.activeFile,
          openTabs: workspace.openTabs.map((tab) =>
            tab === oldPath ? newPath : tab
          ),
        }),
      });

      void saveWorkspace(get().workspace!);
    },

    setActiveFile: (path) => {
      const { workspace } = get();
      if (!workspace || !workspace.files[path]) return;

      set({
        workspace: updateWorkspace(workspace, { activeFile: path }),
      });
    },

    openTab: (path) => {
      const { workspace } = get();
      if (!workspace || !workspace.files[path]) return;

      const openTabs = workspace.openTabs.includes(path)
        ? workspace.openTabs
        : [...workspace.openTabs, path];

      set({
        workspace: updateWorkspace(workspace, {
          activeFile: path,
          openTabs,
        }),
      });
    },

    closeTab: (path) => {
      const { workspace } = get();
      if (!workspace) return;

      const openTabs = workspace.openTabs.filter((tab) => tab !== path);
      const activeFile =
        workspace.activeFile === path
          ? openTabs[openTabs.length - 1] ?? ""
          : workspace.activeFile;

      set({
        workspace: updateWorkspace(workspace, { openTabs, activeFile }),
      });
    },

    markFileClean: (path) => {
      const { workspace, dirtyFiles } = get();
      if (!workspace) return;
      const file = workspace.files[path];
      if (!file) return;

      const newDirty = new Set(dirtyFiles);
      newDirty.delete(path);

      set({
        dirtyFiles: newDirty,
        workspace: updateWorkspace(workspace, {
          files: {
            ...workspace.files,
            [path]: { ...file, dirty: false },
          },
        }),
      });
    },

    updateSettings: (settings) => {
      const { workspace } = get();
      if (!workspace) return;

      set({
        workspace: updateWorkspace(workspace, {
          settings: { ...workspace.settings, ...settings },
        }),
      });
    },

    addConsoleEntry: (entry) => {
      const { workspace } = get();
      if (!workspace) return;

      const maxEntries = 1000;
      const consoleHistory = [entry, ...workspace.consoleHistory].slice(
        0,
        maxEntries
      );

      set({
        workspace: updateWorkspace(workspace, { consoleHistory }),
      });
    },

    clearConsole: () => {
      const { workspace } = get();
      if (!workspace) return;

      set({
        workspace: updateWorkspace(workspace, { consoleHistory: [] }),
      });
    },

    setConsoleHistory: (entries) => {
      const { workspace } = get();
      if (!workspace) return;

      set({
        workspace: updateWorkspace(workspace, { consoleHistory: entries }),
      });
    },

    addPackage: (name, url) => {
      const { workspace } = get();
      if (!workspace) return;

      set({
        workspace: updateWorkspace(workspace, {
          importMap: {
            ...workspace.importMap,
            [name]: url,
            [`${name}/`]: `${url}/`,
          },
        }),
      });

      void saveWorkspace(get().workspace!);
    },

    removePackage: (name) => {
      const { workspace } = get();
      if (!workspace) return;

      const { [name]: _, [`${name}/`]: __, ...remaining } =
        workspace.importMap;

      set({
        workspace: updateWorkspace(workspace, { importMap: remaining }),
      });

      void saveWorkspace(get().workspace!);
    },

    setRunning: (running) => set({ isRunning: running }),

    replaceWorkspace: (workspace) => {
      set({ workspace, dirtyFiles: new Set(), initialized: true });
    },
  }))
);

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

useAppStore.subscribe(
  (state) => state.workspace,
  (workspace) => {
    if (!workspace) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void saveWorkspace(workspace);
    }, 500);
  }
);
