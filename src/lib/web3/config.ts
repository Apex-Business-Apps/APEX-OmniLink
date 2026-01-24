/**
 * Web3 Configuration
 *
 * Purpose: Configure wagmi and Web3 providers
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { createConfig, http } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect project ID (should be set via environment variable)
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

// Configure supported chains
export const supportedChains = [mainnet, polygon, optimism, arbitrum] as const;

// Configure RPC transports
const transports = {
  [mainnet.id]: http(import.meta.env.VITE_ETHEREUM_RPC_URL || mainnet.rpcUrls.default.http[0]),
  [polygon.id]: http(import.meta.env.VITE_POLYGON_RPC_URL || polygon.rpcUrls.default.http[0]),
  [optimism.id]: http(import.meta.env.VITE_OPTIMISM_RPC_URL || optimism.rpcUrls.default.http[0]),
  [arbitrum.id]: http(import.meta.env.VITE_ARBITRUM_RPC_URL || arbitrum.rpcUrls.default.http[0]),
};

// Configure connectors
const connectors = [
  injected(), // MetaMask, Coinbase Wallet, etc.
  ...(WALLETCONNECT_PROJECT_ID
    ? [
        walletConnect({
          projectId: WALLETCONNECT_PROJECT_ID,
          metadata: {
            name: 'OmniLink APEX',
            description: 'Web3 Verification for OmniLink',
            url: globalThis.location.origin,
            icons: [`${globalThis.location.origin}/favicon.ico`],
          },
        }),
      ]
    : []),
];

// Create wagmi config
export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors,
  transports,
  ssr: false,
});

// API endpoints
export const WEB3_API = {
  nonce: '/web3-nonce',
  verify: '/web3-verify',
} as const;
