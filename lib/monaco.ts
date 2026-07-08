import { loader } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

let configured = false;

export function configureMonacoWorkers() {
  if (typeof window === "undefined" || configured) return;

  loader.config({ paths: { vs: "/monaco/vs" } });
  configured = true;
}

export function configureTypeScript(monaco: typeof Monaco) {
  // Monaco marks the typescript namespace as deprecated in types but it remains available at runtime.
  const typescript = monaco.languages.typescript as unknown as {
    typescriptDefaults: {
      setCompilerOptions: (options: Record<string, unknown>) => void;
      setDiagnosticsOptions: (options: Record<string, unknown>) => void;
    };
    javascriptDefaults: {
      setCompilerOptions: (options: Record<string, unknown>) => void;
    };
    ScriptTarget: { ESNext: number };
    ModuleKind: { ESNext: number };
    ModuleResolutionKind: { NodeJs: number };
    JsxEmit: { ReactJSX: number };
  };

  const tsDefaults = typescript.typescriptDefaults;

  tsDefaults.setCompilerOptions({
    target: typescript.ScriptTarget.ESNext,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    jsx: typescript.JsxEmit.ReactJSX,
    strict: true,
    esModuleInterop: true,
    allowJs: true,
    noEmit: true,
    allowSyntheticDefaultImports: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    baseUrl: ".",
    paths: {
      "*": ["*", "https://esm.sh/*"],
    },
  });

  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });

  const jsDefaults = typescript.javascriptDefaults;
  jsDefaults.setCompilerOptions({
    target: typescript.ScriptTarget.ESNext,
    module: typescript.ModuleKind.ESNext,
    allowJs: true,
    noEmit: true,
  });
}

export function defineDarkTheme(monaco: typeof Monaco) {
  monaco.editor.defineTheme("js-runner-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
      { token: "keyword", foreground: "C586C0" },
      { token: "string", foreground: "CE9178" },
      { token: "number", foreground: "B5CEA8" },
      { token: "type", foreground: "4EC9B0" },
      { token: "function", foreground: "DCDCAA" },
      { token: "variable", foreground: "9CDCFE" },
      { token: "parameter", foreground: "9CDCFE" },
      { token: "property", foreground: "9CDCFE" },
      { token: "operator", foreground: "D4D4D4" },
      { token: "delimiter", foreground: "D4D4D4" },
      { token: "tag", foreground: "569CD6" },
      { token: "attribute.name", foreground: "9CDCFE" },
      { token: "attribute.value", foreground: "CE9178" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#D4D4D4",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#C6C6C6",
      "editor.selectionBackground": "#264F78",
      "editor.selectionHighlightBackground": "#ADD6FF26",
      "editorCursor.foreground": "#AEAFAD",
      "editor.lineHighlightBackground": "#2A2D2E",
      "editor.lineHighlightBorder": "#282828",
      "editorIndentGuide.background": "#404040",
      "editorIndentGuide.activeBackground": "#707070",
      "editorBracketMatch.background": "#0064001A",
      "editorBracketMatch.border": "#888888",
      "editorError.foreground": "#F44747",
      "editorWarning.foreground": "#CCA700",
      "editorInfo.foreground": "#75BEFF",
      "editorGutter.background": "#1e1e1e",
      "editorWidget.background": "#252526",
      "editorWidget.border": "#454545",
      "editorSuggestWidget.background": "#252526",
      "editorSuggestWidget.border": "#454545",
      "editorSuggestWidget.selectedBackground": "#094771",
      "editorHoverWidget.background": "#252526",
      "editorHoverWidget.border": "#454545",
      "scrollbar.shadow": "#000000",
      "scrollbarSlider.background": "#797979AA",
      "scrollbarSlider.hoverBackground": "#646464BB",
      "scrollbarSlider.activeBackground": "#BFBFBFCC",
      "minimap.background": "#1e1e1e",
    },
  });
}

export function initMonacoTheme(monaco: typeof Monaco) {
  configureTypeScript(monaco);
  defineDarkTheme(monaco);
  monaco.editor.setTheme("js-runner-dark");
}

export const editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions =
  {
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontLigatures: true,
    lineHeight: 22,
    letterSpacing: 0.5,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
    formatOnPaste: true,
    formatOnType: true,
    autoIndent: "full",
    // Auto-close brackets, quotes, and surround selections
    autoClosingBrackets: "always",
    autoClosingQuotes: "always",
    autoClosingOvertype: "always",
    autoSurround: "languageDefined",
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    renderLineHighlight: "gutter",
    smoothScrolling: true,
    // IntelliSense & snippets
    quickSuggestions: { other: true, comments: false, strings: true },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnCommitCharacter: true,
    acceptSuggestionOnEnter: "smart",
    tabCompletion: "on",
    snippetSuggestions: "top",
    wordBasedSuggestions: "matchingDocuments",
    parameterHints: { enabled: true },
    suggest: {
      showSnippets: true,
      preview: true,
      insertMode: "insert",
    },
    inlineSuggest: { enabled: true },
    multiCursorModifier: "ctrlCmd",
    accessibilitySupport: "on",
    folding: true,
    stickyScroll: { enabled: true },
    readOnly: false,
    domReadOnly: false,
  };

export function setupKeyboardShortcuts(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
) {
  editor.addAction({
    id: "run-code",
    label: "Run Code",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => {
      window.dispatchEvent(new CustomEvent("js-runner:run"));
    },
  });

  editor.addAction({
    id: "save-file",
    label: "Save File",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: () => {
      window.dispatchEvent(new CustomEvent("js-runner:save"));
    },
  });

  editor.addAction({
    id: "toggle-sidebar",
    label: "Toggle Sidebar",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
    ],
    run: () => {
      window.dispatchEvent(new CustomEvent("js-runner:toggle-sidebar"));
    },
  });

  editor.addAction({
    id: "focus-console",
    label: "Focus Console",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC,
    ],
    run: () => {
      window.dispatchEvent(new CustomEvent("js-runner:focus-console"));
    },
  });
}
