/**
 * NFT Ownership Verification Edge Function
 *
 * Purpose: Verify if user owns APEXMembershipNFT for premium access
 *
 * Endpoint: GET /verify-nft
 *
 * Query Parameters:
 *   ?user_id=<optional> - Verify specific user (requires auth)
 *   ?force_refresh=<boolean> - Skip cache and query blockchain
 *
 * Response:
 *   {
 *     "has_premium_nft": boolean,
 *     "wallet_address": "0x...",
 *     "nft_balance": number,
 *     "verified_at": "...",
 *     "cached": boolean
 *   }
 *
 * Security:
 *   - Requires authenticated session
 *   - Rate limited (20 requests per hour per user)
 *   - Results cached for 10 minutes
 *   - Uses Alchemy RPC for reliable blockchain reads
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { createPublicClient, http, parseAbi } from 'https://esm.sh/viem@2.21.54';
import { polygon } from 'https://esm.sh/viem@2.21.54/chains';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Rate limiting configuration
const NFT_VERIFY_RATE_LIMIT_MAX = 20;
const NFT_VERIFY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// ERC721 ABI for balanceOf
const ERC721_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
]);

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = `nft-verify:${userId}`;

  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + NFT_VERIFY_RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: NFT_VERIFY_RATE_LIMIT_MAX - 1, resetIn: NFT_VERIFY_RATE_LIMIT_WINDOW_MS };
  }

  if (record.count >= NFT_VERIFY_RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }

  record.count++;
  rateLimitStore.set(key, record);

  return { allowed: true, remaining: NFT_VERIFY_RATE_LIMIT_MAX - record.count, resetIn: record.resetAt - now };
}

/**
 * Query NFT balance from blockchain via Alchemy
 */
async function queryNFTBalance(walletAddress: string, contractAddress: string): Promise<number> {
  const alchemyApiKey = Deno.env.get('ALCHEMY_API_KEY_POLYGON');
  if (!alchemyApiKey) {
    throw new Error('ALCHEMY_API_KEY_POLYGON not configured');
  }

  const client = createPublicClient({
    chain: polygon,
    transport: http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
  });

  try {
    const balance = await client.readContract({
      address: contractAddress as `0x${string}`,
      abi: ERC721_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    });

    return Number(balance);
  } catch (error) {
    console.error('[verify-nft] Blockchain query failed:', error);
    throw new Error('Failed to query NFT balance from blockchain');
  }
}

/**
 * Get cached NFT balance if fresh
 */
async function getCachedBalance(
  supabase: any,
  walletAddress: string,
  contractAddress: string,
  chainId: number
): Promise<{ balance: number; cached: boolean; verified_at: string } | null> {
  const { data, error } = await supabase
    .from('chain_entitlements_cache')
    .select('data, refreshed_at')
    .eq('wallet_address', walletAddress.toLowerCase())
    .eq('chain_id', chainId)
    .eq('query_type', 'nft_balance')
    .eq('query_params', JSON.stringify({ contract_address: contractAddress.toLowerCase() }))
    .single();

  if (error || !data) {
    return null;
  }

  const cacheAge = Date.now() - new Date(data.refreshed_at).getTime();
  if (cacheAge > CACHE_TTL_MS) {
    return null; // Cache expired
  }

  return {
    balance: data.data.balance || 0,
    cached: true,
    verified_at: data.refreshed_at,
  };
}

/**
 * Update cache with fresh NFT balance
 */
async function updateCache(
  supabase: any,
  walletAddress: string,
  contractAddress: string,
  chainId: number,
  balance: number
): Promise<void> {
  const { error } = await supabase
    .from('chain_entitlements_cache')
    .upsert({
      wallet_address: walletAddress.toLowerCase(),
      chain_id: chainId,
      query_type: 'nft_balance',
      query_params: { contract_address: contractAddress.toLowerCase() },
      data: { balance, contract_address: contractAddress.toLowerCase() },
      refreshed_at: new Date().toISOString(),
    }, {
      onConflict: 'wallet_address,chain_id,query_type,query_params',
    });

  if (error) {
    console.error('[verify-nft] Failed to update cache:', error);
  }
}

/**
 * Update user profile with NFT ownership status
 */
async function updateProfileNFTStatus(
  supabase: any,
  userId: string,
  hasPremiumNFT: boolean
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      has_premium_nft: hasPremiumNFT,
      nft_verified_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[verify-nft] Failed to update profile:', error);
  }
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retry_after: Math.ceil(rateLimit.resetIn / 1000),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': NFT_VERIFY_RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(Date.now() + rateLimit.resetIn).toISOString(),
            'Retry-After': Math.ceil(rateLimit.resetIn / 1000).toString(),
          },
        }
      );
    }

    // Get NFT contract address
    const nftContractAddress = Deno.env.get('MEMBERSHIP_NFT_ADDRESS');
    if (!nftContractAddress) {
      return new Response(
        JSON.stringify({ error: 'NFT contract not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force_refresh') === 'true';

    // Get user's wallet address(es)
    const { data: wallets, error: walletError } = await supabase
      .from('wallet_identities')
      .select('wallet_address, chain_id')
      .eq('user_id', user.id)
      .order('verified_at', { ascending: false })
      .limit(1);

    if (walletError || !wallets || wallets.length === 0) {
      return new Response(
        JSON.stringify({
          has_premium_nft: false,
          wallet_address: null,
          nft_balance: 0,
          verified_at: new Date().toISOString(),
          cached: false,
          message: 'No wallet connected',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          },
        }
      );
    }

    const wallet = wallets[0];
    const chainId = 137; // Polygon mainnet

    // Try to get cached balance first (unless force refresh)
    let balance = 0;
    let cached = false;
    let verifiedAt = new Date().toISOString();

    if (!forceRefresh) {
      const cachedResult = await getCachedBalance(
        supabase,
        wallet.wallet_address,
        nftContractAddress,
        chainId
      );

      if (cachedResult) {
        balance = cachedResult.balance;
        cached = true;
        verifiedAt = cachedResult.verified_at;
      }
    }

    // If not cached or force refresh, query blockchain
    if (!cached || forceRefresh) {
      balance = await queryNFTBalance(wallet.wallet_address, nftContractAddress);
      await updateCache(supabase, wallet.wallet_address, nftContractAddress, chainId, balance);
      cached = false;
      verifiedAt = new Date().toISOString();
    }

    const hasPremiumNFT = balance > 0;

    // Update user profile with NFT status
    await updateProfileNFTStatus(supabase, user.id, hasPremiumNFT);

    return new Response(
      JSON.stringify({
        has_premium_nft: hasPremiumNFT,
        wallet_address: wallet.wallet_address,
        nft_balance: balance,
        verified_at: verifiedAt,
        cached,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'Cache-Control': cached ? `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}` : 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('[verify-nft] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
