# Execution Engine - QuickJS WASM

## Overview

The execution engine uses **QuickJS compiled to WebAssembly** to provide a secure, isolated sandbox for running user-submitted JavaScript and TypeScript code entirely in the browser.

---

## Why QuickJS WASM?

| Alternative | Pros | Cons | Verdict |
|-------------|------|------|---------|
| `new Function()` | Fast, no dependencies | No sandbox, no fetch, no modules | ❌ |
| `eval()` | Simple | Security nightmare, no isolation | ❌ |
| iframe sandbox | Isolated | No fetch, limited JS features | ❌ |
| **QuickJS WASM** | Secure, ES2023, fetch, modules, timeout | ~2MB WASM load | ✅ |

### QuickJS Advantages

- **ES2023 support**: All modern JS features
- **Real sandbox**: No access to host globals
- **Built-in modules**: `path`, `url`, `util`, `events`, `assert`
- **Memory limits**: Configurable per-context
- **CPU limits**: Real timeout via `executePendingJobs()`
- **Fetch support**: Injected by host

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN THREAD                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Execution Controller                    │   │
│  │  • Creates Web Worker                                │   │
│  │  • Sends code + files                                │   │
│  │  • Receives logs via postMessage                     │   │
│  │  • Enforces 5s wall-clock timeout                    │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │ postMessage
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    WEB WORKER                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              QuickJS WASM Runtime                    │   │
│  │  • Runtime (heap)                                    │   │
│  │  • Context (globals, builtins)                       │   │
│  │  • Module loader                                     │   │
│  │  • Virtual filesystem                                │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Injected APIs                           │   │
│  │  • console → postMessage                             │   │
│  │  • fetch → main thread bridge                        │   │
│  │  • require → virtual FS + import map                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## QuickJS WASM Setup

### Loading the WASM Module

```typescript
// workers/quickjs.worker.ts
import { newQuickJSWASMModule } from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-ng-wasmfile-release-sync';

const QuickJS = await newQuickJSWASMModule(variant);

console.log('QuickJS WASM loaded successfully');
```

### Creating a Context

```typescript
const runtime = QuickJS.newRuntime({
  memoryLimit: 50 * 1024 * 1024, // 50MB
});

const context = runtime.newContext({
  name: 'user-execution',
});

// Set max stack size
runtime.setMaxStackSize(1024 * 1024); // 1MB
```

---

## Console Interception

```typescript
function setupConsole(context: QuickJSContext) {
  const consoleLog = context.newFunction('log', (...args) => {
    const formatted = args.map(arg => {
      const val = context.dump(arg);
      if (typeof val === 'object' && val !== null) {
        try {
          return JSON.stringify(val, null, 2);
        } catch {
          return String(val);
        }
      }
      return String(val);
    }).join(' ');
    
    postMessage({
      type: 'console',
      level: 'log',
      message: formatted,
      timestamp: Date.now(),
    });
  });

  const consoleError = context.newFunction('error', (...args) => {
    const formatted = args.map(arg => context.dump(arg)).join(' ');
    postMessage({
      type: 'console',
      level: 'error',
      message: formatted,
      timestamp: Date.now(),
    });
  });

  const consoleWarn = context.newFunction('warn', (...args) => {
    const formatted = args.map(arg => context.dump(arg)).join(' ');
    postMessage({
      type: 'console',
      level: 'warn',
      message: formatted,
      timestamp: Date.now(),
    });
  });

  // Create console object in QuickJS
  const consoleObj = context.newObject();
  context.setProp(consoleObj, 'log', consoleLog);
  context.setProp(consoleObj, 'error', consoleError);
  context.setProp(consoleObj, 'warn', consoleWarn);
  context.setProp(consoleObj, 'info', consoleLog); // alias
  context.setProp(consoleObj, 'debug', consoleLog); // alias
  context.setProp(consoleObj, 'table', consoleLog); // simplified
  context.setProp(consoleObj, 'time', context.newFunction('time', () => {}));
  context.setProp(consoleObj, 'timeEnd', context.newFunction('timeEnd', () => {}));
  context.setProp(consoleObj, 'clear', context.newFunction('clear', () => {
    postMessage({ type: 'console-clear', timestamp: Date.now() });
  }));

  context.setGlobal('console', consoleObj);
}
```

---

## Fetch Interception

```typescript
function setupFetch(context: QuickJSContext) {
  const fetchFn = context.newFunction('fetch', async (urlHandle, optionsHandle) => {
    const url = context.dump(urlHandle);
    const options = optionsHandle ? context.dump(optionsHandle) : {};
    
    // Log request
    postMessage({
      type: 'network-request',
      url,
      method: options.method || 'GET',
      timestamp: Date.now(),
    });

    try {
      const response = await globalThis.fetch(url, options);
      const data = await response.text();
      
      // Log response
      postMessage({
        type: 'network-response',
        url,
        status: response.status,
        statusText: response.statusText,
        timestamp: Date.now(),
      });

      // Return response as QuickJS object
      const responseObj = context.newObject();
      context.setProp(responseObj, 'ok', context.newBool(response.ok));
      context.setProp(responseObj, 'status', context.newNumber(response.status));
      context.setProp(responseObj, 'statusText', context.newString(response.statusText));
      context.setProp(responseObj, 'url', context.newString(response.url));
      
      const textFn = context.newFunction('text', () => context.newString(data));
      context.setProp(responseObj, 'text', textFn);
      
      const jsonFn = context.newFunction('json', () => {
        try {
          return context.newString(JSON.parse(data));
        } catch {
          throw new Error('Invalid JSON');
        }
      });
      context.setProp(responseObj, 'json', jsonFn);
      
      return responseObj;
    } catch (error) {
      postMessage({
        type: 'network-error',
        url,
        error: (error as Error).message,
        timestamp: Date.now(),
      });
      throw error;
    }
  });

  context.setGlobal('fetch', fetchFn);
}
```

---

## Virtual Filesystem

```typescript
function setupVirtualFS(
  context: QuickJSContext,
  files: Record<string, string>
) {
  // Store files in QuickJS memory
  const fsObj = context.newObject();
  
  const readFile = context.newFunction('readFileSync', (pathHandle) => {
    const path = context.dump(pathHandle);
    const content = files[path];
    
    if (content === undefined) {
      // Try with .ts, .tsx, .js, .mjs extensions
      const extensions = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      for (const ext of extensions) {
        if (files[path + ext] !== undefined) {
          return context.newString(files[path + ext]);
        }
      }
      throw new Error(`File not found: ${path}`);
    }
    
    return context.newString(content);
  });
  
  const writeFile = context.newFunction('writeFileSync', (pathHandle, contentHandle) => {
    const path = context.dump(pathHandle);
    const content = context.dump(contentHandle);
    files[path] = content;
    // In a real implementation, this would save to IndexedDB
  });
  
  const existsSync = context.newFunction('existsSync', (pathHandle) => {
    const path = context.dump(pathHandle);
    return context.newBool(files[path] !== undefined);
  });
  
  const readdirSync = context.newFunction('readdirSync', (pathHandle) => {
    const path = context.dump(pathHandle);
    const entries = Object.keys(files)
      .filter(f => f.startsWith(path))
      .map(f => f.slice(path.length).split('/')[0]);
    const unique = [...new Set(entries)];
    const arr = context.newArray();
    unique.forEach((entry, i) => {
      context.setProp(arr, String(i), context.newString(entry));
    });
    return arr;
  });
  
  context.setProp(fsObj, 'readFileSync', readFile);
  context.setProp(fsObj, 'writeFileSync', writeFile);
  context.setProp(fsObj, 'existsSync', existsSync);
  context.setProp(fsObj, 'readdirSync', readdirSync);
  
  context.setGlobal('require', context.newFunction('require', (moduleHandle) => {
    const module = context.dump(moduleHandle);
    if (module === 'fs' || module === 'node:fs') return fsObj;
    // Add other built-in modules here
    throw new Error(`Module not found: ${module}`);
  }));
}
```

---

## TypeScript Transpilation

```typescript
async function transpileTypeScript(code: string): Promise<string> {
  // Use Monaco's TypeScript worker for transpilation
  const worker = await monaco.languages.typescript.getTypeScriptWorker();
  const model = monaco.editor.createModel(code, 'typescript');
  
  const client = await worker(model.uri);
  const output = await client.getEmitOutput(model.uri.toString());
  
  // Clean up
  model.dispose();
  
  return output.outputFiles[0].text;
}
```

Or using the `typescript` package directly:

```typescript
import * as ts from 'typescript';

function transpileTS(code: string): string {
  return ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      esModuleInterop: true,
    },
  }).outputText;
}
```

---

## Timeout Enforcement

```typescript
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

// Usage
const result = await withTimeout(
  executeCode(context, code),
  5000,
  'Execution timed out (possible infinite loop detected)'
);
```

---

## Worker Message Protocol

### Main → Worker

```typescript
// Request types
type WorkerRequest =
  | {
      type: 'execute';
      payload: {
        code: string;
        files: Record<string, string>;
        mainFile: string;
      };
    }
  | {
      type: 'abort';
    };
```

### Worker → Main

```typescript
// Response types
type WorkerResponse =
  | { type: 'ready' }
  | { type: 'console'; level: string; message: string; timestamp: number }
  | { type: 'console-clear'; timestamp: number }
  | { type: 'network-request'; url: string; method: string; timestamp: number }
  | { type: 'network-response'; url: string; status: number; timestamp: number }
  | { type: 'network-error'; url: string; error: string; timestamp: number }
  | { type: 'result'; value: string; timestamp: number }
  | { type: 'error'; message: string; stack?: string; timestamp: number }
  | { type: 'timeout'; timestamp: number }
  | { type: 'done'; timestamp: number };
```

---

## Memory Management

```typescript
// Cleanup after execution
function cleanup(context: QuickJSContext, runtime: QuickJSRuntime) {
  // Dispose all QuickJS values
  context.dispose();
  runtime.dispose();
  
  // Force garbage collection
  QuickJS.gc();
  
  // Report memory usage
  postMessage({
    type: 'memory-usage',
    used: runtime.getMemoryUsage(),
    limit: 50 * 1024 * 1024,
  });
}
```

---

## Error Handling Examples

### Syntax Error

```typescript
// User writes:
const x = {;

// Output:
{
  type: 'error',
  message: 'SyntaxError: Unexpected token ;',
  location: { file: 'index.ts', line: 1, column: 9 }
}
```

### Runtime Error

```typescript
// User writes:
const obj = null;
console.log(obj.foo);

// Output:
{
  type: 'error',
  message: "TypeError: Cannot read properties of null (reading 'foo')",
  stack: '    at index.ts:2:15',
  location: { file: 'index.ts', line: 2, column: 15 }
}
```

### Timeout

```typescript
// User writes:
while (true) {}

// Output:
{
  type: 'timeout',
  message: 'Execution timed out (possible infinite loop detected)'
}
```

### Import Error

```typescript
// User writes:
import { something } from './nonexistent';

// Output:
{
  type: 'error',
  message: "Error: Cannot find module './nonexistent'",
  location: { file: 'index.ts', line: 1, column: 25 }
}
```