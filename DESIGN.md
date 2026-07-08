# DESIGN.md - UI/UX Specification

## Design Philosophy

**Target Device**: Chromebooks (wide, short screens - 1366x768 typical)
**Theme**: Dark only (VS Code Dark+)
**Focus**: Code-first, minimal chrome, maximum editor real estate

---

## Color Palette (VS Code Dark+)

```css
:root {
  /* Base backgrounds */
  --vscode-bg:           #1e1e1e;
  --vscode-bg-secondary: #252526;
  --vscode-bg-tertiary:  #2d2d2d;
  --vscode-bg-hover:     #2a2d2e;
  
  /* Borders */
  --vscode-border:       #3c3c3c;
  --vscode-border-light: #464647;
  
  /* Text */
  --vscode-fg:           #d4d4d4;
  --vscode-fg-muted:     #9c9c9c;
  --vscode-fg-subtle:    #6a6a6a;
  
  /* Accent (Blue) */
  --vscode-blue:         #007acc;
  --vscode-blue-hover:   #005fa3;
  --vscode-blue-muted:   #007acc20;
  
  /* Syntax Colors (for console) */
  --console-log:         #d4d4d4;
  --console-info:        #4ec9b0;
  --console-warn:        #dcdcaa;
  --console-error:       #f44747;
  --console-debug:       #9cdcfe;
  --console-time:        #ce9178;
  --console-net:         #c586c0;
  
  /* Scrollbar */
  --scrollbar-thumb:     #424242;
  --scrollbar-track:     #1e1e1e;
  --scrollbar-hover:     #4e4e4e;
}
```

---

## Layout Specification

### CSS Grid Structure (Chromebook Optimized)

```css
.app-shell {
  display: grid;
  grid-template-rows: 
    32px        /* Header - compact */
    1fr         /* Editor - flexible */
    4px         /* Splitter */
    200px       /* Console - fixed default */
  ;
  grid-template-columns: 
    220px       /* Sidebar - collapsible */
    1fr         /* Main editor */
  ;
  height: 100dvh;           /* Dynamic viewport height */
  min-height: 0;            /* Critical for grid shrink */
  background: var(--vscode-bg);
  color: var(--vscode-fg);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### Grid Area Names

```css
.header       { grid-area: header; }
.sidebar      { grid-area: sidebar; }
.editor-pane  { grid-area: editor; }
.splitter     { grid-area: splitter; }
.console      { grid-area: console; }

.app-shell {
  grid-template-areas:
    "header  header"
    "sidebar editor"
    "splitter splitter"
    "console console";
}
```

### Responsive Breakpoints

| Breakpoint | Sidebar | Console | Header |
|------------|---------|---------|--------|
| < 768px    | Collapsed (0px) | 150px | 28px |
| 768-1024px | 200px | 180px | 32px |
| > 1024px   | 220px | 200px | 32px |

---

## Component Specifications

### 1. Header (32px height)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ █ JS Runner                    main.ts  ▼  [Run ▶]  [Zoom: 100%]  [☰]     │
└────────────────────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Logo | "JS Runner" - 13px, weight 600, #d4d4d4 |
| File name | Active file, truncated middle, 12px, #9c9c9c |
| Run button | Primary: #007acc, white text, 28x28px, Ctrl+Enter hint |
| Zoom control | 100% default, 50%-200%, step 10%, keyboard +/- |
| Sidebar toggle | Hamburger icon, 28x28px, tooltip "Toggle Sidebar" |

**States**:
- Running: Spinner in run button, disabled
- Error in console: Red dot indicator on console area

---

### 2. Sidebar (220px default, collapsible to 0)

```
┌─────────────────────────┐
│ FILES              [×]  │  ← Collapse button
├─────────────────────────┤
│ 📁 project              │
│   📄 index.html         │
│   📄 main.ts      ●     │  ← Dirty indicator (orange dot)
│   📄 styles.css         │
│   📄 utils.js           │
│   📄 package.json       │
├─────────────────────────┤
│ [+ New File]            │
│ [+ New Folder]          │
│ [📦 Add Package]        │
└─────────────────────────┘
```

**File Tree Items**:
- Height: 24px
- Hover: `var(--vscode-bg-hover)`
- Active: `var(--vscode-blue-muted)` + left border 2px `var(--vscode-blue)`
- Icons: File type specific (TS, JS, JSON, CSS, HTML, etc.)
- Context menu (right-click): Rename, Delete, Duplicate, Copy Path

**Collapse Animation**: 200ms ease-out, `width` transition

---

### 3. Editor Pane (Main Area)

```
┌────────────────────────────────────────────────────────────────┐
│  1  │ function greet(name: string): string {                  │
│  2  │   return `Hello, ${name}!`;                             │
│  3  │ }                                                        │
│  4  │                                                          │
│  5  │ console.log(greet("World"));  ◄── Error squiggly        │
│  6  │                                                          │
├────────────────────────────────────────────────────────────────┤
│ Tab Bar:  [index.ts ●]  [main.ts]  [styles.css]  [+]          │
└────────────────────────────────────────────────────────────────┘
```

**Monaco Configuration**:
```typescript
const editorOptions = {
  theme: 'vs-dark',
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  lineHeight: 22,
  letterSpacing: 0.5,
  tabSize: 2,
  wordWrap: 'on',
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true, indentation: true },
  renderLineHighlight: 'gutter',
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  quickSuggestions: { other: true, comments: true, strings: true },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on',
  parameterHints: { enabled: true },
  diagnostic: { enable: true },
  multiCursorModifier: 'ctrlCmd',
  accessibilitySupport: 'on',
};
```

**Tab Bar**:
- Height: 28px
- Max width per tab: 180px
- Dirty indicator: Orange dot (●) 8px
- Close button: Hover only, 16x16px
- New tab (+): Always visible at end
- Drag to reorder: Supported

---

### 4. Resizable Splitter (4px)

```
┌────────────────────────────────────────┐
│              ░░░░░░░░                   │  ← Draggable area
└────────────────────────────────────────┘
```

- Height: 4px (grabs 8px on hover)
- Cursor: `ns-resize`
- Hover: `var(--vscode-blue)` background
- Drag: Updates `grid-template-rows` for console height
- Min console: 100px, Max: 60vh
- Double-click: Toggle console minimize/restore

---

### 5. Console Output (200px default)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [All] [Errors] [Logs] [Network] [Clear] [Copy] [↓]                    12:34│
├────────────────────────────────────────────────────────────────────────────┤
│ ▼ 12:34:12.123  LOG      Hello, World!                                     │
│ ▼ 12:34:12.145  NETWORK  GET https://api.github.com/users/octocat  200 OK  │
│ ▶ 12:34:12.201  ERROR    TypeError: Cannot read property 'foo' of undefined│
│    at main.ts:5:13                                                           │
│    at greet (main.ts:2:10)                                                  │
│ ▼ 12:34:12.250  WARN     Deprecated API used                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Log Entry Structure**:
```typescript
interface ConsoleEntry {
  id: string;              // UUID
  timestamp: number;       // Date.now()
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'network' | 'table' | 'time' | 'timeEnd';
  message: string | object;
  meta?: {
    url?: string;          // For network
    status?: number;       // For network
    method?: string;       // For network
    duration?: number;     // For time/timeEnd
    stack?: string;        // For errors
    location?: { file: string; line: number; column: number };
  };
}
```

**Filter Toolbar**:
- Height: 28px
- Buttons: Toggle filters (multi-select)
- Badge counts: Per filter type
- Clear: Removes all entries
- Copy: Copies filtered as text
- Auto-scroll: Toggle (default on)

**Virtualization**: React-window for >100 entries

---

## Zoom System

### Implementation

```css
.editor-container {
  transform: scale(var(--zoom-level, 1));
  transform-origin: top left;
  width: calc(100% / var(--zoom-level, 1));
  height: calc(100% / var(--zoom-level, 1));
}
```

### Zoom Levels

| Level | Scale | Shortcut |
|-------|-------|----------|
| 50%   | 0.5   | -        |
| 60%   | 0.6   | -        |
| 70%   | 0.7   | -        |
| 80%   | 0.8   | -        |
| 90%   | 0.9   | -        |
| **100%** | **1.0** | **Ctrl+0** |
| 110%  | 1.1   | +        |
| 120%  | 1.2   | +        |
| 130%  | 1.3   | +        |
| 140%  | 1.4   | +        |
| 150%  | 1.5   | +        |
| 175%  | 1.75  | +        |
| 200%  | 2.0   | +        |

**Zoom Persistence**: Saved in IndexedDB workspace settings

---

## Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+Enter` | Run code | Global |
| `Ctrl+S` | Save (auto-save trigger) | Global |
| `Ctrl+Shift+E` | Toggle sidebar | Global |
| `Ctrl+Shift+C` | Focus console | Global |
| `Ctrl+0` | Reset zoom | Global |
| `Ctrl++` / `Ctrl+-` | Zoom in/out | Global |
| `Ctrl+W` | Close tab | Editor |
| `Ctrl+Tab` | Next tab | Editor |
| `Ctrl+Shift+Tab` | Previous tab | Editor |
| `Ctrl+P` | Quick open (future) | Global |
| `F11` | Fullscreen (browser) | Global |

---

## Accessibility

- **Color Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Focus Indicators**: Visible 2px outline `var(--vscode-blue)`
- **Keyboard Navigation**: Full app operable without mouse
- **Screen Readers**: ARIA labels on all interactive elements
- **Reduced Motion**: Respects `prefers-reduced-motion`
- **High Contrast**: Additional border emphasis option

---

## Icon System

**Source**: `lucide-react` (tree-shakeable, ~50KB)

| Component | Icon | Size |
|-----------|------|------|
| File (TS) | `FileCode` | 16px |
| File (JS) | `FileCode` | 16px |
| File (JSON) | `FileJson` | 16px |
| File (CSS) | `FileCode` | 16px |
| File (HTML) | `FileCode` | 16px |
| Folder | `Folder` / `FolderOpen` | 16px |
| Run | `Play` | 16px |
| Stop | `Square` | 16px |
| Sidebar | `Layout` / `X` | 16px |
| Zoom | `ZoomIn` / `ZoomOut` | 16px |
| Error | `AlertCircle` | 16px |
| Warning | `AlertTriangle` | 16px |
| Network | `Globe` | 16px |
| Clear | `Trash2` | 16px |
| Copy | `Copy` | 16px |
| Download | `Download` | 16px |
| Add Package | `PackagePlus` | 16px |

---

## Animations & Transitions

| Element | Transition | Duration | Easing |
|---------|------------|----------|--------|
| Sidebar collapse | width | 200ms | ease-out |
| Console resize | grid-template-rows | 100ms | ease-out |
| Tab hover | background | 80ms | ease |
| Button hover | background | 80ms | ease |
| Run button (running) | spinner rotation | 1s | linear |
| Log entry appear | opacity + translateY | 150ms | ease-out |
| Tooltip show | opacity | 100ms | ease |

**Respects**: `@media (prefers-reduced-motion: reduce)`

---

## Empty States

### No Files
```
┌────────────────────────────────────┐
│                                    │
│        📁 No files yet             │
│                                    │
│   [Create First File]              │
│                                    │
└────────────────────────────────────┘
```

### Console Empty
```
┌────────────────────────────────────┐
│                                    │
│     ▶ Run code to see output       │
│                                    │
└────────────────────────────────────┘
```

### Execution Error
```
┌────────────────────────────────────┐
│ ❌ Execution Error                 │
│                                    │
│ ReferenceError: foo is not defined │
│ at main.ts:5:13                    │
│                                    │
└────────────────────────────────────┘
```

---

## Loading States

| State | Indicator |
|-------|-----------|
| App loading | Skeleton grid (shimmer) |
| Monaco loading | "Loading editor..." in editor pane |
| TS worker loading | Small spinner in status bar |
| QuickJS WASM loading | Background, no UI block |
| Package fetch | Inline spinner in import line |
| Execution running | Spinner in run button + "Running..." |

---

## Responsive Behavior

### Mobile (< 768px) - Future Consideration
- Sidebar: Drawer (slide from left)
- Tabs: Horizontally scrollable
- Console: Bottom sheet (50vh default)
- Header: Compact (28px)
- Touch: Larger hit targets (44px)

### Tablet (768-1024px)
- Sidebar: 200px default
- Console: 180px default
- All features available

### Desktop (> 1024px)
- Full spec as documented
- Multi-monitor: Remember window size