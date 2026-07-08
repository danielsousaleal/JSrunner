# Build Configuration

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 24+ | Runtime |
| npm / pnpm / yarn | Latest | Package manager |
| Git | Latest | Version control |

---

## Project Setup

```bash
# Create Next.js project
npx create-next-app@latest js-runner \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --turbopack

cd js-runner
```

## Dependencies

### Core Dependencies

```bash
# Editor
npm install @monaco-editor/react monaco-editor

# Execution Engine (QuickJS WASM)
npm install quickjs-emscripten-core @jitl/quickjs-ng-wasmfile-release-sync

# State & Persistence
npm install zustand idb

# UI
npm install lucide-react clsx tailwind-merge class-variance-authority

# Auto-typings for Monaco
npm install monaco-editor-auto-typings

# Build utilities
npm install -D raw-loader
```

### shadcn/ui Setup

```bash
npx shadcn@latest init
npx shadcn@latest add button tabs tooltip input dropdown-menu scroll-area context-menu separator
```

### Font Setup

```bash
# JetBrains Mono (code font)
# Add to app/layout.tsx via next/font/google
```

---

## next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },

  experimental: {
    optimizePackageImports: [
      '@monaco-editor/react',
      'lucide-react',
      'zustand',
    ],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Monaco Web Workers
      config.module.rules.push({
        test: /\.worker\.(js|ts)$/,
        use: {
          loader: 'worker-loader',
          options: {
            filename: 'static/workers/[name].[contenthash].js',
            publicPath: '/_next/',
          },
        },
      });
    }

    // WebAssembly support (QuickJS WASM)
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle Monaco CSS imports
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // Ignore Monaco warnings
    config.ignoreWarnings = [
      { module: /monaco-editor/, message: /Critical dependency/ },
    ];

    return config;
  },
};

module.exports = nextConfig;
```

## vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "out",
  "framework": "nextjs",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    },
    {
      "source": "/wasm/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        },
        {
          "key": "Content-Type",
          "value": "application/wasm"
        }
      ]
    },
    {
      "source": "/_next/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## WASM File Handling

### Copy QuickJS WASM to public/

```bash
# Add to package.json scripts
"postinstall": "cp node_modules/@jitl/quickjs-ng-wasmfile-release-sync/dist/quickjs-ng.wasm public/wasm/quickjs.wasm"
```

Or use a build script:

```javascript
// scripts/copy-wasm.js
const fs = require('fs');
const path = require('path');

const src = path.join(
  __dirname,
  '../node_modules/@jitl/quickjs-ng-wasmfile-release-sync/dist/quickjs-ng.wasm'
);
const dest = path.join(__dirname, '../public/wasm/quickjs.wasm');

if (!fs.existsSync(path.dirname(dest))) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
}

fs.copyFileSync(src, dest);
console.log('WASM copied to public/wasm/quickjs.wasm');
```

```json
// package.json scripts
{
  "scripts": {
    "copy-wasm": "node scripts/copy-wasm.js",
    "prebuild": "npm run copy-wasm",
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## Build Size Analysis

### Expected Bundle Sizes

| Asset | Size (gzipped) | Notes |
|-------|----------------|-------|
| Main JS bundle | ~50KB | Next.js + React + Tailwind |
| Monaco (lazy) | ~3MB | Dynamic import, loaded on demand |
| Monaco TS Worker | ~10MB | Loaded on first .ts/.tsx file |
| QuickJS WASM | ~2MB | Preloaded in background |
| QuickJS JS glue | ~50KB | Worker runtime |
| Total (first load) | ~100KB | Before Monaco loads |
| Total (full app) | ~15MB | Everything loaded |

### Optimization Strategies

1. **Code Splitting**: Monaco loaded via `next/dynamic`
2. **Tree Shaking**: lucide-react, zustand, clsx
3. **Gzip/Brotli**: Vercel compresses automatically
4. **Static Export**: No server overhead
5. **CDN Cache**: Immutable assets cached 1 year

---

## Development Workflow

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run start

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Copy WASM (manual if needed)
npm run copy-wasm
```

---

## Common Build Issues & Fixes

### Monaco CSS not loading

```javascript
// Add to tailwind.config.ts
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  // Prevent PurgeCSS from stripping Monaco styles
  safelist: [
    { pattern: /monaco-editor/ },
  ],
};
```

### Worker bundling errors

```javascript
// If worker-loader fails, use Vite-style approach
// next.config.js
const nextConfig = {
  webpack: (config) => {
    // Alternative: inline workers
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      use: {
        loader: 'worker-loader',
        options: {
          inline: 'fallback',
        },
      },
    });
    return config;
  },
};
```

### WASM not found at runtime

```bash
# Ensure WASM is in public/wasm/
ls -la public/wasm/quickjs.wasm

# Verify path in code
# Should be: /wasm/quickjs.wasm (relative to public root)
```

### COOP/COEP blocking resources

```json
// In vercel.json, relax for specific paths if needed
{
  "headers": [
    {
      "source": "/wasm/(.*)",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
```

---

## Testing Checklist

- [ ] `npm run build` succeeds with no errors
- [ ] `npm run start` serves the app
- [ ] Monaco editor loads and shows code
- [ ] TypeScript IntelliSense works
- [ ] QuickJS WASM loads (check Network tab)
- [ ] Console.log output appears
- [ ] Multi-file tabs work
- [ ] Auto-save persists to IndexedDB
- [ ] Download workspace works
- [ ] Zoom in/out works
- [ ] Responsive on 768px width
- [ ] Lighthouse score > 80