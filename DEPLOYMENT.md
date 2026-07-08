# Deployment - Vercel

## Overview

JS Runner is deployed as a **static export** to Vercel. There is no server-side code - everything runs in the browser.

---

## Deployment Flow

```
git push
    ↓
Vercel detects push
    ↓
npm run build
    ↓
Static export to /out
    ↓
Deploy to Vercel CDN
    ↓
https://js-runner.vercel.app
```

---

## vercel.json Configuration

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

## Why COOP/COEP Headers?

### Cross-Origin-Opener-Policy: same-origin

- Prevents the page from being referenced by other origins
- Required for `SharedArrayBuffer` (used by QuickJS asyncify)
- Improves security by isolating the browsing context

### Cross-Origin-Embedder-Policy: require-corp

- Requires all cross-origin resources to opt-in via CORP header
- Needed for `SharedArrayBuffer` support
- Prevents leaking data to cross-origin frames

### Impact

| Feature | Without Headers | With Headers |
|---------|-----------------|--------------|
| SharedArrayBuffer | ❌ Disabled | ✅ Enabled |
| QuickJS asyncify | ❌ Won't work | ✅ Works |
| Cross-origin iframes | ✅ Works | ⚠️ Need CORP |
| ES modules from CDN | ✅ Works | ⚠️ Need CORS |

---

## next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export
  output: 'export',
  
  // No image optimization (static)
  images: { unoptimized: true },
  
  // Optimize imports
  experimental: {
    optimizePackageImports: [
      '@monaco-editor/react',
      'lucide-react',
      'zustand',
    ],
  },
  
  // Webpack config
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
    
    // WebAssembly support
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    
    // Fallbacks for Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    
    return config;
  },
};

module.exports = nextConfig;
```

---

## Build Process

### Local Build

```bash
# Copy WASM file
npm run copy-wasm

# Build
npm run build

# Output: /out directory
```

### Build Script

```json
// package.json
{
  "scripts": {
    "copy-wasm": "node scripts/copy-wasm.js",
    "prebuild": "npm run copy-wasm",
    "build": "next build",
    "dev": "next dev --turbopack",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### WASM Copy Script

```javascript
// scripts/copy-wasm.js
const fs = require('fs');
const path = require('path');

const src = path.join(
  __dirname,
  '../node_modules/@jitl/quickjs-ng-wasmfile-release-sync/dist/quickjs-ng.wasm'
);

const dest = path.join(__dirname, '../public/wasm/quickjs.wasm');

const destDir = path.dirname(dest);
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(src, dest);
console.log('✓ WASM copied to public/wasm/quickjs.wasm');
```

---

## Build Output Structure

```
out/
├── index.html                    # Main entry
├── _next/
│   ├── static/
│   │   ├── css/
│   │   │   └── [hash].css        # Tailwind CSS
│   │   ├── js/
│   │   │   ├── main.[hash].js    # Main bundle (~50KB)
│   │   │   └── webpack.[hash].js # Webpack runtime
│   │   └── workers/
│   │       ├── ts.worker.[hash].js    # TypeScript worker (~10MB)
│   │       ├── css.worker.[hash].js   # CSS worker
│   │       ├── json.worker.[hash].js  # JSON worker
│   │       └── editor.worker.[hash].js # Editor worker
│   └── media/
│       └── [hash].woff2          # JetBrains Mono font
├── wasm/
│   └── quickjs.wasm              # QuickJS WASM (~2MB)
└── favicon.ico
```

---

## Performance Optimization

### Bundle Analysis

| Asset | Size (raw) | Size (gzipped) | Load Strategy |
|-------|------------|----------------|---------------|
| Main JS | ~180KB | ~55KB | Initial load |
| CSS | ~25KB | ~5KB | Initial load |
| Monaco (lazy) | ~3MB | ~800KB | Dynamic import |
| TS Worker | ~10MB | ~3MB | On first .ts file |
| QuickJS WASM | ~2MB | ~800KB | Preload after hydration |
| Font | ~100KB | ~50KB | Initial load |
| **Total initial** | **~300KB** | **~110KB** | **< 1s on 3G** |
| **Total full** | **~15MB** | **~5MB** | **< 5s on 3G** |

### Loading Strategy

```typescript
// 1. Initial load: React + Tailwind + font
// 2. After hydration: Preload QuickJS WASM
// 3. On first .ts/.tsx file: Load Monaco + TS worker
// 4. On first import: Load auto-typings
```

---

## Custom Domain

### Setup

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add custom domain: `jsrunner.dev`
3. Configure DNS:
   - Type: CNAME
   - Name: `@` or `jsrunner`
   - Value: `cname.vercel-dns.com`
4. Wait for SSL certificate (automatic)

### DNS Records

```
Type    Name    Value                  TTL
CNAME   @       cname.vercel-dns.com   600
A       @       76.76.21.21            600
```

---

## Environment Variables

### No Environment Variables Needed

JS Runner runs entirely client-side. No API keys, no secrets.

### Optional Variables

```bash
# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Error tracking (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Monitoring

### Vercel Analytics

Enable in Dashboard → Project → Settings → Analytics

### Core Web Vitals

| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2s | Static export, CDN |
| FID | < 100ms | No blocking scripts |
| CLS | < 0.1 | Fixed layout grid |
| INP | < 200ms | Debounced saves |

### Performance Budget

```json
{
  "budgets": [
    {
      "path": "/",
      "maximumWarning": "200kb",
      "maximumError": "500kb"
    },
    {
      "path": "/_next/static/js/*.js",
      "maximumWarning": "100kb",
      "maximumError": "200kb"
    }
  ]
}
```

---

## Troubleshooting

### Build Fails

```bash
# Check Node version
node -v  # Should be 20+

# Clear cache
rm -rf .next node_modules
npm install

# Try build again
npm run build
```

### WASM Not Found

```bash
# Ensure WASM was copied
ls -la public/wasm/

# If missing, run manually
npm run copy-wasm
```

### COOP/COEP Errors

```
# If SharedArrayBuffer not available:
# Check vercel.json headers are correct
# Ensure Cross-Origin-Opener-Policy: same-origin
# Ensure Cross-Origin-Embedder-Policy: require-corp
```

### Monaco Workers Not Loading

```javascript
// Check worker paths in browser Network tab
// Should be: /_next/static/workers/ts.worker.xxx.js
// Not: https://cdn.jsdelivr.net/...
```

---

## Deployment Checklist

- [ ] `npm run build` succeeds
- [ ] `public/wasm/quickjs.wasm` exists
- [ ] `vercel.json` has COOP/COEP headers
- [ ] Monaco loads in production
- [ ] TypeScript IntelliSense works
- [ ] QuickJS WASM loads (check Network tab)
- [ ] Console output works
- [ ] IndexedDB persists across reload
- [ ] Export/Import works
- [ ] Zoom works
- [ ] Lighthouse score > 80