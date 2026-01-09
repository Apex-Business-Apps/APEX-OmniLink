# Demo Mode

Demo mode allows running OmniHub without real blockchain or webhook secrets. **Never enable demo mode in production.**

## Local Demo Setup

1. Copy the demo env template:

```bash
cp .env.demo.example .env.local
```

2. Start the app as usual:

```bash
npm run dev
```

## Required vs Optional Secrets in Demo Mode

When `VITE_DEMO_MODE=true` (frontend) and/or `DEMO_MODE=true` (Edge Functions):

- **Optional (warnings only):**
  - `WEB3_PRIVATE_KEY`
  - `ALCHEMY_API_KEY_ETH`
  - `ALCHEMY_API_KEY_POLYGON`
  - `ALCHEMY_WEBHOOK_SIGNING_KEY`
  - `MEMBERSHIP_NFT_ADDRESS`

- **Required for the frontend to boot:**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)

## Supabase Edge Functions (Demo Mode)

Set in Supabase Edge Functions environment variables:

- `DEMO_MODE=true`
- `SIWE_ALLOWED_ORIGINS=http://localhost:5173`

In demo mode, the `alchemy-webhook` function returns a 200 response and skips all database writes.

## 🚨 Production Warning

**Demo mode must never be enabled in production.**
Remove `VITE_DEMO_MODE` and `DEMO_MODE` and provide real secrets before any production deploy.
