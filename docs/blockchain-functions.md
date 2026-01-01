# Blockchain Edge Functions Documentation

## Overview

OmniLink APEX includes four blockchain edge functions for Web3 wallet authentication and NFT-based access control.

## Function Suite

| Function | Endpoint | Method | Auth | Rate Limit | Purpose |
|----------|----------|--------|------|------------|---------|
| `web3-nonce` | `/functions/v1/web3-nonce` | POST | Public | 5/min per IP | Generate signature nonce |
| `web3-verify` | `/functions/v1/web3-verify` | POST | JWT | 10/hour per user | Verify wallet signature |
| `verify-nft` | `/functions/v1/verify-nft` | GET | JWT | 20/hour per user | Check NFT ownership |
| `alchemy-webhook` | `/functions/v1/alchemy-webhook` | POST | Signature | N/A | Process blockchain events |

---

## 1. web3-nonce - Nonce Generation

**Purpose:** Generate cryptographically secure nonces for wallet signature challenges.

### Request

```bash
curl -X POST https://your-project.supabase.co/functions/v1/web3-nonce \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

### Response

```json
{
  "nonce": "a1b2c3d4e5f6...",
  "message": "Welcome to OmniLink APEX!\n\nSign this message to verify your wallet ownership.\n\nWallet: 0x742d35cc6634c0532925a3b844bc9e7595f0beb\nNonce: a1b2c3d4e5f6...\n\nThis request will not trigger a blockchain transaction or cost any gas fees.",
  "expires_at": "2026-01-01T12:05:00.000Z"
}
```

### Features

- ✅ **Idempotent:** Returns existing active nonce if available
- ✅ **5-minute expiration:** Nonces expire automatically
- ✅ **Rate limited:** 5 requests/minute per IP address
- ✅ **No authentication required:** Public endpoint

---

## 2. web3-verify - Signature Verification

**Purpose:** Verify wallet signature and link wallet to authenticated user.

### Request

```bash
curl -X POST https://your-project.supabase.co/functions/v1/web3-verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "signature": "0x1234567890abcdef...",
    "message": "Welcome to OmniLink APEX!..."
  }'
```

### Response

```json
{
  "success": true,
  "wallet_identity_id": "uuid-here",
  "wallet_address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "chain_id": 1
}
```

### Features

- ✅ **Cryptographic verification:** Uses viem for signature validation
- ✅ **Nonce validation:** Ensures nonce is unused and not expired
- ✅ **Rate limited:** 10 attempts/hour per user
- ✅ **Audit logging:** All attempts logged for security
- ✅ **Fail-closed:** Rejects on any verification error

---

## 3. verify-nft - NFT Ownership Verification

**Purpose:** Check if user owns APEXMembershipNFT for premium access.

### Request

```bash
# Basic request (uses cache if available)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-project.supabase.co/functions/v1/verify-nft

# Force blockchain refresh
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://your-project.supabase.co/functions/v1/verify-nft?force_refresh=true"
```

### Response

```json
{
  "has_premium_nft": true,
  "wallet_address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
  "nft_balance": 1,
  "verified_at": "2026-01-01T12:00:00.000Z",
  "cached": false
}
```

### Response (No Wallet Connected)

```json
{
  "has_premium_nft": false,
  "wallet_address": null,
  "nft_balance": 0,
  "verified_at": "2026-01-01T12:00:00.000Z",
  "cached": false,
  "message": "No wallet connected"
}
```

### Features

- ✅ **Blockchain RPC:** Queries Polygon mainnet via Alchemy
- ✅ **10-minute cache:** Results cached in `chain_entitlements_cache`
- ✅ **Rate limited:** 20 requests/hour per user
- ✅ **Profile updates:** Automatically updates `profiles.has_premium_nft`
- ✅ **Force refresh:** Skip cache with `?force_refresh=true`
- ✅ **Cache headers:** Returns `Cache-Control` for CDN optimization

### Headers

```
X-RateLimit-Remaining: 19
Cache-Control: public, max-age=600
```

---

## 4. alchemy-webhook - Blockchain Event Processor

**Purpose:** Process NFT Transfer events from Alchemy webhooks.

### Configuration

1. **Create Alchemy Webhook:**
   - Go to [Alchemy Dashboard](https://dashboard.alchemy.com/)
   - Navigate to Webhooks → Create Webhook
   - Type: `NFT Activity`
   - Network: `Polygon Mainnet`
   - Addresses to Watch: `MEMBERSHIP_NFT_ADDRESS`
   - Webhook URL: `https://your-project.supabase.co/functions/v1/alchemy-webhook`
   - Copy the **Signing Key**

2. **Set Environment Variable:**
   ```bash
   ALCHEMY_WEBHOOK_SIGNING_KEY=your-signing-key-here
   ```

### Webhook Payload

Alchemy sends:

```json
{
  "webhookId": "wh_abc123",
  "id": "whevt_xyz789",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "type": "NFT_ACTIVITY",
  "event": {
    "network": "MATIC_MAINNET",
    "activity": [
      {
        "fromAddress": "0x0000000000000000000000000000000000000000",
        "toAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "contractAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "tokenId": "1",
        "category": "erc721",
        "log": {
          "blockNumber": "0x1234567",
          "transactionHash": "0xabcdef..."
        }
      }
    ]
  }
}
```

### Response

```json
{
  "success": true,
  "processed": 1,
  "webhook_id": "wh_abc123"
}
```

### Features

- ✅ **HMAC-SHA256 verification:** Validates webhook authenticity
- ✅ **Idempotent:** Skips already-processed webhooks
- ✅ **Cache invalidation:** Clears NFT cache for affected wallets
- ✅ **Profile updates:** Marks users for re-verification
- ✅ **Audit logging:** Logs all webhook processing
- ✅ **Fail-closed:** Rejects unsigned/invalid webhooks

### Security

The webhook:
- ✅ Only processes `MEMBERSHIP_NFT_ADDRESS` contract
- ✅ Verifies `X-Alchemy-Signature` header
- ✅ Uses constant-time signature comparison
- ✅ Logs to `audit_logs` table
- ✅ No user data exposed in responses

---

## Testing

### Quick Test Script

```bash
./scripts/test-blockchain-functions.sh
```

This script tests:
1. ✅ NFT verification (cached)
2. ✅ NFT verification (force refresh)
3. ✅ Authentication rejection
4. ✅ Webhook signature validation
5. ✅ Rate limiting headers

### Manual Testing

#### Get a JWT Token

**Option 1: Browser DevTools**
1. Login to your app
2. Open DevTools → Application → Local Storage
3. Find `sb-<project>-auth-token`
4. Copy the `access_token` value

**Option 2: Programmatic**
```bash
curl -X POST https://your-project.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Test verify-nft

```bash
export JWT="your-jwt-token-here"

# Test cached response
curl -H "Authorization: Bearer $JWT" \
  https://your-project.supabase.co/functions/v1/verify-nft

# Test force refresh
curl -H "Authorization: Bearer $JWT" \
  "https://your-project.supabase.co/functions/v1/verify-nft?force_refresh=true"
```

---

## Environment Variables

Required environment variables:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Alchemy RPC
ALCHEMY_API_KEY_POLYGON=your-polygon-alchemy-key

# NFT Contract
MEMBERSHIP_NFT_ADDRESS=0x...  # APEXMembershipNFT contract address

# Webhook Security
ALCHEMY_WEBHOOK_SIGNING_KEY=your-webhook-signing-key
```

---

## Database Schema

### wallet_identities

Stores verified wallet-to-user mappings.

```sql
CREATE TABLE wallet_identities (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  wallet_address text NOT NULL,
  chain_id integer NOT NULL,
  signature text NOT NULL,
  message text NOT NULL,
  verified_at timestamptz DEFAULT now(),
  UNIQUE(wallet_address, chain_id)
);
```

### chain_entitlements_cache

Caches expensive blockchain queries.

```sql
CREATE TABLE chain_entitlements_cache (
  id uuid PRIMARY KEY,
  wallet_address text NOT NULL,
  chain_id integer NOT NULL,
  query_type text NOT NULL,  -- 'nft_balance'
  query_params jsonb NOT NULL,
  data jsonb NOT NULL,
  refreshed_at timestamptz DEFAULT now(),
  UNIQUE(wallet_address, chain_id, query_type, query_params)
);
```

### profiles (new columns)

Tracks NFT ownership status.

```sql
ALTER TABLE profiles
  ADD COLUMN has_premium_nft BOOLEAN DEFAULT FALSE,
  ADD COLUMN nft_verified_at TIMESTAMPTZ;
```

---

## Rate Limits

| Function | Limit | Window | Key |
|----------|-------|--------|-----|
| web3-nonce | 5 | 1 minute | IP address |
| web3-verify | 10 | 1 hour | User ID |
| verify-nft | 20 | 1 hour | User ID |
| alchemy-webhook | N/A | N/A | Signature only |

Rate limit headers returned:

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 19
X-RateLimit-Reset: 2026-01-01T13:00:00.000Z
Retry-After: 3600
```

---

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Check request payload format |
| 401 | Unauthorized | Provide valid JWT or webhook signature |
| 405 | Method Not Allowed | Use correct HTTP method (GET/POST) |
| 429 | Too Many Requests | Wait for rate limit reset |
| 500 | Internal Server Error | Check logs, verify configuration |

---

## Architecture Diagram

```
┌─────────────────┐
│   Frontend      │
│   (React App)   │
└────────┬────────┘
         │
         │ 1. Request nonce
         ▼
┌─────────────────┐
│  web3-nonce     │◄─── No auth required
│  Edge Function  │
└────────┬────────┘
         │
         │ 2. Return nonce
         ▼
┌─────────────────┐
│  User Signs     │
│  with Wallet    │
└────────┬────────┘
         │
         │ 3. Submit signature
         ▼
┌─────────────────┐
│  web3-verify    │◄─── JWT required
│  Edge Function  │
└────────┬────────┘
         │
         │ 4. Wallet linked
         ▼
┌─────────────────┐
│  verify-nft     │◄─── JWT required
│  Edge Function  │
│                 │
│  ┌───────────┐  │
│  │ Check     │  │
│  │ Cache     │  │
│  └─────┬─────┘  │
│        │        │
│        ▼        │
│  ┌───────────┐  │
│  │ Query     │  │
│  │ Alchemy   │◄─┼─── Polygon RPC
│  │ RPC       │  │
│  └───────────┘  │
└────────┬────────┘
         │
         │ 5. NFT status
         ▼
┌─────────────────┐
│  Update         │
│  profiles       │
└─────────────────┘

         ┌────────────────┐
         │  Alchemy       │
         │  Webhook       │
         └────────┬───────┘
                  │
                  │ NFT Transfer event
                  ▼
         ┌─────────────────┐
         │ alchemy-webhook │◄─── Signature verify
         │ Edge Function   │
         └────────┬────────┘
                  │
                  │ Invalidate cache
                  ▼
         ┌─────────────────┐
         │  Clear cache    │
         │  Mark profiles  │
         └─────────────────┘
```

---

## Security Best Practices

1. **Never commit secrets:**
   - Keep `.env.local` in `.gitignore`
   - Use Supabase secrets for production

2. **Rotate signing keys:**
   - Change `ALCHEMY_WEBHOOK_SIGNING_KEY` periodically
   - Update in both Alchemy dashboard and Supabase

3. **Monitor rate limits:**
   - Track `X-RateLimit-*` headers
   - Implement exponential backoff

4. **Validate all inputs:**
   - All functions validate wallet address format
   - Signatures verified cryptographically
   - Webhooks require HMAC signature

5. **Audit logging:**
   - All webhook processing logged to `audit_logs`
   - Signature verification failures logged
   - Enable Supabase function logs in production

---

## Troubleshooting

### "NFT contract not configured"

**Solution:** Set `MEMBERSHIP_NFT_ADDRESS` in environment:
```bash
# In Supabase Dashboard → Edge Functions → Secrets
MEMBERSHIP_NFT_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### "Invalid webhook signature"

**Causes:**
1. Wrong `ALCHEMY_WEBHOOK_SIGNING_KEY`
2. Payload modified in transit
3. Replay attack (already processed)

**Solution:**
- Verify signing key matches Alchemy dashboard
- Check webhook logs in Alchemy dashboard
- Ensure webhook ID is unique

### "Failed to query NFT balance from blockchain"

**Causes:**
1. Missing `ALCHEMY_API_KEY_POLYGON`
2. Wrong NFT contract address
3. Alchemy API quota exceeded
4. Network issues

**Solution:**
- Verify Alchemy API key is valid
- Check contract is deployed on Polygon
- Review Alchemy dashboard for quota/errors

### Rate limit errors

**Response:**
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 3600
}
```

**Solution:**
- Wait for rate limit window to reset
- Implement client-side rate limit tracking
- Use `X-RateLimit-Reset` header for retry timing

---

## Production Deployment

### 1. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy web3-nonce
supabase functions deploy web3-verify
supabase functions deploy verify-nft
supabase functions deploy alchemy-webhook
```

### 2. Run Migrations

```bash
supabase db push
```

### 3. Set Secrets

```bash
supabase secrets set ALCHEMY_API_KEY_POLYGON=your-key
supabase secrets set MEMBERSHIP_NFT_ADDRESS=0x...
supabase secrets set ALCHEMY_WEBHOOK_SIGNING_KEY=your-signing-key
```

### 4. Configure Alchemy Webhook

- URL: `https://your-project.supabase.co/functions/v1/alchemy-webhook`
- Network: Polygon Mainnet
- Type: NFT Activity
- Contract: `MEMBERSHIP_NFT_ADDRESS`

### 5. Test in Production

```bash
./scripts/test-blockchain-functions.sh
```

---

## Support

For issues or questions:
- GitHub: https://github.com/apexbusiness-systems/OmniLink-APEX/issues
- Docs: `/docs/blockchain-functions.md`
- Alchemy: https://docs.alchemy.com/reference/webhooks
- Supabase: https://supabase.com/docs/guides/functions
