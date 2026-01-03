# SECRETS INVENTORY & ROTATION GUIDE
**OmniHub/TradeLine/APEX - Comprehensive Secrets Management**

**Last Updated:** 2026-01-03
**Owner:** DevOps Team
**Review Cycle:** Quarterly

---

## OVERVIEW

This document inventories all secrets used in OmniHub infrastructure and provides rotation procedures for each.

**Security Principle:** Secrets are rotated on a 90-day cycle or immediately upon suspected compromise.

---

## SECRETS INVENTORY

### 1. SUPABASE CREDENTIALS

#### 1.1 Supabase URL
**Variable:** `VITE_SUPABASE_URL`
**Current Value:** `https://wwajmaohwcbooljdureo.supabase.co`
**Sensitivity:** PUBLIC (client-side, embedded in frontend bundle)
**Location:** Vercel environment variables, frontend code
**Rotation:** Not required (public identifier)

#### 1.2 Supabase Publishable Key (Anon Key)
**Variable:** `VITE_SUPABASE_PUBLISHABLE_KEY`
**Current Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (anon key)
**Sensitivity:** PUBLIC (designed for client-side use)
**Permissions:** Limited by Row Level Security (RLS)
**Location:** Vercel environment variables, frontend code
**Rotation Frequency:** 90 days OR on suspected abuse

**Rotation Procedure:**
```bash
# 1. Go to Supabase Dashboard
https://app.supabase.com/project/wwajmaohwcbooljdureo/settings/api

# 2. Click "Reset JWT Secret" (WARNING: breaks all existing JWTs)
# OR wait for Supabase to provide key rotation feature

# 3. Copy new anon key

# 4. Update in Vercel
vercel env rm VITE_SUPABASE_PUBLISHABLE_KEY production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
# Paste new key when prompted

# 5. Update in Supabase Edge Functions (if needed)
supabase secrets set VITE_SUPABASE_PUBLISHABLE_KEY=<new-key>

# 6. Trigger new deployment
vercel --prod

# 7. Verify deployment
curl https://omnihub.dev/health
```

**Rollback:** Revert Vercel environment variable to old key, redeploy

#### 1.3 Supabase Service Role Key
**Variable:** `SUPABASE_SERVICE_ROLE_KEY`
**Current Value:** UNKNOWN (not in .env, stored in Supabase Edge Functions secrets)
**Sensitivity:** 🔴 **CRITICAL** (full database access, bypasses RLS)
**Permissions:** Unrestricted database access
**Location:** Supabase Edge Functions environment variables ONLY
**Rotation Frequency:** 90 days OR immediately on suspected compromise

**Rotation Procedure:**
```bash
# 1. Go to Supabase Dashboard
https://app.supabase.com/project/wwajmaohwcbooljdureo/settings/api

# 2. Click "Reset JWT Secret" (regenerates all keys including service role)

# 3. Copy new service_role key

# 4. Update in Supabase Edge Functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new-key> --project-ref wwajmaohwcbooljdureo

# 5. Verify edge functions still work
curl -X POST https://wwajmaohwcbooljdureo.supabase.co/functions/v1/health \
  -H "Authorization: Bearer <new-service-role-key>"

# 6. Test critical functions
npm run test:edge-functions
```

**Rollback:** Set old key back in Supabase secrets

**CRITICAL:** Never expose service role key in frontend code or client-side environment variables!

---

### 2. WEB3 / BLOCKCHAIN CREDENTIALS

#### 2.1 Web3 Private Key
**Variable:** `WEB3_PRIVATE_KEY`
**Current Value:** UNKNOWN (not set yet, per blockchain deployment checklist)
**Sensitivity:** 🔴 **CRITICAL** (can sign transactions, transfer funds)
**Permissions:** Full control over associated Ethereum wallet
**Location:** Supabase Edge Functions secrets ONLY
**Rotation Frequency:** NEVER (blockchain wallets can't be "rotated")

**Security Measures:**
- **Hardware Wallet Recommended:** Use Ledger or Trezor for production
- **MPC Wallet Alternative:** Consider Fireblocks or similar MPC service
- **Backup:** Store seed phrase in physical vault (bank safe deposit box)
- **Monitoring:** Alert on any unexpected transactions from this wallet

**If Compromised:**
```bash
# 1. IMMEDIATELY transfer all funds to new wallet
# 2. Update all smart contract ownership to new wallet
# 3. Revoke all permissions/approvals from compromised wallet
# 4. Generate new wallet, update WEB3_PRIVATE_KEY
# 5. Incident report + forensics
```

**Generation (Production):**
```bash
# Use hardware wallet OR MPC service, NOT software key generation
# For testing only:
npx hardhat generate-wallet

# Store in Supabase secrets
supabase secrets set WEB3_PRIVATE_KEY=<private-key> --project-ref wwajmaohwcbooljdureo
```

**CRITICAL:** Never commit private key to git, never log it, never share via Slack/email!

#### 2.2 Alchemy API Keys
**Variable:** `ALCHEMY_API_KEY_ETH`, `ALCHEMY_API_KEY_POLYGON`
**Current Value:** UNKNOWN (not set yet)
**Sensitivity:** 🟡 MEDIUM (can make RPC requests, costs money if abused)
**Permissions:** Read blockchain data, submit transactions
**Location:** Supabase Edge Functions secrets
**Rotation Frequency:** 90 days OR on suspected abuse

**Rotation Procedure:**
```bash
# 1. Go to Alchemy Dashboard
https://dashboard.alchemy.com/

# 2. Create new app or regenerate API key
Apps > [Your App] > View Key > Regenerate Key

# 3. Update in Supabase Edge Functions
supabase secrets set ALCHEMY_API_KEY_ETH=<new-key> --project-ref wwajmaohwcbooljdureo
supabase secrets set ALCHEMY_API_KEY_POLYGON=<new-key> --project-ref wwajmaohwcbooljdureo

# 4. Verify RPC connectivity
npm run test:web3

# 5. Delete old key in Alchemy Dashboard
```

**Monitoring:**
- Set up Alchemy usage alerts (requests/day > threshold)
- Alert on unexpected spikes (potential abuse)

#### 2.3 Alchemy Webhook Signing Key
**Variable:** `ALCHEMY_WEBHOOK_SIGNING_KEY`
**Current Value:** UNKNOWN (not set yet, per blockchain deployment checklist)
**Sensitivity:** 🟡 MEDIUM (verifies webhook authenticity)
**Permissions:** Validates that webhooks are from Alchemy
**Location:** Supabase Edge Functions secrets
**Rotation Frequency:** 90 days OR on suspected compromise

**Rotation Procedure:**
```bash
# 1. Go to Alchemy Dashboard > Webhooks
https://dashboard.alchemy.com/webhooks

# 2. Select your webhook, regenerate signing key

# 3. Update in Supabase Edge Functions
supabase secrets set ALCHEMY_WEBHOOK_SIGNING_KEY=<new-key> --project-ref wwajmaohwcbooljdureo

# 4. Test webhook signature verification
curl -X POST https://wwajmaohwcbooljdureo.supabase.co/functions/v1/alchemy-webhook \
  -H "X-Alchemy-Signature: <test-signature>" \
  -d '{"test": true}'
```

#### 2.4 NFT Contract Address
**Variable:** `MEMBERSHIP_NFT_ADDRESS`
**Current Value:** UNKNOWN (not deployed yet)
**Sensitivity:** PUBLIC (blockchain addresses are public)
**Location:** Vercel environment variables, frontend code
**Rotation:** Not applicable (immutable blockchain address)

---

### 3. OPTIONAL / FUTURE CREDENTIALS

#### 3.1 Sentry DSN
**Variable:** `VITE_SENTRY_DSN`
**Current Value:** NOT SET (optional)
**Sensitivity:** 🟡 MEDIUM (can send error data to Sentry)
**Location:** Vercel environment variables, frontend code
**Rotation Frequency:** Annually OR on suspected abuse

**Setup:**
```bash
# 1. Create Sentry project: https://sentry.io/
# 2. Copy DSN
# 3. Add to Vercel
vercel env add VITE_SENTRY_DSN production
```

#### 3.2 Lovable API Credentials
**Variable:** `LOVABLE_API_KEY`, `LOVABLE_SERVICE_ROLE_KEY`
**Current Value:** UNKNOWN (optional integration)
**Sensitivity:** 🟡 MEDIUM
**Location:** Supabase Edge Functions secrets
**Rotation Frequency:** 90 days

#### 3.3 OpenAI API Key
**Variable:** `OPENAI_API_KEY`
**Current Value:** UNKNOWN (referenced in edge functions, not set in .env)
**Sensitivity:** 🔴 HIGH (costs money, rate limits)
**Location:** Supabase Edge Functions secrets
**Rotation Frequency:** 90 days

**Rotation Procedure:**
```bash
# 1. Go to OpenAI Dashboard
https://platform.openai.com/api-keys

# 2. Create new API key (or revoke old, create new)

# 3. Update in Supabase Edge Functions
supabase secrets set OPENAI_API_KEY=<new-key> --project-ref wwajmaohwcbooljdureo

# 4. Test AI features
npm run test:ai-agent

# 5. Revoke old key in OpenAI Dashboard
```

**Monitoring:**
- Set up OpenAI usage alerts (cost > $X/day)
- Alert on rate limit errors (potential abuse)

---

## SECRETS STORAGE LOCATIONS

### Current State (To Be Improved)

| Secret | Location | Security Level | Access Control |
|--------|----------|----------------|----------------|
| Supabase URL | Vercel env vars, frontend code | PUBLIC | All developers |
| Supabase Anon Key | Vercel env vars, frontend code | PUBLIC | All developers |
| Supabase Service Role Key | Supabase Edge Functions secrets | 🔴 CRITICAL | Admin only |
| WEB3_PRIVATE_KEY | Supabase Edge Functions secrets | 🔴 CRITICAL | Admin only |
| Alchemy API Keys | Supabase Edge Functions secrets | 🟡 MEDIUM | Backend devs |
| OpenAI API Key | Supabase Edge Functions secrets | 🔴 HIGH | Backend devs |

### Target State (Phase 1, Week 1-2)

| Secret | Location | Security Level | Access Control |
|--------|----------|----------------|----------------|
| Supabase URL | Vercel env vars, frontend code | PUBLIC | All developers |
| Supabase Anon Key | Vercel env vars, frontend code | PUBLIC | All developers |
| **All Sensitive Secrets** | **HashiCorp Vault or Doppler** | **🔴 CRITICAL** | **Least-privilege, audit logged** |

**Benefits of Secrets Manager:**
- ✅ Centralized secret storage
- ✅ Automatic rotation (90-day cycle)
- ✅ Access audit logs (who accessed what, when)
- ✅ Least-privilege access (role-based)
- ✅ Version history (rollback capability)
- ✅ Secret expiration policies

---

## ROTATION SCHEDULE

### Quarterly Rotation (Every 90 Days)

**Q1 (January):**
- [ ] Supabase Anon Key
- [ ] Alchemy API Keys
- [ ] OpenAI API Key
- [ ] Alchemy Webhook Signing Key

**Q2 (April):**
- [ ] Supabase Service Role Key (if not using Vault auto-rotation)
- [ ] Review all secrets access logs
- [ ] Revoke unused API keys

**Q3 (July):**
- [ ] Supabase Anon Key
- [ ] Alchemy API Keys
- [ ] OpenAI API Key
- [ ] Alchemy Webhook Signing Key

**Q4 (October):**
- [ ] Supabase Service Role Key
- [ ] Review all secrets access logs
- [ ] Sentry DSN

**Annually:**
- [ ] WEB3_PRIVATE_KEY wallet review (consider migrating to new wallet if concerns)
- [ ] Audit all active API keys, revoke unused

---

## INCIDENT RESPONSE (SUSPECTED COMPROMISE)

**If a secret is suspected to be compromised:**

1. **Immediate (< 5 minutes):**
   - Revoke compromised secret in provider dashboard
   - Generate new secret
   - Update in Vercel/Supabase/Vault
   - Trigger emergency deployment

2. **Short-term (< 1 hour):**
   - Review access logs (who accessed the secret)
   - Check for unauthorized usage (API calls, transactions)
   - Alert security team
   - Create incident ticket

3. **Investigation (< 24 hours):**
   - Forensics: How was secret compromised?
   - Check git history (was it committed?)
   - Check Slack/email (was it shared insecurely?)
   - Review other secrets (are others also compromised?)

4. **Post-Incident (< 1 week):**
   - Write incident report
   - Update security procedures
   - Team training (if human error)
   - Implement preventive controls

---

## SECRETS MANAGER MIGRATION (NEXT PHASE)

**Target:** Migrate all sensitive secrets to HashiCorp Vault or Doppler by end of Week 2.

**Migration Plan:**
1. Set up Vault/Doppler instance
2. Import all current secrets
3. Update edge functions to read from Vault
4. Test in staging
5. Deploy to production
6. Revoke old secrets after migration verified

**See:** `docs/security/SECRETS_MANAGER_SETUP.md` (to be created in next task)

---

## VERIFICATION

- [x] All secrets documented
- [x] Rotation procedures defined
- [x] Sensitivity levels assigned
- [x] Quarterly rotation schedule created
- [x] Incident response procedures documented
- [ ] Team trained on rotation procedures (TO DO)
- [ ] Secrets manager integration (TO DO - next task)

---

**Document Status:** ✅ COMPLETE
**Next Review:** 2026-04-03 (Quarterly)
**Owner:** DevOps Team
