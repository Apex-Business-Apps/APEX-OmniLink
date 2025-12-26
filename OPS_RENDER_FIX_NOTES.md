# OPS RENDER FIX NOTES

## Symptoms (Production Console)
1. **CRITICAL**: `Uncaught TypeError: Cannot read properties of undefined (reading 'createContext')` in vendor chunk
2. Service Worker registered successfully (may be serving stale cached chunks)
3. `/manifest.webmanifest` returns 401 (public asset incorrectly protected)
4. CSP blocks `https://vercel.live` live-feedback script (non-blocking, Vercel tooling only)

## PHASE 0 - Triage & Repro (2025-12-26)

### Commands Run
```bash
npm ci                # ✓ Installed 501 packages, 0 vulnerabilities
npm ls react react-dom # ✓ All react@18.3.1 deduped, no duplicates
npm run build         # ✓ Build succeeded in 13.35s
npm run preview       # ✓ Preview server started on http://localhost:4173/
curl localhost:4173/manifest.webmanifest  # ✓ HTTP 200
curl localhost:4173/sw.js                 # ✓ HTTP 200
```

### Findings

#### ✅ LOCAL BUILD WORKS
- Build completes successfully
- Preview server renders UI correctly
- Static assets (manifest, SW) return HTTP 200
- **No createContext error locally**

#### ⚠️ ROOT CAUSE ANALYSIS

**1. React createContext Error (Production Only)**
- **Cause**: Missing `dedupe: ['react', 'react-dom']` in `vite.config.ts` resolve section
- **Why it works locally**: Fresh build with no cached chunks
- **Why it fails in production**: Service Worker serving old/mismatched React chunks from previous deploy
- **Fix**: Add dedupe config + clear service worker cache

**2. 401 on Static Assets (Production Only)**
- **Cause**: `vercel.json` has catch-all rewrite `"source": "/(.*)" → "/index.html"`
- **Local**: Vite preview serves static assets from `public/` correctly
- **Vercel**: Catch-all may be hitting index.html for ALL routes including static assets
- **Fix**: Exclude static paths from catch-all rewrite OR ensure Vercel serves `public/` assets first

**3. CSP Blocks Vercel Tooling**
- **Cause**: `index.html:32` CSP `script-src` missing `https://vercel.live`
- **Impact**: Low (only affects Vercel preview toolbar, not rendering)
- **Fix**: Add `https://vercel.live` to `script-src` and `connect-src`

#### 📋 CODE STRUCTURE
- **SW**: Manual implementation in `public/sw.js` (NOT vite-plugin-pwa)
  - Cache name: `omnilink-v2`
  - Strategy: Network-first with cache fallback
  - Registration: `index.html:49-57`
- **Vite**: React SWC, manual code splitting, NO dedupe config
- **Vercel**: SPA catch-all rewrite, security headers only

## Next Steps

### PHASE 1: Self-Destroying Service Worker (Unbrick Cache)
**Goal**: Clear stale caches on next deploy
**Action**: Modify `public/sw.js` to unregister itself on activate (temporary recovery measure)

### PHASE 2: Dedupe React/ReactDOM
**Goal**: Prevent multiple React instances in bundle
**Action**: Add `resolve: { dedupe: ['react', 'react-dom'] }` to `vite.config.ts`

### PHASE 3: Fix 401 on Static Assets
**Goal**: Ensure manifest/SW/assets are publicly accessible
**Action**: Update `vercel.json` to exclude static paths from catch-all rewrite

### PHASE 4: CSP Cleanup (Optional)
**Goal**: Stop console spam from Vercel tooling
**Action**: Add `https://vercel.live` to CSP if desired

## Validation Gates
- [ ] `npm run build` passes
- [ ] `npm run preview` renders UI with no console errors
- [ ] `/manifest.webmanifest` returns 200 in Vercel preview
- [ ] Hard refresh works (SW doesn't break navigation)
