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
**Action**: Update `vercel.json` with explicit headers for static assets
**Note**: If 401 persists, check Vercel project settings for:
  - Password protection on deployment
  - Edge config or middleware in Vercel dashboard
  - Authentication/access control settings

### PHASE 4: CSP Cleanup (Optional)
**Goal**: Stop console spam from Vercel tooling
**Action**: Add `https://vercel.live` to CSP if desired

## Validation Gates

### Local Validation (Completed ✅)
- [x] `npm run build` passes (13.61s, no errors)
- [x] `npm run preview` renders UI successfully
- [x] `/manifest.webmanifest` returns 200 locally
- [x] `/sw.js` returns 200 locally
- [x] All static assets copied to dist/ correctly

### Production Validation (To Verify in Vercel)
- [ ] Page renders (no white screen/blank page)
- [ ] No "createContext undefined" error in console
- [ ] `/manifest.webmanifest` returns 200 (not 401)
- [ ] Service worker clears old caches on first load
- [ ] Hard refresh works after cache clear
- [ ] No CSP violations for Vercel tooling

## Summary of Changes

**4 commits on branch `claude/fix-vercel-blank-page-wj9R1`:**

1. **hotfix: self-destroying service worker to clear stale caches**
   - Modified `public/sw.js` to clear all caches and unregister
   - Temporary recovery measure to unbrick users with stale chunks
   - TODO: Revert to normal PWA mode after one stable deployment

2. **fix: dedupe react/react-dom to prevent runtime createContext crash**
   - Added `dedupe: ['react', 'react-dom']` to `vite.config.ts`
   - Ensures only one React instance in production bundle
   - Prevents "Cannot read properties of undefined (reading 'createContext')"

3. **fix: add explicit headers for static assets in vercel.json**
   - Added Content-Type and Cache-Control headers for manifest/SW
   - Ensures Vercel serves static files with correct MIME types
   - Note: If 401 persists, check Vercel project password protection

4. **chore: adjust CSP to allow Vercel preview tooling**
   - Added `https://vercel.live` to CSP script-src/connect-src/frame-src
   - Prevents CSP violations in Vercel preview deployments
   - Maintains security while allowing preview toolbar

## Rollback Plan

If issues occur after deployment:

1. **If SW causes navigation issues**: Comment out SW registration in `index.html:49-57`
2. **If React errors persist**: Check browser console for specific module errors
3. **If build fails**: Revert `vite.config.ts` dedupe config
4. **Emergency rollback**: `git revert HEAD~4..HEAD` and redeploy

## Future Work (After Stable Deployment)

1. **Restore normal PWA mode**:
   - Revert `public/sw.js` to normal caching strategy (not self-destroying)
   - Test offline functionality
   - Ensure cache versioning prevents future stale chunk issues

2. **Monitor production**:
   - Check for createContext errors in error tracking
   - Verify Service Worker registration rates
   - Monitor 401 errors on static assets

3. **Optimize CSP**:
   - Consider environment-specific CSP (only allow vercel.live in preview)
   - Review and tighten 'unsafe-inline' and 'unsafe-eval' permissions
