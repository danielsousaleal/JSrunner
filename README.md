# JS Runner

A client-side JavaScript/TypeScript code execution environment with a VS Code-like editor experience. Runs entirely in the browser with zero server cost.

---

## Features

- **VS Code Editor** - Monaco Editor with IntelliSense, error diagnostics, and syntax highlighting
- **TypeScript Support** - Full type checking in the browser
- **Multi-file Projects** - File tree, tabs, and module imports between files
- **Console Output** - `console.log`, errors, warnings, and network request logging
- **Fetch API** - Make HTTP requests (GET, POST, etc.) directly from your code
- **NPM Packages** - Import any npm package via esm.sh CDN
- **Secure Execution** - Code runs in QuickJS WASM sandbox with timeout protection
- **Local Persistence** - Workspace saved to IndexedDB, survives page reload
- **Export/Import** - Download workspace as JSON file
- **Zoom** - Adjustable zoom level (50% - 200%)
- **Dark Theme** - VS Code Dark+ theme optimized for code readability
- **Chromebook Optimized** - Layout designed for wide, short screens

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm, pnpm, or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/js-runner.git
cd js-runner

# Install dependencies
npm install

# Copy WASM file
npm run copy-wasm

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

### Run Code

- Click the **Run** button (▶) in the header
- Or press **Ctrl+Enter** (Cmd+Enter on Mac)

### File Management

- **Create file**: Click "+ New File" in sidebar
- **Rename**: Right-click file → Rename
- **Delete**: Right-click file → Delete
- **Switch files**: Click tab or file in sidebar

### Import Packages

```typescript
import _ from 'lodash';
import axios from 'axios';
import { z } from 'zod';

console.log(_.capitalize('hello world'));
```

Add packages via the "Add Package" button in the sidebar.

### Multi-file Imports

```typescript
// utils.ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

```typescript
// index.ts
import { formatDate } from './utils';

console.log(formatDate(new Date()));
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MAIN THREAD (UI)                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ File Tree  │  │   Monaco   │  │  Console Output    │    │
│  │ + Tabs     │  │   Editor   │  │  (logs, errors)    │    │
│  └─────┬──────┘  └─────┬──────┘  └─────────┬──────────┘    │
│        └───────────────┼───────────────────┘               │
│                        ▼                                     │
│             ┌────────────────────┐                          │
│             │ Execution          │                          │
│             │ Controller         │                          │
│             └────────┬───────────┘                          │
└──────────────────────┼──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   WEB WORKER (Isolated)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              QuickJS WASM Runtime                    │   │
│  │  • Secure sandbox (no DOM, no localStorage)          │   │
│  │  • 5s CPU timeout                                    │   │
│  │  • 50MB memory limit                                 │   │
│  │  • Native fetch support                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (Static Export) |
| Editor | Monaco Editor |
| Execution | QuickJS WASM |
| State | Zustand |
| Persistence | IndexedDB (idb) |
| Styling | Tailwind CSS 4 |
| UI | shadcn/ui |
| Icons | lucide-react |

See [BUILD.md](./BUILD.md) for setup details.

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and data flow |
| [DESIGN.md](./DESIGN.md) | UI/UX specifications and layout |
| [BUILD.md](./BUILD.md) | Build configuration and setup |
| [SPEC.md](./SPEC.md) | Technical specification |
| [EXECUTION.md](./EXECUTION.md) | QuickJS WASM execution engine |
| [EDITOR.md](./EDITOR.md) | Monaco Editor integration |
| [PACKAGES.md](./PACKAGES.md) | NPM packages and import maps |
| [PERSISTENCE.md](./PERSISTENCE.md) | IndexedDB persistence |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel deployment |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run code |
| `Ctrl+S` | Save (auto-save trigger) |
| `Ctrl+Shift+E` | Toggle sidebar |
| `Ctrl+Shift+C` | Focus console |
| `Ctrl+0` | Reset zoom |
| `Ctrl++` / `Ctrl+-` | Zoom in/out |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |

---

## Security

Code runs in a QuickJS WASM sandbox with:
- No access to DOM
- No access to localStorage/IndexedDB
- No access to cookies
- 5 second CPU timeout
- 50MB memory limit
- Only injected: console, fetch, require

See [SPEC.md](./SPEC.md#10-security) for details.

---

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 90+ |
| Edge | 90+ |
| Firefox | 90+ |
| Safari | 15+ |

Requires:
- WebAssembly support
- IndexedDB support
- Import Maps support
- Web Workers support

---

## License

MIT