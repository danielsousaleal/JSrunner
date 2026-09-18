"use client";

import { useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";
import {
  formatLivePreview,
  normalizeLivePath,
  type LiveCoverage,
  type LiveValue,
} from "@/lib/live-values";

function sameFile(left: string, right: string) {
  return normalizeLivePath(left) === normalizeLivePath(right);
}

export function useLiveDecorations(
  editor: Monaco.editor.IStandaloneCodeEditor | null,
  monacoApi: typeof Monaco | null,
  activeFile: string,
  values: LiveValue[],
  coverage: LiveCoverage[],
  enabled: boolean
) {
  const decorationIds = useRef<string[]>([]);
  const widgets = useRef<Monaco.editor.IContentWidget[]>([]);

  useEffect(() => {
    if (!editor || !monacoApi) return;
    const model = editor.getModel();
    if (!model) return;

    const clearWidgets = () => {
      for (const widget of widgets.current) {
        editor.removeContentWidget(widget);
      }
      widgets.current = [];
    };

    if (!enabled) {
      decorationIds.current = model.deltaDecorations(decorationIds.current, []);
      clearWidgets();
      return;
    }

    const lineCount = model.getLineCount();
    const fileValues = values.filter((value) => sameFile(value.file, activeFile));
    const fileCoverage = coverage.find((item) => sameFile(item.file, activeFile));
    const covered = new Set(
      fileCoverage?.covered ?? fileValues.map((value) => value.line)
    );
    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];

    clearWidgets();

    for (const value of fileValues) {
      if (value.line < 1 || value.line > lineCount) continue;

      const className =
        value.kind === "error"
          ? "quokka-inline-error"
          : value.kind === "log"
            ? "quokka-inline-log"
            : "quokka-inline-value";
      const color = value.kind === "error" ? "#f85149" : "#3fb950";
      const label = formatLivePreview(value);
      const line = value.line;
      const column = model.getLineMaxColumn(line);

      const node = document.createElement("span");
      node.className = className;
      node.textContent = label;
      node.title = value.full;
      node.style.fontSize = `${editor.getOption(monacoApi.editor.EditorOption.fontSize)}px`;
      node.style.fontFamily = editor.getOption(
        monacoApi.editor.EditorOption.fontFamily
      );
      node.style.lineHeight = `${editor.getOption(monacoApi.editor.EditorOption.lineHeight)}px`;
      node.style.fontStyle = "normal";
      node.style.fontWeight = "700";
      if (value.kind !== "error") {
        node.style.color = "#3d7ead";
      }

      const widget: Monaco.editor.IContentWidget = {
        allowEditorOverflow: true,
        getId: () => `js-runner-live-${line}`,
        getDomNode: () => node,
        getPosition: () => ({
          position: { lineNumber: line, column },
          preference: [monacoApi.editor.ContentWidgetPositionPreference.EXACT],
        }),
      };
      editor.addContentWidget(widget);
      widgets.current.push(widget);

      decorations.push({
        range: new monacoApi.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName:
            value.kind === "error" ? "quokka-gutter-error" : "quokka-gutter-covered",
          overviewRuler: {
            color,
            position: monacoApi.editor.OverviewRulerLane.Right,
          },
        },
      });
    }

    for (const line of fileCoverage?.instrumented ?? []) {
      if (
        line < 1 ||
        line > lineCount ||
        covered.has(line) ||
        fileValues.some((value) => value.line === line)
      ) {
        continue;
      }
      decorations.push({
        range: new monacoApi.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: "quokka-gutter-uncovered",
          overviewRuler: {
            color: "#f8514980",
            position: monacoApi.editor.OverviewRulerLane.Right,
          },
        },
      });
    }

    decorationIds.current = model.deltaDecorations(
      decorationIds.current,
      decorations
    );
  }, [editor, monacoApi, activeFile, values, coverage, enabled]);

  useEffect(() => {
    return () => {
      const model = editor?.getModel();
      if (model && decorationIds.current.length > 0) {
        model.deltaDecorations(decorationIds.current, []);
        decorationIds.current = [];
      }
      if (editor) {
        for (const widget of widgets.current) {
          editor.removeContentWidget(widget);
        }
        widgets.current = [];
      }
    };
  }, [editor]);
}
