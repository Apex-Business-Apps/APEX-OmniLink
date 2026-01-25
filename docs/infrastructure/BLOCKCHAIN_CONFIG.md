# Blockchain Configuration Guide

## Overview

This guide covers the configuration of blockchain and Web3 capabilities for the APEX OmniLink platform. The system integrates wallet authentication, NFT-based access control, and real-time blockchain event synchronization.

## Security Architecture

**CRITICAL SECURITY REQUIREMENTS:**
- **NEVER** hardcode private keys or API keys in code
- **ALWAYS** load secrets from environment variables
- All blockchain secrets must be set in Supabase project settings
- Private keys should only be accessible to edge functions via service role
- Use RLS (Row Level Security) to enforce zero-trust access control

## Required Environment Variables

### 1. WEB3_PRIVATE_KEY

**Purpose:** OmniLink's EVM private key for transaction signing (e.g., minting NFTs)

**How to Generate:**
```bash
# Using a Node.js script with ethers.js
npx ts-node -e "const {Wallet} = require('ethers'); const wallet = Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

**Format:** 64-character hex string (with or without `0x` prefix)

**Where to Set:**
- **Local Development:** Add to `.env.local` (NEVER commit this file)
- **Supabase Production:** Set in Supabase Dashboard → Project Settings → Edge Functions → Environment Variables

**Security Notes:**
- This key controls the wallet that mints NFTs and signs transactions
- Ensure the wallet is funded with native tokens (ETH/MATIC) for gas fees
- Store backup/recovery phrase securely offline
- Consider using a hardware wallet for production key management

### 2. ALCHEMY_API_KEY_ETH

**Purpose:** Alchemy API key for Ethereum mainnet RPC access

**How to Obtain:**
1. Go to [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Create a new app: "APEX OmniLink - Ethereum"
3. Select "Ethereum" → "Mainnet" (or "Sepolia" for testnet)
4. Copy the API key

**Where to Set:**
- Local: `.env.local`
- Production: Supabase Edge Functions environment variables

### 3. ALCHEMY_API_KEY_POLYGON

**Purpose:** Alchemy API key for Polygon RPC access (recommended for lower gas fees)

**How to Obtain:**
1. Alchemy Dashboard → Create new app: "APEX OmniLink - Polygon"
2. Select "Polygon" → "Mainnet" (or "Mumbai" for testnet)
3. Copy the API key

**Where to Set:**
- Local: `.env.local`
- Production: Supabase Edge Functions environment variables

**Recommendation:** Use Polygon for production to minimize transaction costs while maintaining EVM compatibility.

### 4. MEMBERSHIP_NFT_ADDRESS

**Purpose:** Address of the deployed APEXMembershipNFT ERC721 contract

**How to Obtain:**
1. Deploy the `APEXMembershipNFT` smart contract (see Smart Contract Deployment below)
2. Copy the deployed contract address from the deployment transaction

**Format:** Ethereum address (42-character hex string starting with `0x`)

**Example:** `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`

**Where to Set:**
- Local: `.env.local`
- Production: Supabase Edge Functions environment variables

### 5. ALCHEMY_WEBHOOK_SIGNING_KEY

**Purpose:** Secret key to verify Alchemy webhook requests are authentic (prevents spoofing)

**How to Obtain:**
1. Alchemy Dashboard → Webhooks → Create Webhook
2. Set webhook URL to: `https://<your-project>.supabase.co/functions/v1/alchemy-webhook`
3. Add contract address (`MEMBERSHIP_NFT_ADDRESS`) to watch
4. Select event: "NFT Activity" → "Transfer"
5. Copy the "Signing Key" from webhook settings

**Where to Set:**
- Production: Supabase Edge Functions environment variables
- Local testing: Can be omitted or set to test value

## Smart Contract Deployment

### APEXMembershipNFT Contract

**Technology:** OpenZeppelin ERC721 standard

**Deployment Steps:**

1. **Install Dependencies:**
```bash
npm install --save-dev hardhat @openzeppelin/contracts @nomicfoundation/hardhat-toolbox
```

2. **Create Contract:**
Create `contracts/APEXMembershipNFT.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract APEXMembershipNFT is ERC721, Ownable {
    uint256 private _tokenIds;

    constructor() ERC721("APEX Premium Membership", "APEX") Ownable(msg.sender) {}

    function mint(address to) public onlyOwner returns (uint256) {
        _tokenIds++;
        _mint(to, _tokenIds);
        return _tokenIds;
    }
}
```

3. **Deploy Script:**
Create `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const APEXMembershipNFT = await hre.ethers.getContractFactory("APEXMembershipNFT");
  const nft = await APEXMembershipNFT.deploy();
  await nft.waitForDeployment();

  console.log("APEXMembershipNFT deployed to:", await nft.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

4. **Deploy to Network:**
```bash
# For Polygon Mainnet
npx hardhat run scripts/deploy.js --network polygon

# For Testnet (Polygon Mumbai)
npx hardhat run scripts/deploy.js --network mumbai
```

5. **Save Contract Address:**
- Copy the deployed contract address
- Add to `.env.local` as `MEMBERSHIP_NFT_ADDRESS`
- Add to Supabase production environment variables

## Supabase Configuration

### config.toml Settings

The `supabase/config.toml` file has been configured with:

1. **Web3 Auth Providers:**
```toml
[auth.external.ethereum]
enabled = true

[auth.external.solana]
enabled = false  # Enable when Solana support is needed
```

2. **Edge Function JWT Verification:**
```toml
[functions.web3-nonce]
verify_jwt = false  # Public endpoint

[functions.web3-verify]
verify_jwt = false  # Public endpoint

[functions.verify-nft]
verify_jwt = true  # Requires authentication

[functions.alchemy-webhook]
verify_jwt = false  # Uses signature verification instead
```

### Setting Environment Variables in Supabase

**For Production:**

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project: `wwajmaohwcbooljdureo`
3. Navigate to: **Project Settings** → **Edge Functions** → **Environment Variables**
4. Add each variable:
   - `WEB3_PRIVATE_KEY`
   - `ALCHEMY_API_KEY_ETH`
   - `ALCHEMY_API_KEY_POLYGON`
   - `MEMBERSHIP_NFT_ADDRESS`
   - `ALCHEMY_WEBHOOK_SIGNING_KEY`

5. **IMPORTANT:** After adding variables, redeploy all edge functions:
```bash
supabase functions deploy web3-nonce
supabase functions deploy web3-verify
supabase functions deploy verify-nft
supabase functions deploy alchemy-webhook
```

### Testing Environment Variables

Verify edge functions can access secrets:

```bash
# Test locally with .env.local
supabase functions serve web3-nonce --env-file .env.local

# Test in production (after deployment)
curl -X POST https://<project>.supabase.co/functions/v1/verify-nft \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json"
```

## Alchemy Webhook Configuration

### Setup Steps

1. **Create Webhook in Alchemy:**
   - Dashboard → Webhooks → Create Webhook
   - **Webhook URL:** `https://<project-id>.supabase.co/functions/v1/alchemy-webhook`
   - **Network:** Match your deployment (Polygon Mainnet, etc.)
   - **Type:** Address Activity

2. **Add Contract to Monitor:**
   - Paste `MEMBERSHIP_NFT_ADDRESS` value
   - Select event types: **NFT Transfers**

3. **Configure Webhook Settings:**
   - Enable "Include Removed Logs": No (to avoid reorg handling complexity)
   - Max Blocks per Webhook: 1000
   - Copy the **Signing Key**

4. **Set Signing Key:**
   - Add `ALCHEMY_WEBHOOK_SIGNING_KEY` to Supabase environment variables

### Webhook Security

The `alchemy-webhook` function will:
1. Verify the `X-Alchemy-Signature` header using the signing key
2. Reject requests with invalid signatures
3. Process only Transfer events for the configured NFT contract
4. Update `profiles.has_premium_nft` based on wallet ownership changes

## Security Checklist

Before deploying to production:

- [ ] All environment variables set in Supabase Dashboard (NOT in code)
- [ ] `.env.local` is in `.gitignore` and never committed
- [ ] WEB3_PRIVATE_KEY wallet is funded with gas tokens
- [ ] WEB3_PRIVATE_KEY has owner/minter role on NFT contract
- [ ] Alchemy webhook signing key is set and verified
- [ ] RLS policies on `profiles` table prevent users from self-granting `has_premium_nft`
- [ ] Edge functions use service role key for admin operations
- [ ] Rate limiting enabled on public endpoints (`web3-nonce`, `web3-verify`)
- [ ] Monitoring/alerting configured for failed webhook deliveries
- [ ] Test NFT mint and transfer on testnet before production

## Troubleshooting

### "Insufficient funds for gas" Error
- Ensure the wallet associated with `WEB3_PRIVATE_KEY` has native tokens (ETH/MATIC)
- Check balance: `https://polygonscan.com/address/<your-address>`

### Alchemy Webhook Not Triggering
1. Check webhook status in Alchemy Dashboard
2. Verify webhook URL is correct and publicly accessible
3. Test edge function directly: `curl -X POST <webhook-url>`
4. Check Supabase Edge Function logs for errors

### "Invalid signature" on Webhook Requests
- Verify `ALCHEMY_WEBHOOK_SIGNING_KEY` matches the key in Alchemy Dashboard
- Check that signature verification logic in `alchemy-webhook.ts` is correct
- Ensure edge function has been redeployed after setting the key

### Users Not Getting NFT Flag Updated
- Check `alchemy-webhook` function logs for processing errors
- Verify RLS policies allow service role to update `profiles.has_premium_nft`
- Manually trigger a test transfer and watch logs
- Check `chain_tx_log` table for idempotency records

## Support & References

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Alchemy Webhooks Guide](https://docs.alchemy.com/docs/using-notify)
- [OpenZeppelin ERC721 Docs](https://docs.openzeppelin.com/contracts/4.x/erc721)
- [Viem (Ethereum Library) Docs](https://viem.sh/)
- [SIWE (Sign-In with Ethereum)](https://docs.login.xyz/)

## Emergency Contacts

If you encounter critical issues with blockchain integration:
- Check Supabase project logs: Dashboard → Logs → Edge Functions
- Monitor Alchemy dashboard for RPC errors or rate limits
- Review GitHub issues: https://github.com/anthropics/claude-code/issues
