# APEX OmniHub Marketing Site

> Static-first marketing site for apexomnihub.icu featuring White Fortress (default) and Night Watch (toggle) themes.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](./LICENSE)

## Overview

A static multi-page application (MPA) built for maximum portability and security. No external dependencies, no Google Fonts, no analytics—just clean, fast, secure HTML/CSS/JS.

### Key Features

- **Static-First Architecture**: 5 HTML entry points, works on any static host
- **Zero External Dependencies**: Self-hosted fonts, no third-party scripts
- **Security-Hardened**: A+ security headers, strict CSP, HSTS preload ready
- **Theme Toggle**: White Fortress (light) ↔ Night Watch (dark)
- **Anti-Abuse Protection**: Honeypot, timing check, rate limiting
- **Optional Backend**: Feature-flagged Supabase integration

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
│   ├── components/     # Reusable UI components
│   ├── content/        # Centralized content configuration
│   ├── pages/          # Page components
│   ├── styles/         # CSS (theme + components)
│   └── *.tsx           # Entry points per page
├── public/             # Static assets
├── docs/               # Documentation
├── supabase/           # Database migrations
├── scripts/            # Build/test scripts
└── *.html              # HTML entry points
```

## Pages

| Route | Description | SEO |
|-------|-------------|-----|
| `/` | Landing page with hero, features, proof modules | index |
| `/demo.html` | Demo video/interactive placeholders | index |
| `/tech-specs.html` | Technical specifications and architecture | index |
| `/request-access.html` | Early access request form | index |
| `/restricted.html` | Restricted area fallback | noindex |

## Themes

### White Fortress (Default)
Premium, high-whitespace design with crisp typography. Engineer-focused aesthetic with subtle grid texture.

### Night Watch (Toggle)
Control-room aesthetic with restrained dark palette. No neon—professional and readable.

Toggle via the **[ WHITE FORTRESS ] [ NIGHT WATCH ]** segmented control in navigation. Preference persists in localStorage.

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

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: React hooks + TypeScript rules
- **JSDoc**: All public functions documented
- **Accessibility**: ARIA labels, semantic HTML

### Testing

Smoke tests verify all pages contain expected content:

```bash
npm run build && npm run smoke
```

## Deployment

### Vercel (Recommended)

```bash
# From repo root
vercel --cwd apps/omnihub-site
```

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
| Total JS (gzipped) | < 100 KB | ~95 KB |
| Total CSS (gzipped) | < 5 KB | ~3.4 KB |
| LCP | < 2.5s | < 1s |
| FID | < 100ms | < 50ms |

## Contributing

1. Run `npm run typecheck && npm run lint` before committing
2. Ensure `npm run smoke` passes after build
3. Update `src/content/site.ts` for copy changes
4. Document security implications of any CSP changes

## License

Proprietary - APEX Business Systems
