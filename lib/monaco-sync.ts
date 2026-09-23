interface MonacoModel {
  uri: { path: string };
  getValue: () => string;
  setValue: (value: string) => void;
  dispose: () => void;
}

function models(): MonacoModel[] {
  const monaco = (window as unknown as {
    monaco?: { editor: { getModels: () => MonacoModel[] } };
  }).monaco;
  return monaco?.editor.getModels() ?? [];
}

function matches(modelPath: string, filePath: string): boolean {
  const path = decodeURIComponent(modelPath).replace(/^\/+/, "");
  return path === filePath;
}

export function syncMonacoFile(path: string, content: string | null): void {
  for (const model of models()) {
    if (!matches(model.uri.path, path)) continue;
    if (content === null) {
      model.dispose();
      continue;
    }
    if (model.getValue() !== content) model.setValue(content);
  }
}
