# DOPPLER SECRETS MANAGER - IMPLEMENTATION GUIDE
**Phase 2, Week 3 - Production Secrets Management**

**Status:** Ready for Implementation
**Setup Time:** ~30 minutes
**Cost:** Free (up to 5 developers) or $8/developer/month

---

## QUICK START

### 1. Install Doppler CLI

**macOS:**
```bash
brew install dopplerhq/cli/doppler
```

**Linux:**
```bash
curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | sudo apt-key add -
echo "deb https://packages.doppler.com/public/cli/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/doppler-cli.list
sudo apt-get update && sudo apt-get install doppler
```

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri "https://cli.doppler.com/install.ps1" -OutFile "doppler.ps1"
.\doppler.ps1
```

### 2. Login to Doppler

```bash
# Login (opens browser)
doppler login

# Verify login
doppler me
```

### 3. Create Doppler Project

```bash
# Setup project (in repo root)
cd /path/to/OmniLink-APEX
doppler setup

# Select or create project: omnihub
# Select environment: dev, staging, or prod
```

### 4. Import Existing Secrets

From your current `.env.example`, import secrets:

```bash
# Import from .env file (if you have one locally)
doppler secrets upload .env --project omnihub --config dev

# Or set secrets manually
doppler secrets set VITE_SUPABASE_URL="https://wwajmaohwcbooljdureo.supabase.co" --project omnihub --config dev
doppler secrets set VITE_SUPABASE_PUBLISHABLE_KEY="<your-key>" --project omnihub --config dev

# For production (DO NOT use dev secrets!)
doppler secrets set VITE_SUPABASE_URL="<prod-url>" --project omnihub --config prod
```

### 5. Sync to Vercel

**Option A: Automatic Sync (Recommended)**

1. Go to https://dashboard.doppler.com/
2. Navigate to: omnihub project → Integrations
3. Click "Add Integration" → Select "Vercel"
4. Authorize Doppler to access Vercel
5. Map environments:
   - Doppler `prod` → Vercel `production`
   - Doppler `staging` → Vercel `preview`
   - Doppler `dev` → Vercel `development`

**Option B: Manual Sync (CLI)**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Sync secrets
doppler secrets download --format env --project omnihub --config prod | vercel env pull .env.production
```

### 6. Sync to Supabase

**For Supabase Edge Functions:**

Create `.doppler.yaml` in your repo:

```yaml
# .doppler.yaml
setup:
  project: omnihub
  config: dev
```

Then run:

```bash
# Download secrets for Supabase
doppler secrets download --no-file --format env-no-quotes > supabase/.env

# Deploy edge function with secrets
doppler run -- supabase functions deploy <function-name>
```

**For Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/<project-id>/settings/vault
2. Manually copy secrets from Doppler to Supabase Vault
3. Use Supabase Vault API to access secrets in edge functions

### 7. Local Development

**Instead of `.env` file, use:**

```bash
# Run dev server with Doppler
doppler run -- npm run dev

# Or set up shell integration (automatic)
doppler setup
eval "$(doppler secrets download --no-file --format=env-no-quotes --config=dev)"
npm run dev
```

**Update `package.json`:**

```json
{
  "scripts": {
    "dev": "doppler run -- vite",
    "dev:local": "vite",
    "build": "doppler run --config prod -- vite build"
  }
}
```

---

## ENVIRONMENT STRUCTURE

### Recommended Setup

```
omnihub (project)
├── dev (config)
│   ├── VITE_SUPABASE_URL=<dev-supabase>
│   ├── VITE_SUPABASE_PUBLISHABLE_KEY=<dev-anon-key>
│   └── ... (all dev secrets)
├── staging (config)
│   ├── VITE_SUPABASE_URL=<staging-supabase>
│   ├── VITE_SUPABASE_PUBLISHABLE_KEY=<staging-anon-key>
│   └── ... (all staging secrets)
└── prod (config)
    ├── VITE_SUPABASE_URL=<prod-supabase>
    ├── VITE_SUPABASE_PUBLISHABLE_KEY=<prod-anon-key>
    └── ... (all production secrets)
```

### Secrets to Import

**From `SECRETS_INVENTORY_AND_ROTATION.md`:**

1. **Supabase Credentials:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (sensitive!)

2. **Web3/Blockchain:**
   - `WEB3_PRIVATE_KEY` (CRITICAL - store in Doppler's secure vault)
   - `ALCHEMY_API_KEY_ETH`
   - `ALCHEMY_API_KEY_POLYGON`
   - `ALCHEMY_WEBHOOK_SIGNING_KEY`

3. **Optional:**
   - `OPENAI_API_KEY`
   - `VITE_SENTRY_DSN`
   - `LOVABLE_API_KEY`

---

## CI/CD INTEGRATION

### GitHub Actions

Create `.github/workflows/cd-production.yml`:

```yaml
name: Production Deployment

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Install Doppler CLI
      - uses: dopplerhq/cli-action@v2

      # Build with production secrets
      - name: Build
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_PROD }}
        run: doppler run -- npm run build

      # Deploy to Vercel
      - name: Deploy to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_PROD }}
        run: |
          doppler run -- vercel --prod --token=$VERCEL_TOKEN
```

**Setup GitHub Secrets:**

1. Generate Doppler service token:
   ```bash
   doppler configs tokens create github-actions --project omnihub --config prod
   ```

2. Add to GitHub:
   - Repository → Settings → Secrets → Actions
   - Add `DOPPLER_TOKEN_PROD` with the token from step 1

### Vercel Integration (Native)

**Automatic Secret Sync:**

1. Install Doppler integration: https://vercel.com/integrations/doppler
2. Configure sync:
   - Doppler `prod` → Vercel `Production`
   - Doppler `staging` → Vercel `Preview`
   - Doppler `dev` → Vercel `Development`
3. Secrets auto-sync on every change in Doppler

---

## SECRET ROTATION WORKFLOW

### Rotating a Secret

**Example: Rotate Supabase Anon Key**

1. **Generate new key** in Supabase Dashboard

2. **Update in Doppler:**
   ```bash
   doppler secrets set VITE_SUPABASE_PUBLISHABLE_KEY="<new-key>" --project omnihub --config prod
   ```

3. **Automatic propagation:**
   - Doppler → Vercel (automatic via integration)
   - Next deployment picks up new key

4. **Verify:**
   ```bash
   # Check Vercel has new key
   vercel env ls production | grep VITE_SUPABASE_PUBLISHABLE_KEY
   ```

5. **Old key deprecation:**
   - Wait 24 hours (allow in-flight requests to complete)
   - Revoke old key in Supabase Dashboard

### Rotation Schedule

**Automated rotation reminder:**

```bash
# Add secret metadata with rotation date
doppler secrets set VITE_SUPABASE_PUBLISHABLE_KEY="<key>" \
  --project omnihub --config prod \
  --note "Rotate: 2026-04-03 (90 days)"
```

---

## SECURITY BEST PRACTICES

### 1. Least Privilege Access

**Team Access Levels:**
- **Developer:** Read-only access to `dev` and `staging`
- **DevOps:** Read/write access to all configs
- **CI/CD:** Service tokens (read-only, scoped to specific config)

**Setup:**
```bash
# Invite team member
doppler workplace invite user@example.com --role member

# Grant project access
doppler projects invite omnihub user@example.com --role viewer
```

### 2. Audit Logging

All secret access is logged:
- Who accessed which secret
- When it was accessed
- From which IP address

**View audit log:**
```bash
doppler activity --project omnihub
```

### 3. Secret References

**Avoid duplicating secrets across configs:**

```bash
# Create root secret (shared across all configs)
doppler secrets set SHARED_API_KEY="<key>" --project omnihub --config prod

# Reference in other configs
doppler secrets set MY_API_KEY="${SHARED_API_KEY}" --project omnihub --config staging
```

### 4. Personal Secrets

For secrets that vary per developer (e.g., local test API keys):

```bash
# Each developer can override locally
doppler secrets set MY_LOCAL_TEST_KEY="<personal-key>" --config dev
```

---

## BACKUP AND RECOVERY

### Export Secrets (Backup)

```bash
# Export all secrets to encrypted file
doppler secrets download --project omnihub --config prod > secrets-backup-$(date +%Y%m%d).env.gpg

# Encrypt backup
gpg --symmetric --cipher-algo AES256 secrets-backup-20260103.env
```

### Import Secrets (Recovery)

```bash
# Decrypt backup
gpg --decrypt secrets-backup-20260103.env.gpg > secrets-backup.env

# Import to Doppler
doppler secrets upload secrets-backup.env --project omnihub --config prod
```

---

## COST BREAKDOWN

### Free Tier
- ✅ Up to 5 developers
- ✅ Unlimited secrets
- ✅ Unlimited projects
- ✅ Vercel/GitHub integrations
- ✅ Audit logging (30 days)
- ✅ CLI access

### Team Tier ($8/user/month)
- ✅ Unlimited developers
- ✅ SSO (SAML)
- ✅ Advanced RBAC
- ✅ Audit logging (1 year)
- ✅ Priority support

**For OmniHub (3 developers):**
- **Free Tier:** $0/month ✅ Recommended for MVP
- **Team Tier:** $24/month (if SSO needed)

---

## MIGRATION CHECKLIST

- [ ] Install Doppler CLI on all dev machines
- [ ] Create Doppler project (`omnihub`)
- [ ] Create 3 configs: `dev`, `staging`, `prod`
- [ ] Import all secrets from `SECRETS_INVENTORY_AND_ROTATION.md`
- [ ] Set up Vercel integration (automatic sync)
- [ ] Set up GitHub Actions integration
- [ ] Update `package.json` scripts to use `doppler run`
- [ ] Update CI/CD workflows to use Doppler
- [ ] Test local development with `doppler run -- npm run dev`
- [ ] Test deployment with Doppler secrets
- [ ] Delete any remaining `.env` files (keep `.env.example` only)
- [ ] Add `.doppler.yaml` to `.gitignore` (it contains config selection)
- [ ] Document Doppler onboarding in team wiki

---

## TROUBLESHOOTING

### Error: "Invalid token"

**Solution:**
```bash
# Re-login
doppler logout
doppler login
```

### Error: "Project not found"

**Solution:**
```bash
# Verify project exists
doppler projects list

# Setup project again
doppler setup
```

### Secrets not syncing to Vercel

**Solution:**
1. Check integration status: https://dashboard.doppler.com/omnihub/integrations
2. Re-authorize integration if needed
3. Manually trigger sync: Click "Sync Now" in Doppler dashboard

### Local dev can't find secrets

**Solution:**
```bash
# Verify doppler config
doppler configure get

# Should show:
# project: omnihub
# config: dev

# If not, run setup again
doppler setup
```

---

## NEXT STEPS

After Doppler setup:

1. ✅ **Remove local `.env` files** (keep `.env.example`)
2. ✅ **Update CI/CD** to use Doppler tokens
3. ✅ **Add secret scanning** (TruffleHog) to prevent secrets in code
4. ✅ **Set up rotation reminders** (calendar events for 90-day rotations)
5. ✅ **Train team** on Doppler CLI usage

---

**Document Status:** ✅ READY FOR IMPLEMENTATION
**Last Updated:** 2026-01-03
**Owner:** DevOps Team
**Related:** `SECRETS_MANAGER_SETUP.md`, `SECRETS_INVENTORY_AND_ROTATION.md`
