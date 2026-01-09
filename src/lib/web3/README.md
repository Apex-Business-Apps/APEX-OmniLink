# Web3 Verification Module

Phase 1 implementation of wallet authentication and NFT-based entitlement gating.

## Quick Start

### 1. Setup Provider

Wrap your app with `Web3Provider`:

```tsx
// src/App.tsx
import { Web3Provider } from '@/providers/Web3Provider';

function App() {
  return (
    <Web3Provider>
      <YourApp />
    </Web3Provider>
  );
}
```

### 2. Add Wallet Connect UI

```tsx
import { WalletConnect } from '@/components/WalletConnect';

function ProfilePage() {
  return <WalletConnect />;
}
```

### 3. Use Verification Hook

```tsx
import { useWalletVerification } from '@/hooks/useWalletVerification';

function MyComponent() {
  const { walletState, verify, disconnect } = useWalletVerification();

  return (
    <div>
      <p>Status: {walletState.status}</p>
      <p>Verified: {walletState.isVerified ? 'Yes' : 'No'}</p>
      {walletState.address && <p>Address: {walletState.address}</p>}
    </div>
  );
}
```

### 4. Check Entitlements

```tsx
import { checkEntitlement } from '@/lib/web3/entitlements';

async function checkNFTAccess(walletAddress: string) {
  const result = await checkEntitlement({
    walletAddress,
    chainId: 1,
    contractAddress: '0xYourNFTContract',
    entitlementKey: 'nft:premium-access',
  });

  return result.hasEntitlement; // true/false
}
```

## Environment Setup

Required `.env.local` variables:

```env
VITE_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-id
```

SIWE origins allowlist (edge functions):

```env
SIWE_ALLOWED_ORIGINS=https://app.omnihub.dev,http://localhost:5173
```

SIWE messages are generated server-side using viem utilities and include chainId, domain, uri, issuedAt, and expirationTime.

## Files

- `config.ts` - wagmi configuration and supported chains
- `types.ts` - TypeScript type definitions
- `entitlements.ts` - NFT ownership checking with caching
- `guardrails.ts` - Security middleware and rate limiting

## Documentation

Full documentation: `/docs/WEB3_VERIFICATION_RUNBOOK.md`
