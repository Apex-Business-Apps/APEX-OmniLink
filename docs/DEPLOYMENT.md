# Blockchain Functions - Production Deployment Guide

## 🎯 Quick Start

This guide covers deploying all 4 blockchain edge functions to production.

## 📋 Pre-Deployment Checklist

Run the automated checklist:

```bash
./scripts/production-deployment-checklist.sh
```

This verifies:
- ✅ Environment variables configured
- ✅ Edge function files exist
- ✅ Database migrations ready
- ✅ Tests available
- ✅ Documentation complete
- ✅ Secrets not exposed
- ✅ TypeScript compilation passes

---

## 🚀 Deployment Steps

### Step 1: Push Database Migrations

```bash
supabase db push
```

This applies:
- `20260101000000_create_web3_verification.sql` - Core Web3 tables
- `20260101000001_add_nft_profile_columns.sql` - NFT tracking columns

**Verify:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('wallet_identities', 'wallet_nonces', 'entitlements', 'chain_entitlements_cache');

-- Check profile columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('has_premium_nft', 'nft_verified_at');
```

---

### Step 2: Set Production Secrets

```bash
# Alchemy API Key for Polygon
supabase secrets set ALCHEMY_API_KEY_POLYGON="your-polygon-key"

# NFT Contract Address (after deployment)
supabase secrets set MEMBERSHIP_NFT_ADDRESS="0x..."

# Webhook Signing Key (from Alchemy dashboard)
supabase secrets set ALCHEMY_WEBHOOK_SIGNING_KEY="your-signing-key"
```

**Verify:**
```bash
supabase secrets list
```

---

### Step 3: Deploy Edge Functions

```bash
# Deploy all blockchain functions
supabase functions deploy web3-nonce
supabase functions deploy web3-verify
supabase functions deploy verify-nft
supabase functions deploy alchemy-webhook
```

**Alternative:** Deploy all at once:
```bash
for func in web3-nonce web3-verify verify-nft alchemy-webhook; do
  supabase functions deploy $func
done
```

**Verify:**
```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs web3-nonce
supabase functions logs web3-verify
supabase functions logs verify-nft
supabase functions logs alchemy-webhook
```

---

### Step 4: Configure Alchemy Webhook

Run the setup assistant:

```bash
./scripts/setup-alchemy-webhook.sh
```

**Manual Configuration:**

1. **Login to Alchemy Dashboard**
   - Visit: https://dashboard.alchemy.com/
   - Select your Polygon app

2. **Create Webhook**
   - Navigate: Webhooks → + Create Webhook
   - **Type:** NFT Activity
   - **Network:** Polygon Mainnet (MATIC_MAINNET)
   - **Webhook URL:** `https://your-project.supabase.co/functions/v1/alchemy-webhook`
   - **Addresses:** Your `MEMBERSHIP_NFT_ADDRESS`
   - **Events:** ✓ NFT Transfers

3. **Copy Signing Key**
   - After creating, copy the "Signing Key"
   - Set in Supabase: `supabase secrets set ALCHEMY_WEBHOOK_SIGNING_KEY="..."`

4. **Test Webhook**
   - Use Alchemy's "Send Test" button
   - Check function logs: `supabase functions logs alchemy-webhook`

---

### Step 5: Run Production Tests

```bash
# Full end-to-end test suite
./scripts/e2e-blockchain-test.sh

# Verbose mode
./scripts/e2e-blockchain-test.sh --verbose

# Quick smoke test
./scripts/test-blockchain-functions.sh
```

**Expected Results:**
```
=== Test Summary ===
Total Tests:   25+
Passed:        25+
Failed:        0
Skipped:       0-5

Pass Rate:     100%
```

---

## 🧪 Testing Endpoints

### 1. Test Nonce Generation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/web3-nonce \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

**Expected:** 200 with nonce and message

---

### 2. Test NFT Verification

```bash
# Get JWT token first
export JWT="your-jwt-token"

# Check NFT ownership
curl -H "Authorization: Bearer $JWT" \
  https://your-project.supabase.co/functions/v1/verify-nft

# Force blockchain refresh
curl -H "Authorization: Bearer $JWT" \
  "https://your-project.supabase.co/functions/v1/verify-nft?force_refresh=true"
```

**Expected:** 200 with `has_premium_nft` status

---

### 3. Test Webhook (Mock)

```bash
# Generate mock payload
./scripts/generate-webhook-payload.sh --transfer-type mint --sign

# Test webhook endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Alchemy-Signature: YOUR_SIGNATURE" \
  -d @/tmp/alchemy-webhook-mint-*.json \
  https://your-project.supabase.co/functions/v1/alchemy-webhook
```

**Expected:** 401 (if signature invalid) or 200 (if valid)

---

## 📊 Monitoring

### Function Logs

```bash
# Real-time logs
supabase functions logs verify-nft --tail

# Filter by level
supabase functions logs alchemy-webhook --level error

# Time range
supabase functions logs web3-verify --since "2026-01-01 00:00:00"
```

### Key Metrics to Monitor

**web3-nonce:**
- Request rate (should be < 5/min per IP)
- Nonce generation failures
- Invalid wallet addresses

**web3-verify:**
- Verification success rate
- Signature validation failures
- Rate limit hits (10/hour)

**verify-nft:**
- Cache hit rate (should be > 80%)
- Alchemy RPC failures
- NFT balance query times
- Rate limit hits (20/hour)

**alchemy-webhook:**
- Signature validation failures
- Idempotent processing (duplicate webhooks)
- User cache invalidations
- Webhook processing time

### Database Monitoring

```sql
-- Active nonces
SELECT COUNT(*) FROM wallet_nonces WHERE used_at IS NULL AND expires_at > now();

-- Expired nonces (should be cleaned up)
SELECT COUNT(*) FROM wallet_nonces WHERE expires_at < now();

-- NFT cache hit rate (recent)
SELECT
  COUNT(*) as total_cache_entries,
  COUNT(*) FILTER (WHERE refreshed_at > now() - interval '10 minutes') as fresh_entries
FROM chain_entitlements_cache WHERE query_type = 'nft_balance';

-- Premium NFT holders
SELECT COUNT(*) FROM profiles WHERE has_premium_nft = true;

-- Recent wallet verifications
SELECT COUNT(*) FROM wallet_identities WHERE verified_at > now() - interval '24 hours';
```

---

## 🔧 Troubleshooting

### Issue: "NFT contract not configured"

**Solution:**
```bash
supabase secrets set MEMBERSHIP_NFT_ADDRESS="0x..."
```

### Issue: "Failed to query NFT balance from blockchain"

**Causes:**
1. Invalid Alchemy API key
2. Wrong NFT contract address
3. Alchemy rate limit exceeded
4. Network connectivity issues

**Solution:**
```bash
# Verify Alchemy API key
supabase secrets list | grep ALCHEMY_API_KEY_POLYGON

# Check Alchemy dashboard for quota/errors
# https://dashboard.alchemy.com/

# Test direct RPC call
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### Issue: "Invalid webhook signature"

**Causes:**
1. Wrong signing key
2. Webhook payload modified
3. Clock skew

**Solution:**
```bash
# Verify signing key matches Alchemy
supabase secrets list | grep ALCHEMY_WEBHOOK_SIGNING_KEY

# Check Alchemy webhook settings
# Dashboard → Webhooks → Your Webhook → Signing Key

# Test signature generation
./scripts/generate-webhook-payload.sh --sign
```

### Issue: Rate limits too aggressive

**Solution:**

Edit function code to adjust limits:

```typescript
// verify-nft/index.ts
const NFT_VERIFY_RATE_LIMIT_MAX = 50;  // Increase from 20
const CACHE_TTL_MS = 5 * 60 * 1000;    // Reduce from 10 to 5 minutes
```

Redeploy:
```bash
supabase functions deploy verify-nft
```

---

## 🔄 Updating Functions

### Update Single Function

```bash
# Make changes to code
vim supabase/functions/verify-nft/index.ts

# Redeploy
supabase functions deploy verify-nft

# Verify
supabase functions logs verify-nft --tail
```

### Update All Functions

```bash
for func in web3-nonce web3-verify verify-nft alchemy-webhook; do
  echo "Deploying $func..."
  supabase functions deploy $func
done
```

### Rollback Function

```bash
# View deployment history
supabase functions list

# Rollback to previous version (if supported)
# Or redeploy from git
git checkout HEAD~1 supabase/functions/verify-nft/index.ts
supabase functions deploy verify-nft
git checkout main supabase/functions/verify-nft/index.ts
```

---

## 🛡️ Security Best Practices

### 1. Secrets Management

```bash
# Never commit secrets
echo ".env.local" >> .gitignore
echo ".env" >> .gitignore

# Rotate keys periodically
supabase secrets set ALCHEMY_WEBHOOK_SIGNING_KEY="new-key"

# Use separate Alchemy apps for dev/staging/prod
supabase secrets set ALCHEMY_API_KEY_POLYGON="prod-key" --project-ref prod-ref
```

### 2. Function Permissions

```sql
-- Verify RLS policies are enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('wallet_identities', 'wallet_nonces', 'entitlements', 'chain_entitlements_cache');

-- Should all show rowsecurity = true
```

### 3. Monitoring & Alerts

Set up alerts for:
- ❌ High error rates (> 5%)
- ❌ Signature verification failures
- ❌ Rate limit exceeded
- ❌ Alchemy RPC failures
- ❌ Slow response times (> 2s)

---

## 📈 Performance Optimization

### 1. Cache Tuning

```typescript
// Adjust cache TTL based on traffic
const CACHE_TTL_MS = 10 * 60 * 1000;  // 10 minutes (default)
const CACHE_TTL_MS = 5 * 60 * 1000;   // 5 minutes (high traffic)
const CACHE_TTL_MS = 30 * 60 * 1000;  // 30 minutes (low traffic)
```

### 2. Rate Limit Tuning

```typescript
// Increase limits for verified users
const NFT_VERIFY_RATE_LIMIT_MAX = 100;  // Premium users
const NFT_VERIFY_RATE_LIMIT_MAX = 20;   // Free users
```

### 3. Database Indexing

Already optimized indexes:
- ✅ `idx_profiles_has_premium_nft` (partial index)
- ✅ `idx_chain_cache_wallet` (composite)
- ✅ `idx_wallet_nonces_nonce` (partial, unused only)

### 4. Alchemy Plan

Consider upgrading Alchemy plan if:
- Making > 300K requests/month
- Need higher rate limits
- Want dedicated infrastructure

---

## 📦 Production Deployment Checklist

- [ ] Database migrations applied (`supabase db push`)
- [ ] All secrets set in production
- [ ] Edge functions deployed
- [ ] Alchemy webhook configured
- [ ] Webhook signing key set
- [ ] Production tests passing
- [ ] Monitoring configured
- [ ] Error alerting set up
- [ ] Documentation updated
- [ ] Team trained on monitoring
- [ ] Rollback plan documented
- [ ] Load testing completed (if high traffic expected)

---

## 🎉 Post-Deployment

### Verify Deployment

```bash
# Run full test suite
./scripts/e2e-blockchain-test.sh --verbose

# Check all functions are live
curl https://your-project.supabase.co/functions/v1/web3-nonce -I
curl https://your-project.supabase.co/functions/v1/verify-nft -I
```

### Monitor First 24 Hours

- Check function logs every 2-4 hours
- Verify webhook events are processing
- Monitor error rates
- Check cache hit rates
- Verify NFT verifications are working

### Update Documentation

- Update main README with blockchain features
- Document NFT contract address
- Add examples to API docs
- Update changelog

---

## 🆘 Support

**Issues:**
- GitHub: https://github.com/apexbusiness-systems/OmniLink-APEX/issues
- Docs: `/docs/blockchain-functions.md`

**External Resources:**
- Alchemy: https://docs.alchemy.com/
- Supabase: https://supabase.com/docs/guides/functions
- viem: https://viem.sh/docs/introduction.html
