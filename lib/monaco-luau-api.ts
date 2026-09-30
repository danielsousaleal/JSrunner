import type * as Monaco from "monaco-editor";

type ApiItem = {
  label: string;
  kind: "function" | "method" | "property" | "constant";
  detail: string;
  documentation: string;
  insertText: string;
  snippet?: boolean;
};

const GLOBALS: ApiItem[] = [
  {
    label: "Vector3",
    kind: "constant",
    detail: "Vector3",
    documentation: "3D vector. Construct with Vector3.new(x, y, z).",
    insertText: "Vector3",
  },
  {
    label: "CFrame",
    kind: "constant",
    detail: "CFrame",
    documentation: "Position and rotation. Construct with CFrame.new or CFrame.lookAt.",
    insertText: "CFrame",
  },
  {
    label: "Color3",
    kind: "constant",
    detail: "Color3",
    documentation: "RGB color. Components are in the 0–1 range. Use Color3.fromRGB for 0–255.",
    insertText: "Color3",
  },
  {
    label: "Instance",
    kind: "constant",
    detail: "Instance",
    documentation: 'Instance.new("Folder") creates a folder. Other class names are not available.',
    insertText: "Instance",
  },
  {
    label: "game",
    kind: "constant",
    detail: "DataModel",
    documentation: 'DataModel. game:GetService("Workspace") returns workspace. Other services are not available.',
    insertText: "game",
  },
  {
    label: "workspace",
    kind: "constant",
    detail: "Workspace",
    documentation: "The Workspace instance. Parent folders to it with folder.Parent = workspace.",
    insertText: "workspace",
  },
  {
    label: "require",
    kind: "function",
    detail: "(path: string) -> ...any",
    documentation: 'Loads another .luau or .lua file in this project, for example require("./other").',
    insertText: 'require("${1:./other}")',
    snippet: true,
  },
  {
    label: "print",
    kind: "function",
    detail: "(...any) -> ()",
    documentation: "Prints values to the console.",
    insertText: "print(${1})",
    snippet: true,
  },
  {
    label: "warn",
    kind: "function",
    detail: "(...any) -> ()",
    documentation: "Prints a warning to the console.",
    insertText: "warn(${1})",
    snippet: true,
  },
];

const STATIC_MEMBERS: Record<string, ApiItem[]> = {
  Vector3: [
    item("new", "function", "(x: number?, y: number?, z: number?) -> Vector3", "Creates a vector. Missing components are 0.", "new(${1:0}, ${2:0}, ${3:0})", true),
    item("is", "function", "(value: any) -> boolean", "True when the value was created by Vector3.new. typeof still reports table.", "is(${1:value})", true),
    item("zero", "constant", "Vector3", "Vector3.new(0, 0, 0).", "zero"),
    item("one", "constant", "Vector3", "Vector3.new(1, 1, 1).", "one"),
    item("xAxis", "constant", "Vector3", "Vector3.new(1, 0, 0).", "xAxis"),
    item("yAxis", "constant", "Vector3", "Vector3.new(0, 1, 0).", "yAxis"),
    item("zAxis", "constant", "Vector3", "Vector3.new(0, 0, 1).", "zAxis"),
  ],
  CFrame: [
    item("new", "function", "(x: number?, y: number?, z: number?) -> CFrame", "Identity, a translation, a position plus look target, or the 12 components.", "new(${1:0}, ${2:0}, ${3:0})", true),
    item("is", "function", "(value: any) -> boolean", "True when the value is a CFrame. typeof still reports table.", "is(${1:value})", true),
    item("lookAt", "function", "(position: Vector3, target: Vector3, up: Vector3?) -> CFrame", "Looks from position toward target.", "lookAt(${1:position}, ${2:target})", true),
    item("Angles", "function", "(rx: number, ry: number, rz: number) -> CFrame", "Rotation in radians, applied in X, Y, Z order.", "Angles(${1:0}, ${2:0}, ${3:0})", true),
    item("identity", "constant", "CFrame", "The identity CFrame.", "identity"),
  ],
  Color3: [
    item("new", "function", "(r: number?, g: number?, b: number?) -> Color3", "Components are in the 0–1 range.", "new(${1:1}, ${2:1}, ${3:1})", true),
    item("is", "function", "(value: any) -> boolean", "True when the value is a Color3. typeof still reports table.", "is(${1:value})", true),
    item("fromRGB", "function", "(r: number, g: number, b: number) -> Color3", "Components are in the 0–255 range.", "fromRGB(${1:255}, ${2:255}, ${3:255})", true),
    item("fromHSV", "function", "(h: number, s: number, v: number) -> Color3", "Hue, saturation, and value are in the 0–1 range.", "fromHSV(${1:0}, ${2:1}, ${3:1})", true),
  ],
  Instance: [
    item("new", "function", '(className: "Folder", parent: Instance?) -> Folder', "Only Folder can be created.", 'new("Folder"${1})', true),
    item("is", "function", "(value: any) -> boolean", "True when the value is an Instance. typeof still reports table.", "is(${1:value})", true),
  ],
  game: [
    item("Workspace", "property", "Workspace", "The same instance as the workspace global.", "Workspace"),
    item("Name", "property", "string", 'The name "Game".', "Name"),
    item("ClassName", "property", "string", 'The class name "DataModel".', "ClassName"),
  ],
  workspace: instanceProperties("Workspace"),
};

const METHODS: Record<string, ApiItem[]> = {
  Vector3: [
    item("Dot", "method", "(other: Vector3) -> number", "Dot product.", "Dot(${1:other})", true),
    item("Cross", "method", "(other: Vector3) -> Vector3", "Cross product.", "Cross(${1:other})", true),
    item("Lerp", "method", "(other: Vector3, alpha: number) -> Vector3", "Linear interpolation.", "Lerp(${1:other}, ${2:0.5})", true),
    item("FuzzyEq", "method", "(other: Vector3, epsilon: number?) -> boolean", "Component comparison. The default epsilon is 1e-5.", "FuzzyEq(${1:other})", true),
  ],
  CFrame: [
    item("Inverse", "method", "() -> CFrame", "Inverse transform.", "Inverse()"),
    item("Lerp", "method", "(other: CFrame, alpha: number) -> CFrame", "Interpolates position and rotation.", "Lerp(${1:other}, ${2:0.5})", true),
    item("ToWorldSpace", "method", "(other: CFrame) -> CFrame", "Same as self * other.", "ToWorldSpace(${1:other})", true),
    item("ToObjectSpace", "method", "(other: CFrame) -> CFrame", "Expresses other relative to this CFrame.", "ToObjectSpace(${1:other})", true),
    item("PointToWorldSpace", "method", "(point: Vector3) -> Vector3", "Same as self * point.", "PointToWorldSpace(${1:point})", true),
    item("PointToObjectSpace", "method", "(point: Vector3) -> Vector3", "Transforms a world point into this CFrame.", "PointToObjectSpace(${1:point})", true),
  ],
  Color3: [
    item("Lerp", "method", "(other: Color3, alpha: number) -> Color3", "Linear interpolation.", "Lerp(${1:other}, ${2:0.5})", true),
    item("ToHSV", "method", "() -> (number, number, number)", "Returns hue, saturation, and value.", "ToHSV()"),
  ],
  Instance: instanceMethods(),
  game: [
    item("GetService", "method", "(name: string) -> Instance", 'Only "Workspace" is available.', 'GetService("Workspace")'),
    ...instanceMethods(),
  ],
  workspace: instanceMethods(),
};

const VALUE_PROPERTIES: Record<string, ApiItem[]> = {
  Vector3: [
    item("X", "property", "number", "X component.", "X"),
    item("Y", "property", "number", "Y component.", "Y"),
    item("Z", "property", "number", "Z component.", "Z"),
    item("Magnitude", "property", "number", "Length of the vector.", "Magnitude"),
    item("Unit", "property", "Vector3", "Vector with length 1, or NaN when the length is 0.", "Unit"),
  ],
  CFrame: [
    item("X", "property", "number", "Position X.", "X"),
    item("Y", "property", "number", "Position Y.", "Y"),
    item("Z", "property", "number", "Position Z.", "Z"),
    item("Position", "property", "Vector3", "Position of the CFrame.", "Position"),
    item("LookVector", "property", "Vector3", "Forward direction.", "LookVector"),
    item("RightVector", "property", "Vector3", "Right direction.", "RightVector"),
    item("UpVector", "property", "Vector3", "Up direction.", "UpVector"),
  ],
  Color3: [
    item("R", "property", "number", "Red, from 0 to 1.", "R"),
    item("G", "property", "number", "Green, from 0 to 1.", "G"),
    item("B", "property", "number", "Blue, from 0 to 1.", "B"),
  ],
  Instance: instanceProperties("Instance"),
  game: STATIC_MEMBERS.game,
  workspace: instanceProperties("Workspace"),
};

function item(
  label: string,
  kind: ApiItem["kind"],
  detail: string,
  documentation: string,
  insertText: string,
  snippet = false
): ApiItem {
  return { label, kind, detail, documentation, insertText, snippet };
}

function instanceProperties(className: string): ApiItem[] {
  return [
    item("Name", "property", "string", "Instance name. Must be a string.", "Name"),
    item("Parent", "property", "Instance?", "Parent instance, or nil.", "Parent"),
    item("ClassName", "property", "string", `The class name "${className}". Read-only.`, "ClassName"),
  ];
}

function instanceMethods(): ApiItem[] {
  return [
    item("GetChildren", "method", "() -> {Instance}", "A copy of the child list.", "GetChildren()"),
    item("FindFirstChild", "method", "(name: string, recursive: boolean?) -> Instance?", "Finds a child by name.", "FindFirstChild(${1:name})", true),
    item("GetFullName", "method", "() -> string", 'Path such as "Workspace.Props".', "GetFullName()"),
    item("IsA", "method", "(className: string) -> boolean", "True for this class name or Instance.", 'IsA("${1:Folder}")', true),
    item("Destroy", "method", "() -> ()", "Unparents this instance and its descendants. Workspace and game cannot be destroyed.", "Destroy()"),
  ];
}

function kindOf(monaco: typeof Monaco, kind: ApiItem["kind"]) {
  const kinds = monaco.languages.CompletionItemKind;
  if (kind === "method") return kinds.Method;
  if (kind === "property") return kinds.Property;
  if (kind === "function") return kinds.Function;
  return kinds.Constant;
}

function toSuggestions(
  monaco: typeof Monaco,
  items: ApiItem[],
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  const snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
  return items.map((entry, index) => ({
    label: entry.label,
    kind: kindOf(monaco, entry.kind),
    detail: entry.detail,
    documentation: entry.documentation,
    insertText: entry.insertText,
    ...(entry.snippet ? { insertTextRules: snippet } : {}),
    range,
    sortText: String(index).padStart(2, "0"),
  }));
}

function wordRange(model: Monaco.editor.ITextModel, position: Monaco.Position): Monaco.IRange {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

function receiver(line: string, column: number): { name: string; separator: "." | ":" } | null {
  const match = line.slice(0, column - 1).match(/([A-Za-z_][A-Za-z0-9_]*)\s*([.:])\s*[A-Za-z0-9_]*$/);
  if (!match) return null;
  return { name: match[1], separator: match[2] as "." | ":" };
}

function unique(items: ApiItem[]): ApiItem[] {
  const seen = new Set<string>();
  return items.filter((entry) => {
    if (seen.has(entry.label)) return false;
    seen.add(entry.label);
    return true;
  });
}

function suggestionsFor(name: string, separator: "." | ":"): ApiItem[] {
  if (separator === ":") {
    return METHODS[name] ?? unique([
      ...METHODS.Instance,
      ...METHODS.Vector3,
      ...METHODS.CFrame,
      ...METHODS.Color3,
    ]);
  }
  return STATIC_MEMBERS[name] ?? VALUE_PROPERTIES[name] ?? unique([
    ...VALUE_PROPERTIES.Instance,
    ...VALUE_PROPERTIES.Vector3,
    ...VALUE_PROPERTIES.CFrame,
    ...VALUE_PROPERTIES.Color3,
  ]);
}

export function registerLuauApi(monaco: typeof Monaco) {
  monaco.languages.registerCompletionItemProvider("luau", {
    triggerCharacters: [".", ":"],
    provideCompletionItems(model, position) {
      const range = wordRange(model, position);
      const line = model.getLineContent(position.lineNumber);
      const context = receiver(line, position.column);
      const items = context ? suggestionsFor(context.name, context.separator) : GLOBALS;
      return { suggestions: toSuggestions(monaco, items, range) };
    },
  });

  monaco.languages.registerHoverProvider("luau", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const line = model.getLineContent(position.lineNumber);
      const context = receiver(line, word.startColumn);
      const items = context ? suggestionsFor(context.name, context.separator) : GLOBALS;
      const found = items.find((entry) => entry.label === word.word);
      if (!found) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value: `**${found.label}** \`${found.detail}\`\n\n${found.documentation}` }],
      };
    },
  });
}
