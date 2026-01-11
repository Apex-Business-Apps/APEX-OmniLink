# APEX OmniHub Marketing Site

Static marketing site for apexomnihub.icu with White Fortress (default) and Night Watch (toggle) themes.

## Quick Start

```bash
cd apps/omnihub-site
npm install
npm run dev     # Start dev server at http://localhost:3000
npm run build   # Build for production
npm run preview # Preview production build
npm run smoke   # Run smoke tests on built site
```

## Architecture

- **Static-first MPA**: 5 separate HTML entry points, no client-side routing
- **Portable**: Works on Vercel, IONOS, Netlify, or any static hosting
- **No external vendors required**: Fully self-contained

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `index.html` | Landing page with hero, features, proof |
| `/demo.html` | `demo.html` | Demo video/interactive placeholders |
| `/tech-specs.html` | `tech-specs.html` | Technical specifications |
| `/request-access.html` | `request-access.html` | Access request form |
| `/restricted.html` | `restricted.html` | Restricted area fallback |

## Themes

- **White Fortress** (default): Premium, high whitespace, crisp typography
- **Night Watch** (toggle): Control-room aesthetic, restrained palette

Toggle with the sun/moon button in the nav. Theme preference is saved to localStorage.

## Configuration

All content lives in `src/content/site.ts`:
- Copy (hero, CTAs, sections)
- Proof tiles (SonarCloud metrics)
- Navigation links
- Form fields

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ENABLE_REQUEST_ACCESS` | No | Set to `true` to enable Supabase backend |
| `VITE_SUPABASE_URL` | If enabled | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | If enabled | Supabase anonymous key |

### Supabase Setup (Optional)

If enabling Supabase for request-access form:

1. Create `access_requests` table with unique constraint on `email`:

```sql
CREATE TABLE access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company TEXT,
  use_case TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anon users
CREATE POLICY "Allow anonymous inserts" ON access_requests
  FOR INSERT TO anon WITH CHECK (true);
```

2. Set environment variables in `.env`:

```
VITE_ENABLE_REQUEST_ACCESS=true
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Security

See `docs/headers.md` for security header configurations across platforms.

Anti-abuse measures in request-access form:
- Honeypot field (hidden)
- Timing check (minimum 3s)
- Client-side cooldown (5 min between submissions)
- Input validation with length limits
- XSS prevention (no user input rendered as HTML)

## Rollback

To disable the marketing site:

1. Remove or rename `apps/omnihub-site/`
2. If deployed separately, remove from hosting platform
3. Remove any Vercel/hosting configs if added at repo root

To disable Supabase integration:

1. Remove `VITE_ENABLE_REQUEST_ACCESS` from environment
2. Form falls back to mailto link

## Development

```bash
npm run dev       # Start dev server
npm run typecheck # TypeScript check
npm run lint      # ESLint
npm run build     # Production build
npm run smoke     # Smoke test (after build)
```
