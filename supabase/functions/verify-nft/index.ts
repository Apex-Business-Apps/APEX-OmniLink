/**
 * NFT Ownership Verification Edge Function
 *
 * Purpose: Verify if user owns APEXMembershipNFT for premium access
 *
 * Endpoint: GET /verify-nft
 *
 * Query Parameters:
 *   ?user_id=<optional> - Verify specific user (requires auth)
 *
 * Response:
 *   {
 *     "hasPremiumNFT": boolean,
 *     "wallet_address": "0x...",
 *     "nft_balance": number,
 *     "verified_at": "...",
 *     "cached": boolean
 *   }
 *
 * Security:
 *   - Requires authenticated session (JWT)
 *   - Uses service role for database access
 *   - Caches NFT verification for 5 minutes per user
 *   - Rate limited (30 requests per minute per user)
 *   - Fail-safe: returns false on errors
 *
 * Environment Variables:
 *   - ALCHEMY_API_KEY_POLYGON or ALCHEMY_API_KEY_ETH
 *   - MEMBERSHIP_NFT_ADDRESS
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { createPublicClient, http } from 'https://esm.sh/viem@2.43.4';
import { polygon, mainnet } from 'https://esm.sh/viem@2.43.4/chains';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Rate limiting configuration
const VERIFY_NFT_RATE_LIMIT_MAX = 30;
const VERIFY_NFT_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Cache configuration
const NFT_VERIFICATION_CACHE_MS = 5 * 60 * 1000; // 5 minutes
const verificationCache = new Map<string, { hasPremiumNFT: boolean; balance: number; cachedAt: number }>();

// ERC721 balanceOf ABI
const ERC721_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = `verify-nft:${userId}`;

  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + VERIFY_NFT_RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: VERIFY_NFT_RATE_LIMIT_MAX - 1, resetIn: VERIFY_NFT_RATE_LIMIT_WINDOW_MS };
  }

  if (record.count >= VERIFY_NFT_RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }

  record.count++;
  rateLimitStore.set(key, record);

  return { allowed: true, remaining: VERIFY_NFT_RATE_LIMIT_MAX - record.count, resetIn: record.resetAt - now };
}

/**
 * Get cached verification result if still valid
 */
function getCachedVerification(walletAddress: string): { hasPremiumNFT: boolean; balance: number } | null {
  const cached = verificationCache.get(walletAddress.toLowerCase());
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.cachedAt > NFT_VERIFICATION_CACHE_MS) {
    verificationCache.delete(walletAddress.toLowerCase());
    return null;
  }

  return { hasPremiumNFT: cached.hasPremiumNFT, balance: cached.balance };
}

/**
 * Cache verification result
 */
function cacheVerification(walletAddress: string, hasPremiumNFT: boolean, balance: number) {
  verificationCache.set(walletAddress.toLowerCase(), {
    hasPremiumNFT,
    balance,
    cachedAt: Date.now(),
  });
}

/**
 * Verify NFT ownership via blockchain RPC
 */
async function verifyNFTOwnership(walletAddress: string): Promise<{ balance: number; hasPremiumNFT: boolean }> {
  // Get environment configuration
  const nftContractAddress = Deno.env.get('MEMBERSHIP_NFT_ADDRESS');
  if (!nftContractAddress) {
    throw new Error('MEMBERSHIP_NFT_ADDRESS not configured');
  }

  // Determine network and RPC URL
  const usePolygon = Deno.env.get('VITE_WEB3_NETWORK') === 'polygon';
  const alchemyKey = usePolygon
    ? Deno.env.get('ALCHEMY_API_KEY_POLYGON')
    : Deno.env.get('ALCHEMY_API_KEY_ETH');

  if (!alchemyKey) {
    throw new Error('Alchemy API key not configured');
  }

  const chain = usePolygon ? polygon : mainnet;
  const rpcUrl = usePolygon
    ? `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`
    : `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;

  // Create viem public client
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  try {
    // Call balanceOf on NFT contract
    const balance = await client.readContract({
      address: nftContractAddress as `0x${string}`,
      abi: ERC721_BALANCE_OF_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    });

    const balanceNumber = Number(balance);
    const hasPremiumNFT = balanceNumber > 0;

    return { balance: balanceNumber, hasPremiumNFT };
  } catch (error) {
    console.error('Error calling balanceOf:', error);
    throw new Error(`Failed to verify NFT ownership: ${error.message}`);
  }
}

/**
 * Main request handler
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed', message: 'Only GET requests are allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: `Too many verification requests. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
          retry_after: Math.ceil(rateLimit.resetIn / 1000),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(rateLimit.resetIn / 1000).toString(),
          },
        }
      );
    }

    // Get user's verified wallet address
    const { data: walletIdentity, error: walletError } = await supabase
      .from('wallet_identities')
      .select('wallet_address')
      .eq('user_id', user.id)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (walletError) {
      console.error('Error fetching wallet identity:', walletError);
      return new Response(
        JSON.stringify({ error: 'database_error', message: 'Failed to fetch wallet information' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!walletIdentity) {
      // User has no verified wallet - no NFT
      return new Response(
        JSON.stringify({
          hasPremiumNFT: false,
          wallet_address: null,
          nft_balance: 0,
          verified_at: new Date().toISOString(),
          cached: false,
          reason: 'no_verified_wallet',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const walletAddress = walletIdentity.wallet_address;

    // Check cache first
    const cached = getCachedVerification(walletAddress);
    if (cached) {
      return new Response(
        JSON.stringify({
          hasPremiumNFT: cached.hasPremiumNFT,
          wallet_address: walletAddress,
          nft_balance: cached.balance,
          verified_at: new Date().toISOString(),
          cached: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify NFT ownership via blockchain
    let balance = 0;
    let hasPremiumNFT = false;

    try {
      const result = await verifyNFTOwnership(walletAddress);
      balance = result.balance;
      hasPremiumNFT = result.hasPremiumNFT;

      // Cache the result
      cacheVerification(walletAddress, hasPremiumNFT, balance);
    } catch (error) {
      console.error('NFT verification failed:', error);
      // Fail-safe: return false on verification errors
      // Don't expose internal errors to client
      return new Response(
        JSON.stringify({
          hasPremiumNFT: false,
          wallet_address: walletAddress,
          nft_balance: 0,
          verified_at: new Date().toISOString(),
          cached: false,
          error: 'verification_failed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user profile with NFT status
    await supabase
      .from('profiles')
      .update({
        has_premium_nft: hasPremiumNFT,
        nft_verified_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Return success response
    return new Response(
      JSON.stringify({
        hasPremiumNFT,
        wallet_address: walletAddress,
        nft_balance: balance,
        verified_at: new Date().toISOString(),
        cached: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in verify-nft function:', error);
    // Fail-safe: always return false on errors
    return new Response(
      JSON.stringify({
        hasPremiumNFT: false,
        wallet_address: null,
        nft_balance: 0,
        verified_at: new Date().toISOString(),
        cached: false,
        error: 'internal_error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
