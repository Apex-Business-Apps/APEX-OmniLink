# Blockchain Integration Deployment Checklist

## Pre-Deployment (Development & Testing)

### 1. Smart Contract Deployment
- [ ] Install smart contract development dependencies (Hardhat, OpenZeppelin)
- [ ] Create `APEXMembershipNFT.sol` contract with ERC721 standard
- [ ] Write deployment script
- [ ] Deploy to testnet (Polygon Mumbai or Ethereum Sepolia)
- [ ] Verify contract on block explorer (Polygonscan/Etherscan)
- [ ] Test minting NFTs to test addresses
- [ ] Test transfer events are emitted correctly
- [ ] Save testnet contract address
- [ ] Fund deployer wallet with testnet gas tokens

### 2. Local Development Setup
- [ ] Copy `.env.example` to `.env.local`
- [ ] Generate test WEB3_PRIVATE_KEY (or use testnet wallet)
- [ ] Create Alchemy apps for testnet (Mumbai/Sepolia)
- [ ] Set `ALCHEMY_API_KEY_ETH` and `ALCHEMY_API_KEY_POLYGON` in `.env.local`
- [ ] Set testnet `MEMBERSHIP_NFT_ADDRESS` in `.env.local`
- [ ] Verify `.env.local` is in `.gitignore`
- [ ] NEVER commit `.env.local` to git

### 3. Database Schema
- [ ] Review database migration scripts for Web3 tables
- [ ] Apply migrations to local Supabase:
  - `profiles.wallet_address` column (TEXT UNIQUE)
  - `profiles.has_premium_nft` column (BOOLEAN DEFAULT FALSE)
  - `chain_tx_log` table for idempotency
- [ ] Update `handle_new_user()` function to handle Web3 signups
- [ ] Test migration locally: `supabase db reset`

### 4. Edge Functions - Local Testing
- [ ] Implement `web3-nonce` function (generates nonce for wallet signature)
- [ ] Implement `web3-verify` function (verifies SIWE signature, creates session)
- [ ] Implement `verify-nft` function (checks NFT ownership via RPC)
- [ ] Implement `alchemy-webhook` function (processes Transfer events)
- [ ] Test functions locally:
  ```bash
  supabase functions serve --env-file .env.local
  # Test each endpoint with curl or Postman
  ```
- [ ] Verify signature validation works in `web3-verify`
- [ ] Verify RPC calls succeed in `verify-nft`
- [ ] Test webhook signature verification in `alchemy-webhook`

### 5. Frontend Integration - Local Testing
- [ ] Install Web3 dependencies (`wagmi`, `viem`, `@walletconnect/modal`)
- [ ] Implement "Connect Wallet" UI component
- [ ] Test MetaMask connection flow
- [ ] Test WalletConnect connection flow (mobile wallets)
- [ ] Test SIWE signature flow
- [ ] Test session creation after successful wallet auth
- [ ] Verify `profile.has_premium_nft` loads correctly
- [ ] Test premium content gating based on NFT ownership
- [ ] Test UI refresh after NFT transfer (real-time updates)

### 6. Security Testing (Local)
- [ ] Verify private keys are loaded from env, never hardcoded
- [ ] Test RLS policies prevent users from modifying their own `has_premium_nft`
- [ ] Verify only service role can update `has_premium_nft`
- [ ] Test rate limiting on `web3-nonce` endpoint
- [ ] Test webhook rejects invalid signatures
- [ ] Test idempotency - duplicate webhook events don't double-process
- [ ] Verify JWT verification works on protected endpoints

### 7. Integration Testing
- [ ] Set up Alchemy webhook pointing to local tunnel (ngrok/localtunnel)
- [ ] Mint test NFT to test wallet
- [ ] Verify webhook fires and `has_premium_nft` updates to true
- [ ] Transfer NFT away
- [ ] Verify `has_premium_nft` updates to false
- [ ] Test full user journey:
  1. New user connects wallet
  2. Profile created with wallet_address
  3. User doesn't have NFT → premium features locked
  4. Admin mints NFT to user
  5. Webhook updates flag → premium features unlocked

---

## Production Deployment

### 8. Mainnet Smart Contract Deployment
- [ ] Audit smart contract code (or use verified OpenZeppelin contracts)
- [ ] Create mainnet Hardhat config with secure key management
- [ ] Deploy `APEXMembershipNFT` to production network (Polygon Mainnet recommended)
- [ ] Verify contract on Polygonscan/Etherscan
- [ ] Transfer contract ownership to secure multi-sig wallet (optional but recommended)
- [ ] Fund deployer wallet with production gas tokens (MATIC/ETH)
- [ ] Save production contract address securely
- [ ] Test mint one NFT on mainnet to verify functionality

### 9. Supabase Production Configuration
- [ ] Go to Supabase Dashboard → Project Settings
- [ ] Navigate to Edge Functions → Environment Variables
- [ ] Add production secrets (CRITICAL: Use production values, not testnet):
  - [ ] `WEB3_PRIVATE_KEY` (production wallet private key)
  - [ ] `ALCHEMY_API_KEY_ETH` (production Ethereum Alchemy app)
  - [ ] `ALCHEMY_API_KEY_POLYGON` (production Polygon Alchemy app)
  - [ ] `MEMBERSHIP_NFT_ADDRESS` (mainnet contract address)
  - [ ] `ALCHEMY_WEBHOOK_SIGNING_KEY` (from production webhook)
- [ ] Verify production wallet is funded with gas tokens
- [ ] Verify production wallet has minter role on NFT contract

### 10. Database Migration - Production
- [ ] Review migration scripts one final time
- [ ] Apply migrations to production Supabase:
  ```bash
  supabase db push
  ```
- [ ] Verify schema changes applied:
  - `profiles.wallet_address` exists
  - `profiles.has_premium_nft` exists with default FALSE
  - `chain_tx_log` table exists
  - `handle_new_user()` function updated
- [ ] Test with one production user (if possible)

### 11. Edge Functions Deployment
- [ ] Deploy all Web3 functions to production:
  ```bash
  supabase functions deploy web3-nonce
  supabase functions deploy web3-verify
  supabase functions deploy verify-nft
  supabase functions deploy alchemy-webhook
  ```
- [ ] Verify deployment success in Supabase Dashboard
- [ ] Check function logs for startup errors
- [ ] Test each endpoint manually:
  - `POST /web3-nonce` → should return nonce
  - `POST /web3-verify` → test with valid signature
  - `GET /verify-nft` → test with authenticated user
  - `POST /alchemy-webhook` → test with valid signature

### 12. Alchemy Production Webhook Setup
- [ ] Go to Alchemy Dashboard
- [ ] Create new production webhook:
  - **URL:** `https://<project-id>.supabase.co/functions/v1/alchemy-webhook`
  - **Network:** Polygon Mainnet (or chosen production network)
  - **Type:** Address Activity
- [ ] Add contract address to monitor: `MEMBERSHIP_NFT_ADDRESS`
- [ ] Select event types: NFT Transfers
- [ ] Copy webhook signing key
- [ ] Add signing key to Supabase env vars as `ALCHEMY_WEBHOOK_SIGNING_KEY`
- [ ] Redeploy `alchemy-webhook` function after adding key
- [ ] Test webhook with "Test Webhook" button in Alchemy Dashboard
- [ ] Verify edge function receives and processes test event

### 13. Frontend Production Build
- [ ] Update frontend config for production:
  - Set `VITE_WEB3_NETWORK=polygon` (or chosen network)
  - Set `VITE_ENABLE_WEB3=true`
  - Verify Supabase URL and keys are for production
- [ ] Build production frontend:
  ```bash
  npm run build
  ```
- [ ] Test production build locally:
  ```bash
  npm run preview
  ```
- [ ] Deploy to production hosting (Vercel, Netlify, etc.)
- [ ] Verify wallet connection works on production domain
- [ ] Test full authentication flow in production

### 14. Post-Deployment Verification
- [ ] Test Web3 login with MetaMask on production site
- [ ] Test Web3 login with WalletConnect on production site
- [ ] Create test account via wallet authentication
- [ ] Verify `profiles.wallet_address` is set correctly
- [ ] Mint test NFT to production test wallet
- [ ] Verify webhook triggers and `has_premium_nft` updates
- [ ] Verify premium content is unlocked for NFT holders
- [ ] Transfer NFT away and verify flag updates to false
- [ ] Check all edge function logs for errors

### 15. Monitoring & Alerting
- [ ] Set up Supabase Edge Function monitoring
  - Enable email alerts for function errors
  - Monitor function invocation counts
  - Watch for rate limit violations
- [ ] Set up Alchemy monitoring
  - Enable webhook delivery failure alerts
  - Monitor RPC call usage and rate limits
  - Watch for wallet balance alerts (low gas funds)
- [ ] Create dashboard for key metrics:
  - Number of Web3 logins per day
  - NFT mints per week
  - Webhook processing success rate
  - Average signature verification time

### 16. Security Hardening (Production)
- [ ] Review RLS policies on all tables
  - `profiles`: Users can read own data, can't modify `has_premium_nft`
  - `chain_tx_log`: Only service role can read/write
- [ ] Enable rate limiting on public endpoints:
  - `web3-nonce`: Max 10 requests/minute per IP
  - `web3-verify`: Max 5 requests/minute per IP
- [ ] Rotate webhook signing key and update in Supabase
- [ ] Set up IP allowlist for webhook endpoint (if Alchemy provides static IPs)
- [ ] Enable Supabase audit logging
- [ ] Review all edge function permissions
- [ ] Ensure service role key is only used server-side

### 17. Documentation & Training
- [ ] Share BLOCKCHAIN_CONFIG.md with team
- [ ] Document contract addresses in team wiki
- [ ] Create runbook for common operations:
  - How to mint NFTs for users
  - How to investigate webhook failures
  - How to rotate keys
- [ ] Train support team on Web3 login troubleshooting
- [ ] Document emergency procedures (key compromise, contract exploit)

### 18. Rollout Strategy
- [ ] Enable feature flag: `VITE_ENABLE_WEB3=true`
- [ ] Soft launch: Enable for internal team only
- [ ] Monitor for 48 hours, check logs and error rates
- [ ] Gradual rollout: Enable for 10% of users
- [ ] Monitor metrics: login success rate, NFT verification latency
- [ ] Full rollout: Enable for all users
- [ ] Announce Web3 features to users (blog post, email, etc.)

---

## Post-Launch Monitoring (First 30 Days)

### Week 1
- [ ] Daily check of edge function error logs
- [ ] Monitor webhook delivery success rate (should be >99%)
- [ ] Check wallet balance daily (ensure gas funds available)
- [ ] Review user feedback on Web3 login experience
- [ ] Track NFT mints and transfers

### Week 2-4
- [ ] Weekly review of security logs
- [ ] Analyze Web3 login adoption rate
- [ ] Identify and fix any UX friction points
- [ ] Optimize RPC call caching if needed
- [ ] Review and optimize rate limits based on usage

### Ongoing
- [ ] Monthly security audit of RLS policies
- [ ] Quarterly key rotation (webhook signing key, Alchemy API keys)
- [ ] Annual smart contract security review
- [ ] Monitor blockchain network upgrades (Polygon hardforks, etc.)

---

## Rollback Plan

If critical issues arise:

1. **Immediate Rollback:**
   - Set `VITE_ENABLE_WEB3=false` in frontend
   - Redeploy frontend (disables wallet connect UI)
   - Existing users with NFTs retain access via DB flag

2. **Partial Rollback:**
   - Disable Alchemy webhook (stops auto-updates)
   - Keep Web3 login enabled
   - Manually update `has_premium_nft` flags if needed

3. **Full Rollback:**
   - Disable Web3 auth in Supabase config
   - Remove Web3 UI components via feature flag
   - Preserve database schema (don't drop columns)
   - Keep edge functions deployed but unused

---

## Emergency Contacts

- **Blockchain Lead:** [Name/Email]
- **Supabase Admin:** [Name/Email]
- **Security Team:** [Email/Slack Channel]
- **Alchemy Support:** https://docs.alchemy.com/reference/support

---

## Success Criteria

Deployment is successful when:
- ✅ Users can authenticate with MetaMask and WalletConnect
- ✅ NFT ownership is verified within 5 seconds
- ✅ Webhook processes Transfer events within 1 minute
- ✅ Zero unauthorized access to premium features
- ✅ >99% uptime for Web3 authentication
- ✅ No private keys exposed in code or logs
- ✅ All RLS policies enforced correctly
