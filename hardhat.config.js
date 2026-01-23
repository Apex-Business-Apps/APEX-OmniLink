/**
 * Hardhat Configuration for APEX OmniHub
 *
 * Phase 0: Polygon Amoy Testnet Deployment
 *
 * Environment Variables Required:
 *   - AMOY_RPC_URL: Polygon Amoy RPC endpoint (Alchemy recommended)
 *   - PRIVATE_KEY: Deployer wallet private key (with or without 0x prefix)
 *   - ETHERSCAN_API_KEY: (optional) For contract verification
 *
 * Usage:
 *   npx hardhat compile
 *   npx hardhat run scripts/deploy-phase0.js --network polygonAmoy
 *
 * Author: APEX OmniHub
 * Date: 2026-01-24
 */

import { config } from "dotenv";
import "@nomicfoundation/hardhat-toolbox";

// Load environment variables
config();

/**
 * Normalize private key to always include 0x prefix
 * Accepts keys with or without 0x prefix (avoid footguns)
 * @param {string} k - Private key
 * @returns {string} Normalized private key with 0x prefix
 */
function normalizePrivateKey(k) {
  if (!k) {
    // Return a placeholder for compilation-only runs
    // Deploy will fail with clear error if key missing
    console.warn("⚠️  PRIVATE_KEY not set - network operations will fail");
    return "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
  return k.startsWith("0x") ? k : `0x${k}`;
}

/**
 * Get RPC URL with fallback for local compilation
 * @param {string} url - RPC URL from environment
 * @returns {string} RPC URL or empty string for compilation
 */
function getRpcUrl(url) {
  if (!url) {
    console.warn("⚠️  AMOY_RPC_URL not set - using public RPC (rate limited)");
    return "https://rpc-amoy.polygon.technology";
  }
  return url;
}

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },

  networks: {
    // Local development network (default)
    hardhat: {
      chainId: 31337,
    },

    // Polygon Amoy Testnet (Phase 0 target)
    polygonAmoy: {
      url: getRpcUrl(process.env.AMOY_RPC_URL),
      accounts: [normalizePrivateKey(process.env.PRIVATE_KEY)],
      chainId: 80002,
      gasPrice: "auto",
      // Timeout for slow testnet responses
      timeout: 60000,
    },

    // Polygon Mainnet (future production)
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.PRIVATE_KEY
        ? [normalizePrivateKey(process.env.PRIVATE_KEY)]
        : [],
      chainId: 137,
    },
  },

  // Etherscan verification (optional)
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },

  // Source verification
  sourcify: {
    enabled: false,
  },

  // Path configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Mocha test configuration
  mocha: {
    timeout: 40000,
  },
};
