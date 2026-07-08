# NPM Packages & Import Maps

## Overview

Users can import NPM packages directly in their code using bare import specifiers. These are resolved via [Import Maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) pointing to [esm.sh](https://esm.sh) CDN.

---

## How It Works

### 1. Import Map in HTML

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.2.0",
    "lodash": "https://esm.sh/lodash@4.17.21"
  }
}
</script>
```

### 2. User Code

```typescript
import { useState } from 'react';
import _ from 'lodash';

const [count, setCount] = useState(0);
console.log(_.capitalize('hello world'));
```

### 3. Resolution Flow

```
User code import
    ↓
Import map lookup
    ↓
esm.sh CDN fetch
    ↓
ESM module returned
```

---

## Pre-configured Packages

These packages are available by default:

```typescript
// lib/importmap.ts
export const defaultImportMap: Record<string, string> = {
  // React ecosystem
  'react': 'https://esm.sh/react@18.2.0',
  'react/': 'https://esm.sh/react@18.2.0/',
  'react-dom': 'https://esm.sh/react-dom@18.2.0',
  'react-dom/': 'https://esm.sh/react-dom@18.2.0/',
  'react/jsx-runtime': 'https://esm.sh/react@18.2.0/jsx-runtime',
  
  // Utilities
  'lodash': 'https://esm.sh/lodash@4.17.21',
  'lodash-es': 'https://esm.sh/lodash-es@4.17.21',
  'clsx': 'https://esm.sh/clsx@2.0.0',
  'tailwind-merge': 'https://esm.sh/tailwind-merge@2.0.0',
  'class-variance-authority': 'https://esm.sh/class-variance-authority@0.7.0',
  
  // HTTP
  'axios': 'https://esm.sh/axios@1.6.0',
  
  // Validation
  'zod': 'https://esm.sh/zod@3.22.0',
  
  // Dates
  'date-fns': 'https://esm.sh/date-fns@3.0.0',
  'date-fns/': 'https://esm.sh/date-fns@3.0.0/',
  
  // Utilities
  'uuid': 'https://esm.sh/uuid@9.0.0',
  'nanoid': 'https://esm.sh/nanoid@5.0.0',
  
  // State management
  'zustand': 'https://esm.sh/zustand@4.4.0',
  'zustand/': 'https://esm.sh/zustand@4.4.0/',
  
  // Debugging
  'debug': 'https://esm.sh/debug@4.3.0',
};
```

---

## Adding Custom Packages

### UI Flow

1. User clicks "Add Package" in sidebar
2. Modal opens with search input
3. User types package name (e.g., "immer")
4. System queries esm.sh registry
5. Shows search results with versions
6. User selects package
7. Package added to import map
8. TypeScript definitions loaded
9. User can now import in code

### Implementation

```typescript
// lib/importmap.ts
export function addPackageToImportMap(
  currentMap: Record<string, string>,
  packageName: string,
  version?: string
): Record<string, string> {
  const versionStr = version ? `@${version}` : '';
  return {
    ...currentMap,
    [packageName]: `https://esm.sh/${packageName}${versionStr}`,
    [`${packageName}/`]: `https://esm.sh/${packageName}${versionStr}/`,
  };
}

export function removePackageFromImportMap(
  currentMap: Record<string, string>,
  packageName: string
): Record<string, string> {
  const newMap = { ...currentMap };
  delete newMap[packageName];
  delete newMap[`${packageName}/`];
  return newMap;
}
```

---

## esm.sh Configuration

### Options

```typescript
// Package with specific options
const options = {
  // Pin version for stability
  pin: 'v135',
  
  // Bundle mode (combine all deps)
  bundle: true,
  
  // Target environment
  target: 'es2022',
  
  // External dependencies (don't bundle)
  external: ['react', 'react-dom'],
  
  // CSS injection
  css: true,
  
  // Development mode
  dev: false,
};
```

### URL Format

```
https://esm.sh/{package}@{version}/{path}?{options}
```

Examples:
- `https://esm.sh/react@18.2.0` - React
- `https://esm.sh/lodash@4.17.21` - Lodash
- `https://esm.sh/date-fns@3.0.0/format` - date-fns subpath
- `https://esm.sh/react@18.2.0/jsx-runtime` - React JSX runtime

---

## TypeScript Types

### Auto-typings

Types are automatically loaded via `monaco-editor-auto-typings`:

```typescript
import { AutoTypings, LocalStorageCache } from 'monaco-editor-auto-typings';

// Initialize on editor mount
const autoTypings = await AutoTypings.create(editor, {
  sourceCache: new LocalStorageCache(),
});
```

### How It Works

1. User writes `import { x } from 'lodash'`
2. Auto-typings detects the import
3. Fetches `@types/lodash` from esm.sh
4. Adds type definitions to Monaco
5. IntelliSense now works for lodash

### Caching

Types are cached in localStorage:
- Key: `monaco-autotypings-cache`
- TTL: 7 days
- Size limit: 10MB

---

## Package Search API

### esm.sh Registry

```typescript
// lib/packages.ts
interface PackageSearchResult {
  name: string;
  description: string;
  version: string;
  downloads: number;
}

async function searchPackages(query: string): Promise<PackageSearchResult[]> {
  const response = await fetch(
    `https://esm.sh/packages?q=${encodeURIComponent(query)}&limit=10`
  );
  return response.json();
}

// Example: searchPackages('lodash')
// Returns: [{ name: 'lodash', description: '...', version: '4.17.21', ... }]
```

---

## Package Categories

### UI Frameworks

| Package | Version | Description |
|---------|---------|-------------|
| react | 18.2.0 | UI library |
| react-dom | 18.2.0 | React DOM renderer |
| preact | 10.19.0 | Alternative React |
| lit | 3.1.0 | Web components |
| vue | 3.4.0 | Vue.js |

### State Management

| Package | Version | Description |
|---------|---------|-------------|
| zustand | 4.4.0 | Lightweight state |
| jotai | 2.6.0 | Atomic state |
| recoil | 0.7.7 | Facebook state |
| valtio | 1.12.0 | Proxy-based state |

### Utilities

| Package | Version | Description |
|---------|---------|-------------|
| lodash | 4.17.21 | General utilities |
| lodash-es | 4.17.21 | ES module version |
| date-fns | 3.0.0 | Date utilities |
| dayjs | 1.11.0 | Date library |
| uuid | 9.0.0 | UUID generation |
| nanoid | 5.0.0 | ID generation |
| clsx | 2.0.0 | Class names |
| tailwind-merge | 2.0.0 | Tailwind classes |

### HTTP Clients

| Package | Version | Description |
|---------|---------|-------------|
| axios | 1.6.0 | Promise-based HTTP |
| ky | 1.0.0 | Tiny HTTP client |
| got | 14.0.0 | HTTP requests |

### Validation

| Package | Version | Description |
|---------|---------|-------------|
| zod | 3.22.0 | Schema validation |
| yup | 1.3.0 | Object schema |
| joi | 17.11.0 | Data validation |
| superstruct | 1.0.0 | Struct validation |

### Math/Data

| Package | Version | Description |
|---------|---------|-------------|
| mathjs | 12.0.0 | Math library |
| decimal.js | 10.4.0 | Decimal math |
| big.js | 6.2.0 | Arbitrary precision |

---

## Import Map Persistence

The import map is saved in the workspace:

```typescript
// In Workspace interface
interface Workspace {
  // ...
  importMap: Record<string, string>;
  // ...
}
```

Changes to the import map are:
- Saved immediately (no debounce)
- Exported with workspace download
- Imported when workspace is loaded

---

## Security Considerations

### What's Allowed

- Fetching packages from esm.sh CDN
- Caching packages in browser
- Loading TypeScript definitions

### What's Blocked

- Running package code outside QuickJS sandbox
- Accessing host globals from packages
- Making arbitrary network requests (only esm.sh)

### Package Vetting

- Only public packages from npm registry
- No private/enterprise packages
- Version pinning for stability
- No post-install scripts (CDN only)

---

## Troubleshooting

### Package Not Found

```typescript
// Error: "Cannot find module 'xyz-package'"
// Solution: Add package via UI or check spelling
```

### CORS Error

```typescript
// Error: "Failed to fetch" or CORS error
// Solution: esm.sh should work, check network
```

### Type Error

```typescript
// Error: "Could not find declaration file for 'xyz-package'"
// Solution: Auto-typings may not have loaded yet
// Wait or manually add @types/xyz-package
```

### Version Conflict

```typescript
// Error: "Multiple versions of React detected"
// Solution: Use external in import map
{
  "imports": {
    "react": "https://esm.sh/react@18.2.0",
    "react-dom": "https://esm.sh/react-dom@18.2.0?external=react"
  }
}
```