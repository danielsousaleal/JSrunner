# Technical Specification

## 1. Overview

**JS Runner** is a client-side JavaScript/TypeScript code execution environment that runs entirely in the browser. It provides a VS Code-like editor experience with real-time type checking, multi-file support, and secure code execution via WebAssembly.

### Key Properties

| Property | Value |
|----------|-------|
| Deployment | Vercel (Static Export) |
| Runtime | Browser (Client-side only) |
| Server | None (zero server cost) |
| Authentication | None (unique per browser) |
| Persistence | IndexedDB (local) |
| Execution | QuickJS WASM sandbox |
| Editor | Monaco Editor (VS Code) |

---

## 2. Core Concepts

### 2.1 Workspace

A workspace is the top-level container for a user's project. Only one workspace exists per browser.

```typescript
interface Workspace {
  version: 1;
  id: string;                    // UUID
  name: string;                  // "My Project"
  files: Record<string, File>;   // path → File
  activeFile: string;            // current open file path
  settings: WorkspaceSettings;
  consoleHistory: ConsoleEntry[];
  createdAt: number;             // Date.now()
  updatedAt: number;             // Date.now()
}

interface File {
  content: string;
  language: 'javascript' | 'typescript' | 'json' | 'html' | 'css';
  cursor: { line: number; column: number };
  scrollPosition: number;
  dirty: boolean;                // unsaved changes
}

interface WorkspaceSettings {
  zoom: number;                  // 0.5 to 2.0
  fontSize: number;              // 12 to 24
  tabSize: number;               // 2 or 4
  wordWrap: 'on' | 'off';
  minimap: boolean;
  autoSave: boolean;
}
```

### 2.2 Execution Context

When code is run, an execution context is created:

```typescript
interface ExecutionContext {
  id: string;                    // UUID
  mainFile: string;              // entry point
  files: Record<string, string>; // all files content
  timeout: number;               // 5000ms default
  memoryLimit: number;           // 50MB default
  allowFetch: boolean;           // true
  allowFs: boolean;              // true (virtual)
}
```

### 2.3 Console Entry

```typescript
interface ConsoleEntry {
  id: string;
  executionId: string;           // ties to execution context
  timestamp: number;
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'network' | 'table' | 'time' | 'timeEnd' | 'result';
  message: string;
  formatted?: string;            // HTML formatted version
  meta?: ConsoleMeta;
}

interface ConsoleMeta {
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

## 3. File Management

### 3.1 Supported Languages

| Extension | Language | Monaco Mode | Execution |
|-----------|----------|-------------|-----------|
| `.ts` | TypeScript | typescript | QuickJS transpile → eval |
| `.tsx` | TypeScript JSX | typescript | QuickJS transpile → eval |
| `.js` | JavaScript | javascript | QuickJS eval |
| `.jsx` | JavaScript JSX | javascript | QuickJS eval |
| `.json` | JSON | json | Load as module |
| `.html` | HTML | html | Preview in iframe (future) |
| `.css` | CSS | css | Stylesheet (future) |
| `.mjs` | ES Module | javascript | QuickJS eval |
| `.cjs` | CommonJS | javascript | QuickJS eval |

### 3.2 Default Files

On first visit, workspace is created with:

```
index.ts
```

```typescript
// Welcome to JS Runner! 🚀
// 
// Click "Run" (▶) or press Ctrl+Enter to execute this code.
// Your output will appear in the console below.

function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet("World"));

// Try editing this file, then run again!
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Doubled:", doubled);
```

### 3.3 File Operations

| Operation | Method | Persistence |
|-----------|--------|-------------|
| Create | `addFile(path, content)` | Debounced (500ms) |
| Read | `getFile(path)` | IndexedDB |
| Update | `updateFile(path, content)` | Debounced (500ms) |
| Delete | `deleteFile(path)` | Immediate |
| Rename | `renameFile(oldPath, newPath)` | Immediate |
| Duplicate | `duplicateFile(path)` | Debounced (500ms) |
| Move | `moveFile(fromPath, toPath)` | Immediate |

### 3.4 Path Rules

- Paths use forward slashes: `src/utils/index.ts`
- No leading slash: `index.ts` not `/index.ts`
- No double slashes: `src//utils.ts` → `src/utils.ts`
- Case sensitive: `Index.ts` ≠ `index.ts`
- Max path length: 255 characters
- Max file size: 5MB

---

## 4. Execution Specification

### 4.1 Run Triggers

| Trigger | Context |
|---------|---------|
| Click Run button | Always |
| Ctrl+Enter | Global |
| Cmd+Enter (Mac) | Global |

### 4.2 Execution Flow

```
1. Collect all files from workspace
2. Create QuickJS context with options:
   - allowFetch: true
   - allowFs: true
   - timeout: 5000
   - memoryLimit: 52428800 (50MB)
3. Mount virtual filesystem with all workspace files
4. Inject console interceptor
5. Inject fetch interceptor
6. Transpile TypeScript to JavaScript
7. Execute transpiled code
8. Collect logs and result
9. Send to main thread
10. Terminate worker
```

### 4.3 Transpilation

TypeScript files are transpiled before execution:

```typescript
// TypeScript → JavaScript
const transpiled = await transpile({
  code: sourceCode,
  fileName: 'index.ts',
  compilerOptions: {
    target: 'ESNext',
    module: 'ESNext',
    jsx: 'react-jsx',
    strict: true,
    esModuleInterop: true,
  }
});
```

### 4.4 Module Resolution

Files can import each other:

```typescript
// index.ts
import { formatDate } from './utils';
console.log(formatDate(new Date()));
```

```typescript
// utils.ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

Resolution rules:
1. Relative imports (`./utils`, `../lib/helper`)
2. Absolute imports resolved from workspace root (`@/utils`)
3. Bare imports resolved via import map (`lodash` → esm.sh)

### 4.5 Error Handling

```typescript
interface ExecutionError {
  type: 'syntax' | 'runtime' | 'timeout' | 'memory' | 'import';
  message: string;
  stack?: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
}
```

| Error Type | Detection | Response |
|------------|-----------|----------|
| Syntax | Parse error | Line number, message |
| Runtime | Exception thrown | Stack trace, location |
| Timeout | > 5s CPU time | "Execution timed out (possible infinite loop)" |
| Memory | > 50MB | "Memory limit exceeded" |
| Import | Module not found | "Cannot find module 'x'" |

---

## 5. Network (Fetch) Specification

### 5.1 Supported Methods

```typescript
// GET
const res = await fetch('https://api.github.com/users/octocat');
const data = await res.json();
console.log(data);

// POST
const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Hello', body: 'World' })
});

// PUT, PATCH, DELETE - all supported
```

### 5.2 Console Network Logging

Every fetch call is logged:

```
▶ NETWORK  GET https://api.github.com/users/octocat
◀ NETWORK  200 OK (123ms)
▶ NETWORK  POST https://jsonplaceholder.typicode.com/posts
◀ NETWORK  201 Created (456ms)
```

### 5.3 CORS Handling

- User code runs in QuickJS WASM (no CORS restrictions)
- Fetch goes through main thread worker bridge
- CORS errors caught and logged to console
- Suggestion shown: "CORS error - try using a CORS proxy or API that allows cross-origin requests"

---

## 6. Persistence Specification

### 6.1 IndexedDB Schema

Database: `js-runner-workspace`, Version: 1

```
Store: workspace
  Key: 'current'
  Value: Workspace object (full state)
```

### 6.2 Save Triggers

| Action | Save Timing |
|--------|-------------|
| Edit file | Debounced 500ms |
| Create file | Debounced 500ms |
| Delete file | Immediate |
| Rename file | Immediate |
| Change settings | Debounced 500ms |
| Add package | Immediate |
| Console history | Immediate |

### 6.3 Data Size Limits

| Data | Max Size | Cleanup |
|------|----------|---------|
| Workspace | 50MB | Prompt user |
| Console history | 1000 entries | FIFO (remove oldest) |
| Import map cache | 100 entries | LRU eviction |

### 6.4 Export Format

```json
{
  "exportVersion": 1,
  "exportedAt": "2024-01-15T12:00:00.000Z",
  "workspace": {
    "name": "My Project",
    "files": {
      "index.ts": {
        "content": "console.log('hello');",
        "language": "typescript"
      }
    },
    "settings": {
      "fontSize": 14,
      "tabSize": 2
    }
  }
}
```

---

## 7. Package Management

### 7.1 Import Map

Packages are resolved via esm.sh CDN:

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.2.0",
    "lodash": "https://esm.sh/lodash@4.17.21",
    "axios": "https://esm.sh/axios@1.6.0"
  }
}
</script>
```

### 7.2 Add Package UI

1. Click "Add Package" in sidebar
2. Type package name (e.g., "lodash")
3. System fetches from esm.sh registry
4. Adds to import map with latest version
5. Updates TypeScript definitions
6. Saves to workspace

### 7.3 Pre-configured Packages

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.2.0 | UI library |
| react-dom | 18.2.0 | DOM rendering |
| lodash | 4.17.21 | Utilities |
| lodash-es | 4.17.21 | ES modules |
| axios | 1.6.0 | HTTP client |
| zod | 3.22.0 | Validation |
| date-fns | 3.0.0 | Date utilities |
| clsx | 2.0.0 | Class names |
| tailwind-merge | 2.0.0 | Tailwind classes |
| zustand | 4.4.0 | State management |
| uuid | 9.0.0 | UUID generation |

---

## 8. Download/Import Specification

### 8.1 Download Format

File extension: `.json`
MIME type: `application/json`
Filename pattern: `js-runner-{timestamp}.json`

### 8.2 Import Flow

1. User clicks "Import" button
2. File picker opens (`.json` files only)
3. File content parsed and validated
4. Workspace restored from import
5. Current workspace replaced (with confirmation)
6. All files restored with content

### 8.3 Import Validation

```typescript
function validateImport(data: unknown): data is Workspace {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    (data as any).version === 1 &&
    'files' in data &&
    typeof (data as any).files === 'object'
  );
}
```

---

## 9. Accessibility

### 9.1 ARIA Labels

| Element | Label |
|---------|-------|
| Run button | "Run code (Ctrl+Enter)" |
| File tree | "File explorer" |
| Console | "Console output" |
| Tabs | "File tabs" |
| Zoom controls | "Zoom level: 100%" |

### 9.2 Keyboard Navigation

- All interactive elements focusable via Tab
- Focus visible with 2px outline
- Escape closes modals/dropdowns
- Arrow keys navigate file tree

### 9.3 Screen Reader

- File names announced
- Console entries have `role="log"`
- Status updates use `aria-live="polite"`
- Error messages use `aria-live="assertive"`

---

## 10. Security

### 10.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| XSS via user code | QuickJS sandbox, no DOM access |
| Prototype pollution | QuickJS isolated globals |
| Infinite loops | 5s CPU timeout |
| Memory exhaustion | 50MB memory limit |
| Cookie theft | No cookie access in worker |
| LocalStorage theft | No localStorage in worker |
| Network abuse | User-initiated only, CORS enforced |

### 10.2 What User Code CANNOT Access

- `window`, `document`, `globalThis`
- `localStorage`, `sessionStorage`, `IndexedDB`
- `navigator`, `location`
- DOM elements
- Other tabs/windows
- Service workers
- Web Workers (other than its own)

### 10.3 What User Code CAN Access

- `console.log/error/warn/info/debug/table/time/timeEnd`
- `fetch` (GET, POST, PUT, PATCH, DELETE)
- `import` statements (via import map)
- `require` (CommonJS compatibility)
- `setTimeout`, `setInterval` (within QuickJS)
- `JSON`, `Math`, `Date`, `RegExp`, `Array`, `Object`, etc.
- `TextEncoder`, `TextDecoder`
- `URL`, `URLSearchParams`
- `crypto` (WebCrypto API subset)