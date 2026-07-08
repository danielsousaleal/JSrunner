# Editor Integration - Monaco Editor

## Overview

Monaco Editor is the code editor that powers VS Code. We integrate it to provide a full-featured editing experience with syntax highlighting, IntelliSense, error diagnostics, and multi-file support.

---

## Package Choice

| Package | Pros | Cons |
|---------|------|------|
| `monaco-editor` (vanilla) | Full control, no wrapper overhead | Manual worker setup |
| `@monaco-editor/react` | Easy React integration, handles workers | CDN-based by default, larger bundle |
| `modern-monaco` | Lazy loading, no worker setup needed | Newer, less documentation |

**Decision**: `@monaco-editor/react` + manual worker hosting (not CDN)

---

## Installation

```bash
npm install @monaco-editor/react monaco-editor
```

---

## Worker Configuration

### The Problem

Monaco needs web workers for language services (TypeScript, CSS, HTML, JSON). By default, `@monaco-editor/react` loads these from a CDN, which:
- Fails behind strict CSP
- Adds network latency
- Breaks offline

### The Solution

Host workers on same origin and configure via `MonacoEnvironment`.

```typescript
// lib/monaco.ts
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';

export function configureMonacoWorkers() {
  self.MonacoEnvironment = {
    getWorker(_, label) {
      switch (label) {
        case 'typescript':
        case 'javascript':
          return new tsWorker();
        case 'json':
          return new jsonWorker();
        case 'css':
        case 'scss':
        case 'less':
          return new cssWorker();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new htmlWorker();
        default:
          return new editorWorker();
      }
    },
  };
}
```

---

## TypeScript Compiler Options

```typescript
// lib/monaco.ts
import * as monaco from 'monaco-editor';

export function configureTypeScript() {
  const tsDefaults = monaco.languages.typescript.typescriptDefaults;

  tsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    strict: true,
    esModuleInterop: true,
    allowJs: true,
    noEmit: true,
    allowSyntheticDefaultImports: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    baseUrl: '.',
    paths: {
      '*': ['*', 'https://esm.sh/*'],
    },
  });

  // Enable all diagnostics
  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });

  // Also configure JavaScript defaults
  const jsDefaults = monaco.languages.typescript.javascriptDefaults;
  jsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    allowJs: true,
    noEmit: true,
  });
}
```

---

## Theme Configuration

```typescript
// lib/monaco.ts
export function defineDarkTheme() {
  monaco.editor.defineTheme('js-runner-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // Custom syntax tokens
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'parameter', foreground: '9CDCFE' },
      { token: 'property', foreground: '9CDCFE' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'tag', foreground: '569CD6' },
      { token: 'attribute.name', foreground: '9CDCFE' },
      { token: 'attribute.value', foreground: 'CE9178' },
      { token: 'regexp', foreground: 'D16969' },
      { token: 'annotation', foreground: 'DCDCAA' },
    ],
    colors: {
      // Editor background
      'editor.background': '#1e1e1e',
      'editor.foreground': '#D4D4D4',
      
      // Line numbers
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#C6C6C6',
      
      // Selection
      'editor.selectionBackground': '#264F78',
      'editor.selectionHighlightBackground': '#ADD6FF26',
      
      // Cursor
      'editorCursor.foreground': '#AEAFAD',
      
      // Current line
      'editor.lineHighlightBackground': '#2A2D2E',
      
      // Indent guides
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
      
      // Bracket match
      'editorBracketMatch.background': '#0064001A',
      'editorBracketMatch.border': '#888888',
      
      // Bracket pair colorization
      'editorBracketHighlight.foreground1': '#FFD700',
      'editorBracketHighlight.foreground2': '#DA70D6',
      'editorBracketHighlight.foreground3': '#87CEEB',
      
      // Scrollbar
      'scrollbar.shadow': '#000000',
      'scrollbarSlider.background': '#797979AA',
      'scrollbarSlider.hoverBackground': '#646464BB',
      'scrollbarSlider.activeBackground': '#BFBFBFCC',
      
      // Minimap
      'minimap.background': '#1e1e1e',
      
      // Widgets
      'editorWidget.background': '#252526',
      'editorWidget.border': '#454545',
      
      // Suggest widget
      'editorSuggestWidget.background': '#252526',
      'editorSuggestWidget.border': '#454545',
      'editorSuggestWidget.selectedBackground': '#094771',
      
      // Hover widget
      'editorHoverWidget.background': '#252526',
      'editorHoverWidget.border': '#454545',
      
      // Error/Warning squiggles
      'editorError.foreground': '#F44747',
      'editorWarning.foreground': '#CCA700',
      'editorInfo.foreground': '#75BEFF',
      'editorHint.foreground': '#67D4FF',
    },
  });
}
```

---

## Dynamic Import (SSR Disable)

```typescript
// components/Editor/MonacoProvider.tsx
'use client';

import dynamic from 'next/dynamic';

const Editor = dynamic(
  () => import('@monaco-editor/react').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-[#d4d4d4]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#007acc] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading editor...</span>
        </div>
      </div>
    ),
  }
);

export default Editor;
```

---

## Multi-File Model Management

```typescript
// hooks/useMonacoModels.ts
import { useRef, useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';

interface FileModel {
  uri: monaco.Uri;
  model: monaco.editor.ITextModel;
  viewState: monaco.editor.ICodeEditorViewState | null;
}

export function useMonacoModels() {
  const models = useRef<Map<string, FileModel>>(new Map());
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const createModel = useCallback((path: string, content: string, language: string) => {
    const uri = monaco.Uri.parse(`inmemory:///${path}`);
    
    // Check if model already exists
    const existing = models.current.get(path);
    if (existing) {
      return existing.model;
    }

    const model = monaco.editor.createModel(content, language, uri);
    
    models.current.set(path, {
      uri,
      model,
      viewState: null,
    });

    return model;
  }, []);

  const switchToModel = useCallback((path: string) => {
    const fileModel = models.current.get(path);
    if (!fileModel || !editorRef.current) return;

    const editor = editorRef.current;
    
    // Save current view state
    const currentModel = editor.getModel();
    if (currentModel) {
      const currentPath = Array.from(models.current.entries())
        .find(([_, fm]) => fm.model === currentModel)?.[0];
      if (currentPath) {
        const currentFileModel = models.current.get(currentPath);
        if (currentFileModel) {
          currentFileModel.viewState = editor.saveViewState();
        }
      }
    }

    // Switch to new model
    editor.setModel(fileModel.model);
    
    // Restore view state
    if (fileModel.viewState) {
      editor.restoreViewState(fileModel.viewState);
    }
  }, []);

  const updateModel = useCallback((path: string, content: string) => {
    const fileModel = models.current.get(path);
    if (fileModel) {
      fileModel.model.setValue(content);
    }
  }, []);

  const disposeModel = useCallback((path: string) => {
    const fileModel = models.current.get(path);
    if (fileModel) {
      fileModel.model.dispose();
      models.current.delete(path);
    }
  }, []);

  const getModel = useCallback((path: string) => {
    return models.current.get(path)?.model;
  }, []);

  const getAllModels = useCallback(() => {
    return Array.from(models.current.entries()).map(([path, fm]) => ({
      path,
      model: fm.model,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      models.current.forEach(fm => fm.model.dispose());
      models.current.clear();
    };
  }, []);

  return {
    editorRef,
    createModel,
    switchToModel,
    updateModel,
    disposeModel,
    getModel,
    getAllModels,
  };
}
```

---

## Auto-typings (Package IntelliSense)

```typescript
// hooks/useAutoTypings.ts
import { useEffect, useRef } from 'react';
import { AutoTypings, LocalStorageCache } from 'monaco-editor-auto-typings';
import type { editor } from 'monaco-editor';

export function useAutoTypings(editorInstance: editor.IStandaloneCodeEditor | null) {
  const autoTypingsRef = useRef<AutoTypings | null>(null);

  useEffect(() => {
    if (!editorInstance) return;

    // Initialize auto-typings
    AutoTypings.create(editorInstance, {
      sourceCache: new LocalStorageCache(),
      // Only load types for detected imports
      preloadPackages: false,
      // Debounce type loading
      debounceDuration: 500,
    }).then(instance => {
      autoTypingsRef.current = instance;
    });

    return () => {
      autoTypingsRef.current?.dispose();
    };
  }, [editorInstance]);
}
```

---

## Editor Options

```typescript
// lib/monaco.ts
export const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  // Theme
  theme: 'js-runner-dark',
  
  // Layout
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  
  // Font
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  fontLigatures: true,
  lineHeight: 22,
  letterSpacing: 0.5,
  
  // Editing
  tabSize: 2,
  wordWrap: 'on',
  formatOnPaste: true,
  formatOnType: true,
  autoIndent: 'full',
  
  // Bracket handling
  bracketPairColorization: { enabled: true },
  guides: {
    bracketPairs: true,
    indentation: true,
  },
  
  // Cursor
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  cursorWidth: 2,
  
  // Line highlight
  renderLineHighlight: 'gutter',
  renderWhitespace: 'selection',
  
  // Scroll
  smoothScrolling: true,
  mouseWheelScrollSensitivity: 1,
  
  // Suggestions
  quickSuggestions: {
    other: true,
    comments: true,
    strings: true,
  },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on',
  tabCompletion: 'on',
  parameterHints: { enabled: true },
  
  // Multi-cursor
  multiCursorModifier: 'ctrlCmd',
  multiCursorPaste: 'full',
  
  // Accessibility
  accessibilitySupport: 'on',
  
  // Folding
  folding: true,
  foldingStrategy: 'auto',
  showFoldingControls: 'mouseover',
  
  // Word wrap
  wordWrapColumn: 80,
  wordWrapMinCharacters: 10,
  
  // Sticky scroll
  stickyScroll: { enabled: true },
};
```

---

## Keyboard Shortcuts

```typescript
// lib/monaco.ts
export function setupKeyboardShortcuts(editor: monaco.editor.IStandaloneCodeEditor) {
  // Run code: Ctrl+Enter
  editor.addAction({
    id: 'run-code',
    label: 'Run Code',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
    ],
    run: () => {
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('js-runner:run'));
    },
  });

  // Save: Ctrl+S
  editor.addAction({
    id: 'save-file',
    label: 'Save File',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    ],
    run: () => {
      window.dispatchEvent(new CustomEvent('js-runner:save'));
    },
  });

  // Toggle sidebar: Ctrl+Shift+E
  editor.addAction({
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
    ],
    run: () => {
      window.dispatchEvent(new CustomEvent('js-runner:toggle-sidebar'));
    },
  });

  // Focus console: Ctrl+Shift+C
  editor.addAction({
    id: 'focus-console',
    label: 'Focus Console',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC,
    ],
    run: () => {
      window.dispatchEvent(new CustomEvent('js-runner:focus-console'));
    },
  });
}
```

---

## Performance Optimization

| Concern | Solution |
|---------|----------|
| Large files (>1MB) | Monaco virtualized rendering handles this |
| Many open files | Only active model has view state |
| TypeScript worker | Lazy loaded on first .ts/.tsx file |
| Auto-typings | Debounced, cached in localStorage |
| Layout resize | `automaticLayout: true` with MutationObserver |
| Multiple editors | Single editor instance, swap models |

---

## Common Issues & Fixes

### "Could not create web worker"

```typescript
// Ensure MonacoEnvironment is set BEFORE editor creation
self.MonacoEnvironment = {
  getWorker: (_, label) => {
    // ... worker creation logic
  },
};

// Then create editor
const editor = monaco.editor.create(container, options);
```

### TypeScript not loading types

```typescript
// Add extra libs if needed
monaco.languages.typescript.typescriptDefaults.addExtraLib(
  `
  declare module 'my-package' {
    export function doSomething(): void;
  }
  `,
  'file:///node_modules/my-package/index.d.ts'
);
```

### Editor not resizing

```typescript
// Use ResizeObserver for reliable resizing
const observer = new ResizeObserver(() => {
  editor.layout();
});
observer.observe(container);

// Cleanup
observer.disconnect();
```