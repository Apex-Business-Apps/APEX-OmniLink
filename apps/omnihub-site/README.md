# APEX OmniHub Marketing Site

> Static-first marketing site for apexomnihub.icu featuring White Fortress (default) and Night Watch (toggle) themes.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](./LICENSE)

## Overview

A static multi-page application (MPA) built for maximum portability and security. No external dependencies, no Google Fonts, no analytics—just clean, fast, secure HTML/CSS/JS.

### Key Features

- **Static-First Architecture**: 7 HTML entry points, works on any static host
- **Zero External Dependencies**: Self-hosted fonts, no third-party scripts
- **Security-Hardened**: A+ security headers, strict CSP, HSTS preload ready
- **Theme Toggle**: White Fortress (light) ↔ Night Watch (dark)
- **Responsive Navigation**: Burger menu controls nav links on mobile; login moves to the drawer footer
- **Anti-Abuse Protection**: Honeypot, timing check, rate limiting
- **Optional Backend**: Feature-flagged Supabase integration
- **Pixel-Perfect Dev Mode**: Reference overlay for design alignment

## Quick Start

```bash
# Navigate to site directory
cd apps/omnihub-site

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run smoke tests
npm run smoke
```

## Architecture

```
apps/omnihub-site/
├── src/
│   ├── components/     # UI components (13 files)
│   │   ├── Layout.tsx          # Nav + Footer wrapper, burger menu, theme toggle
│   │   ├── ReferenceOverlay.tsx # Dev-only pixel alignment overlay
│   │   ├── HeroVisual.tsx      # Central hub visual with orbiting icons
│   │   ├── FeatureHighlightGrid.tsx  # 3-column feature cards
│   │   ├── ShowcaseStrip.tsx   # 4-column image showcase
│   │   ├── CTAGroup.tsx        # Button group (primary/secondary)
│   │   ├── Section.tsx         # Section container with variants
│   │   ├── ProofGrid.tsx       # Verification metrics tiles
│   │   ├── Steps.tsx           # How-it-works step cards
│   │   ├── FortressList.tsx    # Zero-trust principles list
│   │   ├── SignalTrace.tsx     # Animated SVG background
│   │   └── Stamp.tsx           # Brand tagline display
│   ├── content/        # Centralized content (site.ts)
│   ├── pages/          # Page components (7 pages)
│   │   ├── Home.tsx            # Landing page with all sections
│   │   ├── Demo.tsx            # Demo showcase
│   │   ├── TechSpecs.tsx       # Technical specifications
│   │   ├── RequestAccess.tsx   # Early access form
│   │   ├── Restricted.tsx      # Authorization required
│   │   ├── Privacy.tsx         # Privacy Policy
│   │   └── Terms.tsx           # Terms of Service
│   ├── styles/         # CSS (theme.css + components.css)
│   └── *.tsx           # Entry points per page
├── public/             # Static assets (images, favicon)
│   ├── assets/         # Hero images (light/night variants)
│   ├── apex-omnihub-icon.png     # App icon referenced by index.html
│   ├── apex-omnihub-wordmark.png # Header wordmark image
│   └── reference/      # Design reference images (dev only)
├── docs/               # Security headers documentation
├── tests/              # Visual regression tests (Playwright)
├── scripts/            # Build/test scripts
└── *.html              # HTML entry points (7 pages)
```

## Pages

| Route | Description | Sections |
|-------|-------------|----------|
| `/` | Landing page | Hero, Features, Tri-Force, Orchestrator, Fortress, MAN Mode, Capabilities, CTA |
| `/demo.html` | Demo video/interactive | Video placeholder, Interactive demo |
| `/tech-specs.html` | Technical specifications | 6 spec sections with details |
| `/request-access.html` | Early access form | Form with anti-abuse protection |
| `/restricted.html` | Restricted fallback | Access denied with CTAs |
| `/privacy.html` | Privacy Policy | 10 legal sections |
| `/terms.html` | Terms of Service | 13 legal sections |

## Themes

### White Fortress (Default)
Premium, high-whitespace design with crisp typography. Engineer-focused aesthetic with subtle grid texture.

### Night Watch (Toggle)
Control-room aesthetic with restrained dark palette. No neon—professional and readable.

Toggle via the **[ WHITE FORTRESS ] [ NIGHT WATCH ]** segmented control in navigation. Preference persists in localStorage.

## Branding & Navigation

- **App icon** lives at `public/apex-omnihub-icon.png` and is referenced in `index.html`.
- **Header wordmark** uses `public/apex-omnihub-wordmark.png` in both desktop and mobile nav.
- **Login placement** sits to the right of the theme toggle on desktop, and in the drawer footer on mobile.
- **Burger menu** controls navigation on mobile, replacing inline nav links.
- **Favicon** is consistently referenced as `/apex-omnihub-icon.png` across all HTML entry points.

## Configuration

### Content Configuration

All marketing copy lives in `src/content/site.ts`:

```typescript
// Hero section
siteConfig.hero.title      // "Intelligence Designed"
siteConfig.hero.tagline    // "It Sees You"

// Feature highlights
siteConfig.highlights      // AI-Powered Automation, Smart Integrations, Advanced Analytics

// Navigation
siteConfig.nav.links       // Features, Solutions, Integrations, Pricing
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ENABLE_REQUEST_ACCESS` | No | `true` to enable Supabase |
| `VITE_SUPABASE_URL` | If enabled | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | If enabled | Supabase anonymous key |

### Supabase Integration

The form works without Supabase (falls back to mailto). To enable database storage:

1. **Apply migration**:
   ```bash
   supabase db push
   # Or run: supabase/migrations/20250111000000_create_access_requests.sql
   ```

2. **Set environment variables**:
   ```bash
   VITE_ENABLE_REQUEST_ACCESS=true
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. **Update CSP** (in `vercel.json`):
   ```
   connect-src 'self' https://xxx.supabase.co
   ```

## Security

### Headers (A+ Grade)

All security headers are pre-configured in `vercel.json`. See `docs/headers.md` for:
- IONOS/Apache configuration
- Nginx configuration
- Netlify configuration
- Cloudflare Pages configuration

### Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
```

### Anti-Abuse Measures

| Protection | Description |
|------------|-------------|
| Honeypot | Hidden field traps bots |
| Timing Check | Rejects submissions < 3 seconds |
| Rate Limiting | 5-minute cooldown per browser |
| Input Validation | Strict length limits, sanitization |
| XSS Prevention | No user input rendered as HTML |

### HSTS Preload

Site is configured for HSTS preload. After deployment:
1. Verify at https://hstspreload.org/
2. Submit for preload list inclusion

**Warning**: Preload is essentially permanent. See `docs/headers.md` for details.

## Development

### Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm run typecheck # TypeScript validation
npm run lint      # ESLint check
npm run smoke     # Smoke tests (requires build)
```

### Pixel-Perfect Development Mode

The site includes a reference overlay system for pixel-perfect alignment during development:

```bash
# Enable light theme reference overlay
http://localhost:3000/?ref=light

# Enable dark theme reference overlay
http://localhost:3000/?ref=night
```

**Keyboard Controls:**

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Toggle overlay visibility |
| `Shift+Up` | Increase opacity (+5%) |
| `Shift+Down` | Decrease opacity (-5%) |

**Reference Images:**

Place design reference images in `public/reference/`:
- `home-light.png` - Light theme (White Fortress) reference
- `home-night.png` - Dark theme (Night Watch) reference

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: React hooks + TypeScript rules
- **JSDoc**: All public functions documented
- **Accessibility**: ARIA labels, semantic HTML

### Testing

**Smoke Tests** - Verify all pages contain expected content:

```bash
npm run build && npm run smoke
```

**Visual Regression Tests** - Compare screenshots against baselines:

```bash
npm run test:visual
```

Visual tests check:
- White Fortress theme at 1024x1536
- Night Watch theme at 1196x2048
- Theme toggle functionality

## Deployment

### Vercel (Deprecated)

Vercel deployment is intentionally disabled for this app. The `vercel.json` file remains only
to document security headers and caching behavior, and `.vercelignore` prevents packaging. Use
static hosting instead.

### Static Hosting

```bash
npm run build
# Upload dist/ to any static host
```

### IONOS

1. Build: `npm run build`
2. Upload `dist/` contents to document root
3. Add `.htaccess` from `docs/headers.md`

## Rollback

### Disable Entire Site

```bash
rm -rf apps/omnihub-site
git commit -am "revert: remove marketing site"
```

### Disable Supabase Only

```bash
unset VITE_ENABLE_REQUEST_ACCESS
# Form falls back to mailto
```

### Disable HSTS Preload

Remove `preload` from HSTS header before submitting to preload list.

## Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Total JS (gzipped) | < 100 KB | ~96 KB |
| Total CSS (gzipped) | < 10 KB | ~6.4 KB |
| LCP | < 2.5s | < 1s |
| FID | < 100ms | < 50ms |
| Build Time | < 10s | ~3s |

## Contributing

1. Run `npm run typecheck && npm run lint` before committing
2. Ensure `npm run smoke` passes after build
3. Update `src/content/site.ts` for copy changes
4. Document security implications of any CSP changes

## License

Proprietary - APEX Business Systems
