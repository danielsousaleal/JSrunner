import type * as Monaco from "monaco-editor";
import { registerLuauApi } from "./monaco-luau-api";

let registered = false;

const KEYWORDS = [
  "and",
  "break",
  "continue",
  "do",
  "else",
  "elseif",
  "end",
  "export",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "type",
  "typeof",
  "until",
  "while",
];

const TYPES = [
  "any",
  "boolean",
  "buffer",
  "never",
  "number",
  "string",
  "thread",
  "unknown",
];

export function registerLuauLanguage(monaco: typeof Monaco) {
  if (registered) return;
  registered = true;

  monaco.languages.register({
    id: "luau",
    extensions: [".luau", ".lua"],
    aliases: ["Luau", "luau"],
  });

  monaco.languages.setLanguageConfiguration("luau", {
    comments: {
      lineComment: "--",
      blockComment: ["--[[", "]]"],
    },
    brackets: [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "{", close: "}" },
      { open: '"', close: '"', notIn: ["string"] },
      { open: "'", close: "'", notIn: ["string"] },
      { open: "`", close: "`", notIn: ["string"] },
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "{", close: "}" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "`", close: "`" },
    ],
    indentationRules: {
      increaseIndentPattern:
        /^\s*(else|elseif|for|function|if|repeat|while|do)\b((?!end).)*$/,
      decreaseIndentPattern: /^\s*(end|else|elseif|until)\b/,
    },
  });

  registerLuauApi(monaco);

  monaco.languages.setMonarchTokensProvider("luau", {
    defaultToken: "",
    tokenPostfix: ".luau",
    keywords: KEYWORDS,
    types: TYPES,
    tokenizer: {
      root: [
        [/--\[=?\[/, "comment", "@comment"],
        [/--.*$/, "comment"],
        [/`/, "string", "@interp"],
        [/\[=?\[/, "string", "@long"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/'([^'\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string_double"],
        [/'/, "string", "@string_single"],
        [/0[xX][0-9a-fA-F_]+/, "number"],
        [/0[bB][01_]+/, "number"],
        [/\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?/, "number"],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@types": "type",
              "@default": "identifier",
            },
          },
        ],
        [/::/, "operator"],
        [/[{}()[\]]/, "@brackets"],
        [/[;,.]/, "delimiter"],
        [/[+\-*/%^#=<>~]+/, "operator"],
      ],
      comment: [
        [/\]=?\]/, "comment", "@pop"],
        [/[^\]]+/, "comment"],
        [/\]/, "comment"],
      ],
      long: [
        [/\]=?\]/, "string", "@pop"],
        [/[^\]]+/, "string"],
        [/\]/, "string"],
      ],
      interp: [
        [/`/, "string", "@pop"],
        [/\\./, "string.escape"],
        [/\{/, "delimiter.bracket", "@interp_expr"],
        [/[^`\\{]+/, "string"],
      ],
      interp_expr: [
        [/\}/, "delimiter.bracket", "@pop"],
        [/\{/, "delimiter.bracket", "@interp_expr"],
        [/"/, "string", "@string_double"],
        [/'/, "string", "@string_single"],
        [/--.*$/, "comment"],
        [/\d[\d_]*/, "number"],
        [/[=<>+\-*/%^#]+/, "operator"],
        [/[a-zA-Z_]\w*/, "identifier"],
        [/./, ""],
      ],
      string_double: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"],
      ],
      string_single: [
        [/[^\\']+/, "string"],
        [/\\./, "string.escape"],
        [/'/, "string", "@pop"],
      ],
    },
  });
}
