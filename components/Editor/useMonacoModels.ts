"use client";

import { useCallback, useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";
import { getMonacoLanguage } from "@/lib/db";

interface FileModel {
  uri: Monaco.Uri;
  model: Monaco.editor.ITextModel;
  viewState: Monaco.editor.ICodeEditorViewState | null;
}

export function useMonacoModels() {
  const models = useRef<Map<string, FileModel>>(new Map());
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const createModel = useCallback(
    (path: string, content: string) => {
      const monaco = (window as unknown as { monaco: typeof Monaco }).monaco;
      if (!monaco) return null;

      const existing = models.current.get(path);
      if (existing) return existing.model;

      const uri = monaco.Uri.parse(`inmemory:///${path}`);
      const model = monaco.editor.createModel(
        content,
        getMonacoLanguage(path),
        uri
      );

      models.current.set(path, { uri, model, viewState: null });
      return model;
    },
    []
  );

  const switchToModel = useCallback((path: string) => {
    const fileModel = models.current.get(path);
    const editor = editorRef.current;
    const monaco = (window as unknown as { monaco: typeof Monaco }).monaco;
    if (!fileModel || !editor || !monaco) return;

    const currentModel = editor.getModel();
    if (currentModel) {
      const currentPath = Array.from(models.current.entries()).find(
        ([, fm]) => fm.model === currentModel
      )?.[0];
      if (currentPath) {
        const currentFileModel = models.current.get(currentPath);
        if (currentFileModel) {
          currentFileModel.viewState = editor.saveViewState();
        }
      }
    }

    editor.setModel(fileModel.model);
    if (fileModel.viewState) {
      editor.restoreViewState(fileModel.viewState);
    }
    editor.focus();
  }, []);

  const updateModel = useCallback((path: string, content: string) => {
    const fileModel = models.current.get(path);
    if (fileModel && fileModel.model.getValue() !== content) {
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

  useEffect(() => {
    return () => {
      models.current.forEach((fm) => fm.model.dispose());
      models.current.clear();
    };
  }, []);

  return {
    editorRef,
    createModel,
    switchToModel,
    updateModel,
    disposeModel,
  };
}
