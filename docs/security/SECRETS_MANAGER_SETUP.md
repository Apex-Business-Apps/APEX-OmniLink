# SECRETS MANAGER SETUP GUIDE
**OmniHub/TradeLine/APEX - Secure Secrets Management**

**Purpose:** Migrate from environment variables to centralized secrets manager
**Timeline:** Phase 1, Week 1-2
**Status:** Implementation Guide

---

## OVERVIEW

This guide provides step-by-step instructions for integrating a secrets manager into OmniHub infrastructure.

**Options:**
1. **Doppler** (Recommended for fast setup) - SaaS, easy integration
2. **HashiCorp Vault** (Recommended for maximum control) - Self-hosted or cloud
3. **1Password** (Alternative) - Team password manager

---

## OPTION 1: DOPPLER (RECOMMENDED - FASTEST SETUP)

**Why Doppler:**
- ✅ Fast setup (< 30 minutes)
- ✅ Built-in integrations (Vercel, Supabase, GitHub Actions)
- ✅ Automatic syncing to deployment platforms
- ✅ Free tier available (up to 5 developers)
- ✅ Web UI + CLI
- ✅ Audit logs built-in

**Pricing:**
- Free: Up to 5 developers
- Team: $8/user/month
- Enterprise: Custom pricing

---

### Step 1: Create Doppler Account

```bash
# 1. Sign up at https://doppler.com

# 2. Create workspace: "OmniHub"

# 3. Create project: "omnihub-production"

# 4. Create environments:
#    - development
#    - staging
#    - production
```

---

### Step 2: Install Doppler CLI

```bash
# macOS
brew install dopplerhq/cli/doppler

# Linux
curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sudo sh

# Verify installation
doppler --version

# Login
doppler login
```

---

### Step 3: Import Existing Secrets

```bash
# Navigate to project root
cd /home/user/OmniLink-APEX

# Set up Doppler for this project
doppler setup

# Select:
# Project: omnihub-production
# Config: development (for now)

# Import secrets from .env.example (as template)
doppler secrets upload .env.example

# Manually set actual secret values in Doppler dashboard
# https://dashboard.doppler.com/
```

**Secrets to Add:**

```bash
# Supabase
doppler secrets set VITE_SUPABASE_URL="https://wwajmaohwcbooljdureo.supabase.co"
doppler secrets set VITE_SUPABASE_PUBLISHABLE_KEY="<your-anon-key>"
doppler secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# Blockchain (when ready)
doppler secrets set WEB3_PRIVATE_KEY="<your-private-key>"
doppler secrets set ALCHEMY_API_KEY_ETH="<your-alchemy-key>"
doppler secrets set ALCHEMY_API_KEY_POLYGON="<your-alchemy-key>"
doppler secrets set MEMBERSHIP_NFT_ADDRESS="<contract-address>"
doppler secrets set ALCHEMY_WEBHOOK_SIGNING_KEY="<signing-key>"

# Optional
doppler secrets set OPENAI_API_KEY="<your-openai-key>"
doppler secrets set VITE_SENTRY_DSN="<your-sentry-dsn>"
```

---

### Step 4: Integrate with Vercel (Frontend)

```bash
# Method 1: Automatic Sync (Recommended)
# 1. Go to Doppler Dashboard > Integrations > Vercel
# 2. Connect Vercel account
# 3. Select project: omnihub-production
# 4. Select environment: production
# 5. Click "Sync"

# Doppler will automatically sync secrets to Vercel environment variables!

# Method 2: Manual CLI
doppler secrets download --no-file --format env-no-quotes | vercel env add production
```

---

### Step 5: Integrate with Supabase Edge Functions

**Create helper script:**

```typescript
// supabase/functions/_shared/secrets.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Secrets {
  SUPABASE_SERVICE_ROLE_KEY: string
  WEB3_PRIVATE_KEY: string
  ALCHEMY_API_KEY_ETH: string
  ALCHEMY_API_KEY_POLYGON: string
  OPENAI_API_KEY: string
  // ... add more as needed
}

// Secrets are injected via Supabase CLI or Doppler
export const secrets: Secrets = {
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  WEB3_PRIVATE_KEY: Deno.env.get('WEB3_PRIVATE_KEY')!,
  ALCHEMY_API_KEY_ETH: Deno.env.get('ALCHEMY_API_KEY_ETH')!,
  ALCHEMY_API_KEY_POLYGON: Deno.env.get('ALCHEMY_API_KEY_POLYGON')!,
  OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY')!,
}

// Validate all secrets are set
for (const [key, value] of Object.entries(secrets)) {
  if (!value) {
    throw new Error(`Missing required secret: ${key}`)
  }
}
```

**Deploy secrets to Supabase:**

```bash
# Method 1: Doppler CLI
doppler run -- supabase secrets set --env-file <(doppler secrets download --no-file --format env)

# Method 2: Manual
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<value> --project-ref wwajmaohwcbooljdureo
supabase secrets set WEB3_PRIVATE_KEY=<value> --project-ref wwajmaohwcbooljdureo
# ... etc for all secrets
```

---

### Step 6: Local Development Setup

**Create `.doppler.yaml`:**

```yaml
# .doppler.yaml (commit this file - no secrets)
setup:
  project: omnihub-production
  config: development
```

**Update developer docs:**

```markdown
# Local Development Setup

## 1. Install Doppler CLI
brew install dopplerhq/cli/doppler

## 2. Login to Doppler
doppler login

## 3. Setup project
cd /path/to/OmniLink-APEX
doppler setup

## 4. Run development server with Doppler
doppler run -- npm run dev

# Doppler automatically injects secrets as environment variables!
```

**No more .env.local needed** - Doppler handles everything!

---

### Step 7: CI/CD Integration (GitHub Actions)

**Update `.github/workflows/cd-staging.yml`:**

```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Doppler CLI
        uses: dopplerhq/cli-action@v3

      - name: Deploy with Doppler secrets
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_STAGING }}
        run: |
          # Doppler injects secrets into environment
          doppler run -- npm run deploy:staging
```

**Create Doppler service token:**

```bash
# 1. Go to Doppler Dashboard
# 2. Project: omnihub-production > Config: staging
# 3. Click "Service Tokens" > "Generate"
# 4. Copy token

# 5. Add to GitHub Secrets
# Repository > Settings > Secrets > Actions
# Name: DOPPLER_TOKEN_STAGING
# Value: <paste-token>
```

---

### Step 8: Automatic Rotation (Doppler Feature)

**Set up rotation policies:**

```bash
# 1. Go to Doppler Dashboard > Project > Secrets
# 2. For each secret, click "..." > "Set Expiration"
# 3. Set expiration: 90 days from now
# 4. Enable "Notify on expiration" (email alert)

# When secret expires:
# 1. Rotate secret in provider (e.g., regenerate API key)
# 2. Update in Doppler dashboard
# 3. Doppler auto-syncs to Vercel, trigger redeploy
```

---

### Step 9: Access Audit Logs

```bash
# View who accessed which secrets
# Doppler Dashboard > Activity Log

# Or via CLI
doppler activity
```

---

### Step 10: Verification Checklist

- [ ] Doppler account created
- [ ] All secrets imported
- [ ] Vercel integration configured (auto-sync working)
- [ ] Supabase Edge Functions secrets deployed
- [ ] Local development works with `doppler run`
- [ ] CI/CD uses Doppler service tokens
- [ ] Expiration policies set (90 days)
- [ ] Team members have appropriate access (least-privilege)
- [ ] Audit logs reviewed

---

## OPTION 2: HASHICORP VAULT (MAXIMUM CONTROL)

**Why Vault:**
- ✅ Self-hosted (maximum control)
- ✅ Dynamic secrets (auto-generated, auto-revoked)
- ✅ Encryption as a service
- ✅ Multi-cloud support
- ✅ Audit logging
- ✅ Fine-grained access control (policies)

**Trade-Offs:**
- ❌ Complex setup (requires infrastructure)
- ❌ Requires maintenance (upgrades, backups)
- ❌ Learning curve

**Pricing:**
- Open Source: Free (self-hosted)
- HCP Vault (managed): $0.50/hour (~$360/month)
- Enterprise: Custom pricing

---

### Step 1: Deploy Vault (HCP Vault Recommended)

**Option A: HCP Vault (Managed, Easiest)**

```bash
# 1. Sign up at https://portal.cloud.hashicorp.com/

# 2. Create cluster
# Name: omnihub-vault
# Tier: Development (or Production)
# Region: us-east-1

# 3. Note cluster URL and admin token
VAULT_ADDR="https://omnihub-vault-public-vault-XXXXX.hashicorp.cloud:8200"
VAULT_TOKEN="hvs.XXXXXXXXXXXXX"
```

**Option B: Self-Hosted on Kubernetes**

```yaml
# Deploy Vault on Kubernetes using Helm
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --set server.ha.enabled=true \
  --set server.ha.replicas=3 \
  --namespace vault --create-namespace
```

---

### Step 2: Initialize Vault

```bash
# Install Vault CLI
brew install hashicorp/tap/vault

# Set Vault address
export VAULT_ADDR="https://omnihub-vault-public-vault-XXXXX.hashicorp.cloud:8200"
export VAULT_TOKEN="hvs.XXXXXXXXXXXXX"

# Verify connection
vault status

# Enable KV secrets engine
vault secrets enable -path=omnihub kv-v2
```

---

### Step 3: Store Secrets in Vault

```bash
# Store Supabase secrets
vault kv put omnihub/supabase \
  url="https://wwajmaohwcbooljdureo.supabase.co" \
  anon_key="<your-anon-key>" \
  service_role_key="<your-service-role-key>"

# Store blockchain secrets
vault kv put omnihub/blockchain \
  private_key="<your-private-key>" \
  alchemy_eth_key="<your-alchemy-key>" \
  alchemy_polygon_key="<your-alchemy-key>" \
  nft_contract_address="<contract-address>"

# Store API keys
vault kv put omnihub/api-keys \
  openai="<your-openai-key>" \
  sentry_dsn="<your-sentry-dsn>"
```

---

### Step 4: Access Control (Policies)

```bash
# Create policy for frontend (read-only public secrets)
vault policy write omnihub-frontend - <<EOF
path "omnihub/data/supabase" {
  capabilities = ["read"]
}
EOF

# Create policy for backend (read all secrets)
vault policy write omnihub-backend - <<EOF
path "omnihub/data/*" {
  capabilities = ["read"]
}
EOF

# Create policy for admin (full access)
vault policy write omnihub-admin - <<EOF
path "omnihub/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
EOF
```

---

### Step 5: Integrate with Supabase Edge Functions

**Create Vault client helper:**

```typescript
// supabase/functions/_shared/vault.ts
const VAULT_ADDR = Deno.env.get('VAULT_ADDR')!
const VAULT_TOKEN = Deno.env.get('VAULT_TOKEN')!

export async function getSecret(path: string): Promise<any> {
  const response = await fetch(`${VAULT_ADDR}/v1/omnihub/data/${path}`, {
    headers: {
      'X-Vault-Token': VAULT_TOKEN
    }
  })

  if (!response.ok) {
    throw new Error(`Vault error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data.data  // KV v2 format
}

// Usage
const supabaseSecrets = await getSecret('supabase')
const serviceRoleKey = supabaseSecrets.service_role_key
```

**Set Vault credentials in Supabase Edge Functions:**

```bash
supabase secrets set VAULT_ADDR="<your-vault-url>" --project-ref wwajmaohwcbooljdureo
supabase secrets set VAULT_TOKEN="<backend-token>" --project-ref wwajmaohwcbooljdureo
```

---

### Step 6: Dynamic Secrets (Advanced)

**Auto-generate database credentials:**

```bash
# Enable database secrets engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/omnihub-db \
  plugin_name=postgresql-database-plugin \
  allowed_roles="omnihub-readonly,omnihub-readwrite" \
  connection_url="postgresql://{{username}}:{{password}}@db.example.com:5432/omnihub" \
  username="vault" \
  password="<vault-db-password>"

# Create role (auto-generates credentials)
vault write database/roles/omnihub-readonly \
  db_name=omnihub-db \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# Get credentials (auto-generated, auto-expire)
vault read database/creds/omnihub-readonly
```

---

### Step 7: Verification

- [ ] Vault deployed and accessible
- [ ] All secrets stored in Vault
- [ ] Access policies configured (least-privilege)
- [ ] Edge functions can read secrets from Vault
- [ ] Audit logging enabled
- [ ] Backup strategy for Vault data

---

## OPTION 3: 1PASSWORD (TEAM PASSWORD MANAGER)

**Why 1Password:**
- ✅ Familiar UX (many teams already use it)
- ✅ Fast setup
- ✅ CLI + API access
- ✅ Secret references in code

**Setup:**

```bash
# 1. Sign up for 1Password Business
# https://1password.com/business/

# 2. Install 1Password CLI
brew install 1password-cli

# 3. Sign in
op signin

# 4. Create vault: "OmniHub Secrets"

# 5. Store secrets
op item create \
  --category=login \
  --title="Supabase Service Role Key" \
  --vault="OmniHub Secrets" \
  password="<your-service-role-key>"

# 6. Reference secrets in code
# In Vercel/Supabase, use 1Password secret references
# op://OmniHub Secrets/Supabase Service Role Key/password
```

---

## RECOMMENDATION

**For OmniHub:**

**Phase 1 (Immediate - Week 1-2):** Use **Doppler**
- Fastest setup (< 30 minutes)
- Built-in Vercel/Supabase integrations
- Free tier sufficient for now
- Can migrate to Vault later if needed

**Phase 2 (If needed - Q2 2026):** Migrate to **Vault** if:
- Need on-premises deployment
- Need dynamic secrets (auto-generated DB credentials)
- Need encryption as a service
- Enterprise compliance requires self-hosted

---

## MIGRATION CHECKLIST

- [ ] Choose secrets manager (Doppler recommended)
- [ ] Set up account and project
- [ ] Import all current secrets
- [ ] Configure integrations (Vercel, Supabase, GitHub Actions)
- [ ] Update local development workflow (`doppler run`)
- [ ] Test in development environment
- [ ] Deploy to staging
- [ ] Verify staging works with new secrets
- [ ] Deploy to production (requires approval)
- [ ] Revoke old secrets after migration verified
- [ ] Update team documentation
- [ ] Train team on new workflow

---

**Document Status:** ✅ COMPLETE
**Next Step:** Choose secrets manager and begin implementation
**Recommended:** Doppler (fastest, easiest)
**Owner:** DevOps Team
