# CI Runtime Gates

> **Purpose:** Ensure that a "green build" guarantees the deployed site actually renders and critical assets are accessible.

## Problem Statement

We previously experienced a production deployment that:
- Passed all builds and type checks
- Deployed successfully to Vercel
- **Rendered a completely blank page**

Root causes identified:
1. `Uncaught TypeError` reading `createContext` (React version duplication)
2. `/manifest.webmanifest` returning `401 Unauthorized`
3. Service Worker caching stale/broken chunks (PWA cache poisoning)

## Solution: Runtime Validation Gates

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CI PIPELINE                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 1: Static Analysis                                                │
│  ├─ npm run typecheck        → TypeScript compilation                   │
│  ├─ npm run lint             → ESLint rules                             │
│  └─ npm run check:react      → React singleton validation               │
│                                                                          │
│  PHASE 2: Unit Tests                                                     │
│  └─ npm test                 → Vitest unit tests                        │
│                                                                          │
│  PHASE 3: Build                                                          │
│  └─ npm run build            → Vite production build                    │
│                                                                          │
│  PHASE 4: Runtime Smoke Tests (NEW)                                      │
│  ├─ npm run test:assets      → Static asset 200 checks                  │
│  └─ npm run test:e2e         → Playwright render validation             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Gate Details

### 1. React Singleton Check (`npm run check:react`)

**What it catches:**
- Multiple versions of `react` in dependency tree
- Multiple versions of `react-dom` in dependency tree
- React/ReactDOM version mismatches

**Why it matters:**
- Multiple React instances cause "Invalid hook call" errors
- `createContext` fails when components use different React copies
- Results in completely broken renders (blank pages)

**How it works:**
```bash
npm ls react react-dom --json
# Parses dependency tree, fails if >1 version found
```

**Fix if it fails:**
```bash
npm dedupe
# or investigate conflicting peer dependencies
```

---

### 2. Static Asset Check (`npm run test:assets`)

**What it catches:**
- `manifest.webmanifest` returning 401/403
- Missing favicon
- JS/CSS bundles not accessible

**Why it matters:**
- 401 on manifest breaks PWA installation
- Missing assets cause runtime failures
- Indicates deployment auth misconfiguration

**Assets checked:**
| Asset | Expected | Failure Impact |
|-------|----------|----------------|
| `/manifest.webmanifest` | 200 | PWA broken, console errors |
| `/favicon.ico` | 200 | Browser tab icon missing |
| `/assets/js/*.js` | 200 | App won't load |
| `/assets/css/*.css` | 200 | App unstyled/broken |

---

### 3. Playwright Render Tests (`npm run test:e2e`)

**What it catches:**
- React hydration failures
- Chunk loading errors
- Fatal console errors during render
- Blank page deployments

**Tests included:**

| Test | Purpose |
|------|---------|
| `app shell renders` | Validates `[data-testid="app-shell"]` appears |
| `no fatal console errors` | Catches `createContext`, `ChunkLoadError` |
| `app has content` | Ensures page isn't blank |
| `no React duplication errors` | Catches "Invalid hook call" at runtime |
| `health page loads` | Canary page for basic render |
| `auth page loads` | Complex page with forms |

**Console errors that fail the build:**
- `createContext`
- `Cannot read properties of undefined`
- `ChunkLoadError`
- `Loading chunk`
- `Failed to fetch dynamically imported module`
- `Invalid hook call`
- `multiple copies of React`

---

## Running Locally

```bash
# 1. Build the app
npm run build

# 2. Start preview server
npm run preview -- --port 4173

# 3. In another terminal, run the gates
export BASE_URL=http://localhost:4173
npm run check:react
npm run test:assets
npm run test:e2e

# Or all at once (after preview is running):
npm run ci:runtime-gates
```

---

## CI Workflow

The `.github/workflows/ci-runtime-gates.yml` workflow:

1. **Runs on:** Push to main/master, PRs, manual trigger
2. **Timeout:** 15 minutes total
3. **Stages:**
   - Install & type check
   - React singleton validation
   - Unit tests
   - Production build
   - Start preview server
   - Asset access tests
   - Playwright render tests
4. **Artifacts on failure:** Playwright report + screenshots

### Preview URL Testing (Bonus)

If Vercel preview is available, the workflow also runs tests against the deployed preview URL to catch environment-specific issues.

---

## Adding New Checks

### New Asset Check
Edit `tests/smoke/assets-check.mjs`:
```javascript
const criticalAssets = [
  { path: '/manifest.webmanifest', description: 'PWA Manifest' },
  { path: '/new-asset.json', description: 'New Critical Asset' },  // Add here
];
```

### New Render Check
Edit `tests/e2e-playwright/render.spec.ts`:
```typescript
test('new page renders', async ({ page }) => {
  await page.goto('/new-page');
  await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
});
```

---

## Troubleshooting

### "React singleton check failed"
```bash
# See full dependency tree
npm ls react react-dom --all

# Deduplicate
npm dedupe

# If a specific package is the culprit
npm why react
```

### "Asset check failed with 401"
- Check Vercel authentication settings
- Ensure assets aren't behind auth middleware
- Verify `vercel.json` headers configuration

### "Playwright test timed out"
- Increase timeout in `playwright.config.ts`
- Check if preview server is running
- Verify `BASE_URL` environment variable

---

## Related Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright configuration |
| `tests/e2e-playwright/render.spec.ts` | Render smoke tests |
| `tests/smoke/assets-check.mjs` | Asset access validation |
| `scripts/check-react-singleton.mjs` | React version checker |
| `.github/workflows/ci-runtime-gates.yml` | CI workflow |

---

## Success Criteria

A deployment is considered **safe** when:

- [x] TypeScript compiles without errors
- [x] Only one React version in dependency tree
- [x] All critical assets return 200
- [x] App shell renders within 15 seconds
- [x] No fatal console errors during render
- [x] Page content is not blank

If any check fails, the PR/push is blocked until fixed.
