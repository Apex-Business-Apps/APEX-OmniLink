/**
 * Web3 Entitlement Check Utility
 *
 * Purpose: Check NFT ownership and manage entitlements with caching
 *
 * Features:
 *   - Read-only RPC calls for NFT balance checks
 *   - Allowlist fallback when RPC fails
 *   - Supabase cache with configurable TTL (default: 10 minutes)
 *   - Circuit breaker pattern to prevent cascading failures
 *   - Timeout + retry with exponential backoff
 *   - Fail closed: deny access if RPC fails (unless allowlist grants)
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { createClient as createViemClient, http, type Address, type PublicClient } from 'viem';
import { mainnet, polygon, optimism, arbitrum } from 'viem/chains';
import { supabase } from '@/integrations/supabase/client';
import { logError, logAnalyticsEvent } from '@/lib/monitoring';

// Types
export interface EntitlementCheck {
  walletAddress: Address;
  chainId: number;
  contractAddress: Address;
  tokenId?: bigint;
  entitlementKey: string;
}

export interface EntitlementResult {
  hasEntitlement: boolean;
  source: 'chain' | 'cache' | 'allowlist' | 'denied';
  metadata?: Record<string, unknown>;
  cacheHit?: boolean;
  error?: string;
}

export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  name: string;
  timeout: number;
}

// Constants
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RPC_TIMEOUT_MS = 5000; // 5 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 8000; // 8 seconds

// Circuit breaker state
const circuitBreakerState = new Map<string, { failures: number; lastFailure: number; open: boolean }>();
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

// ERC-721 ABI (balanceOf function)
const ERC721_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Get chain configuration from environment
 */
function getChainConfig(chainId: number): ChainConfig | null {
  // Map chain IDs to environment variables
  const chainConfigMap: Record<number, { envKey: string; name: string; chain: unknown }> = {
    1: { envKey: 'VITE_ETHEREUM_RPC_URL', name: 'Ethereum', chain: mainnet },
    137: { envKey: 'VITE_POLYGON_RPC_URL', name: 'Polygon', chain: polygon },
    10: { envKey: 'VITE_OPTIMISM_RPC_URL', name: 'Optimism', chain: optimism },
    42161: { envKey: 'VITE_ARBITRUM_RPC_URL', name: 'Arbitrum', chain: arbitrum },
  };

  const config = chainConfigMap[chainId];
  if (!config) {
    return null;
  }

  const rpcUrl = import.meta.env[config.envKey] || '';
  if (!rpcUrl) {
    console.warn(`RPC URL not configured for ${config.name} (${config.envKey})`);
    return null;
  }

  return {
    chainId,
    rpcUrl,
    name: config.name,
    timeout: RPC_TIMEOUT_MS,
  };
}

/**
 * Create viem public client for chain
 */
function createPublicClient(chainConfig: ChainConfig): PublicClient {
  const chainMap: Record<number, unknown> = {
    1: mainnet,
    137: polygon,
    10: optimism,
    42161: arbitrum,
  };

  const chain = chainMap[chainConfig.chainId];

  return createViemClient({
    chain,
    transport: http(chainConfig.rpcUrl, {
      timeout: chainConfig.timeout,
    }),
  });
}

/**
 * Check circuit breaker state
 */
function isCircuitBreakerOpen(key: string): boolean {
  const state = circuitBreakerState.get(key);
  if (!state) {
    return false;
  }

  // Reset circuit breaker after timeout
  const now = Date.now();
  if (state.open && now - state.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    circuitBreakerState.set(key, { failures: 0, lastFailure: 0, open: false });
    return false;
  }

  return state.open;
}

/**
 * Record circuit breaker failure
 */
function recordCircuitBreakerFailure(key: string): void {
  const state = circuitBreakerState.get(key) || { failures: 0, lastFailure: 0, open: false };
  state.failures++;
  state.lastFailure = Date.now();

  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.open = true;
    console.warn(`Circuit breaker opened for ${key} after ${state.failures} failures`);
  }

  circuitBreakerState.set(key, state);
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check cache for entitlement
 */
async function checkCache(
  walletAddress: string,
  chainId: number,
  contractAddress: string,
  tokenId?: bigint
): Promise<{ hit: boolean; hasEntitlement: boolean; data?: unknown }> {
  try {
    const queryParams = {
      contract: contractAddress.toLowerCase(),
      ...(tokenId !== undefined && { tokenId: tokenId.toString() }),
    };

    const { data, error } = await (supabase.from('chain_entitlements_cache' as any) as any)
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('chain_id', chainId)
      .eq('query_type', 'nft_balance')
      .eq('query_params', queryParams)
      .gte('refreshed_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .order('refreshed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Cache lookup error:', error);
      return { hit: false, hasEntitlement: false };
    }

    if (data) {
      const hasEntitlement = data.data?.balance > 0;
      return { hit: true, hasEntitlement, data: data.data };
    }

    return { hit: false, hasEntitlement: false };
  } catch (error) {
    console.error('Cache check error:', error);
    return { hit: false, hasEntitlement: false };
  }
}

/**
 * Update cache with fresh data
 */
async function updateCache(
  walletAddress: string,
  chainId: number,
  contractAddress: string,
  balance: bigint,
  tokenId?: bigint
): Promise<void> {
  try {
    const queryParams = {
      contract: contractAddress.toLowerCase(),
      ...(tokenId !== undefined && { tokenId: tokenId.toString() }),
    };

    await (supabase.from('chain_entitlements_cache' as any) as any).upsert(
      {
        wallet_address: walletAddress.toLowerCase(),
        chain_id: chainId,
        query_type: 'nft_balance',
        query_params: queryParams,
        data: { balance: balance.toString(), checkedAt: new Date().toISOString() },
        refreshed_at: new Date().toISOString(),
      },
      {
        onConflict: 'wallet_address,chain_id,query_type,query_params',
        ignoreDuplicates: false,
      }
    );
  } catch (error) {
    console.error('Cache update error:', error);
    // Non-blocking - don't fail the request if cache update fails
  }
}

/**
 * Check allowlist for entitlement
 */
async function checkAllowlist(
  walletAddress: string,
  entitlementKey: string
): Promise<{ granted: boolean; metadata?: unknown }> {
  try {
    const { data, error } = await (supabase.from('entitlements' as any) as any)
      .select('*')
      .eq('subject_type', 'wallet')
      .eq('subject_id', walletAddress.toLowerCase())
      .eq('entitlement_key', entitlementKey)
      .eq('source', 'allowlist')
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
      .maybeSingle();

    if (error || !data) {
      return { granted: false };
    }

    return { granted: true, metadata: data.metadata };
  } catch (error) {
    console.error('Allowlist check error:', error);
    return { granted: false };
  }
}

/**
 * Check NFT balance on-chain with retry
 */
async function checkNFTBalanceOnChain(
  client: PublicClient,
  contractAddress: Address,
  walletAddress: Address,
  retries = MAX_RETRIES
): Promise<bigint> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const balance = await client.readContract({
        address: contractAddress,
        abi: ERC721_ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
      });

      return balance as bigint;
    } catch (error) {
      lastError = error as Error;
      console.error(`NFT balance check attempt ${attempt + 1} failed:`, error);

      if (attempt < retries - 1) {
        const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('NFT balance check failed');
}

/**
 * Main entitlement check function
 */
export async function checkEntitlement(params: EntitlementCheck): Promise<EntitlementResult> {
  const { walletAddress, chainId, contractAddress, tokenId, entitlementKey } = params;

  try {
    // Step 1: Check cache
    const cacheResult = await checkCache(walletAddress, chainId, contractAddress, tokenId);
    if (cacheResult.hit) {
      await logAnalyticsEvent('web3_entitlement_check', {
        wallet: walletAddress,
        entitlement: entitlementKey,
        source: 'cache',
        result: cacheResult.hasEntitlement,
      });

      return {
        hasEntitlement: cacheResult.hasEntitlement,
        source: 'cache',
        metadata: cacheResult.data,
        cacheHit: true,
      };
    }

    // Step 2: Check allowlist (fallback if RPC fails)
    const allowlistResult = await checkAllowlist(walletAddress, entitlementKey);
    if (allowlistResult.granted) {
      await logAnalyticsEvent('web3_entitlement_check', {
        wallet: walletAddress,
        entitlement: entitlementKey,
        source: 'allowlist',
        result: true,
      });

      return {
        hasEntitlement: true,
        source: 'allowlist',
        metadata: allowlistResult.metadata,
        cacheHit: false,
      };
    }

    // Step 3: Check circuit breaker
    const circuitKey = `chain:${chainId}`;
    if (isCircuitBreakerOpen(circuitKey)) {
      // Fail closed - deny access if circuit is open
      await logError(new Error('Circuit breaker open for chain'), {
        chainId,
        wallet: walletAddress,
        entitlement: entitlementKey,
      });

      return {
        hasEntitlement: false,
        source: 'denied',
        error: 'Chain RPC circuit breaker is open',
        cacheHit: false,
      };
    }

    // Step 4: Get chain configuration
    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
      await logError(new Error('Chain not configured'), {
        chainId,
        wallet: walletAddress,
      });

      return {
        hasEntitlement: false,
        source: 'denied',
        error: 'Chain not configured',
        cacheHit: false,
      };
    }

    // Step 5: Check on-chain
    try {
      const client = createPublicClient(chainConfig);
      const balance = await checkNFTBalanceOnChain(client, contractAddress, walletAddress);

      // Update cache
      await updateCache(walletAddress, chainId, contractAddress, balance, tokenId);

      const hasEntitlement = balance > 0n;

      await logAnalyticsEvent('web3_entitlement_check', {
        wallet: walletAddress,
        entitlement: entitlementKey,
        source: 'chain',
        result: hasEntitlement,
        balance: balance.toString(),
      });

      return {
        hasEntitlement,
        source: 'chain',
        metadata: { balance: balance.toString(), chainId },
        cacheHit: false,
      };
    } catch (error) {
      // Record failure for circuit breaker
      recordCircuitBreakerFailure(circuitKey);

      await logError(error as Error, {
        chainId,
        wallet: walletAddress,
        contract: contractAddress,
        action: 'nft_balance_check',
      });

      // Fail closed - deny access on RPC failure
      return {
        hasEntitlement: false,
        source: 'denied',
        error: (error as Error).message,
        cacheHit: false,
      };
    }
  } catch (error) {
    await logError(error as Error, {
      wallet: walletAddress,
      entitlement: entitlementKey,
      action: 'entitlement_check',
    });

    // Fail closed on unexpected errors
    return {
      hasEntitlement: false,
      source: 'denied',
      error: (error as Error).message,
      cacheHit: false,
    };
  }
}

/**
 * Batch check multiple entitlements
 */
export async function checkEntitlements(checks: EntitlementCheck[]): Promise<EntitlementResult[]> {
  return Promise.all(checks.map((check) => checkEntitlement(check)));
}

/**
 * Grant manual entitlement via allowlist
 */
export async function grantEntitlement(
  subjectType: 'user' | 'wallet' | 'device',
  subjectId: string,
  entitlementKey: string,
  expiresAt?: Date,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (supabase.from('entitlements' as any) as any).upsert(
      {
        subject_type: subjectType,
        subject_id: subjectId.toLowerCase(),
        entitlement_key: entitlementKey,
        source: 'manual',
        metadata: metadata || {},
        expires_at: expiresAt?.toISOString() || null,
      },
      {
        onConflict: 'subject_type,subject_id,entitlement_key',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    await logAnalyticsEvent('entitlement_granted', {
      subjectType,
      subjectId,
      entitlementKey,
      expiresAt: expiresAt?.toISOString(),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
