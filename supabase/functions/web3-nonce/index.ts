/**
 * Web3 Nonce Generation Edge Function
 *
 * Purpose: Generate or retrieve an active nonce for wallet signature verification
 *
 * Endpoint: POST /web3-nonce
 *
 * Request Body:
 *   { "wallet_address": "0x..." }
 *
 * Response:
 *   { "nonce": "...", "expires_at": "...", "message": "..." }
 *
 * Security:
 *   - Rate limited (5 requests per minute per IP)
 *   - Idempotent: returns existing active nonce if available
 *   - Nonces expire after 5 minutes
 *   - No authentication required (public endpoint)
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { createSiweMessage } from 'https://esm.sh/viem@2.43.4/siwe';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.177.0/encoding/hex.ts';

const DEMO_MODE = Deno.env.get('DEMO_MODE')?.toLowerCase() === 'true';
const ALLOWED_ORIGINS = (Deno.env.get('SIWE_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ''));

function isOriginAllowed(origin: string | null): boolean {
  if (DEMO_MODE) return true;
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, '');
  return ALLOWED_ORIGINS.includes(normalized);
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

// Rate limiting in-memory store (resets on cold start)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Nonce configuration
const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_LENGTH = 32; // 32 bytes = 64 hex characters

/**
 * Generate a cryptographically secure random nonce
 */
function generateSecureNonce(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  return encodeHex(randomBytes);
}

/**
 * Validate Ethereum wallet address format
 */
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function parseChainId(value: unknown): number {
  if (value === undefined || value === null) {
    return 1;
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error('Invalid chain_id');
  }
  return numeric;
}

function resolveOriginFromUri(uri: string): string {
  return new URL(uri).origin.replace(/\/$/, '');
}

/**
 * Check rate limit for IP address
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = `nonce:${ip}`;

  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetAt) {
    // First request or window expired - create new record
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }

  // Increment counter
  record.count++;
  rateLimitStore.set(key, record);

  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetIn: record.resetAt - now };
}

/**
 * Create verification message for wallet signing
 */
function createVerificationMessage(
  walletAddress: string,
  nonce: string,
  chainId: number,
  domain: string,
  uri: string,
  expiresAt: Date
): string {
  return createSiweMessage({
    address: walletAddress as `0x${string}`,
    chainId,
    domain,
    nonce,
    uri,
    version: '1',
    statement: 'Sign in to OmniLink APEX.',
    issuedAt: new Date(),
    expirationTime: expiresAt,
  });
}

/**
 * Main request handler
 */
Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;
  const corsHeaders = buildCorsHeaders(requestOrigin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(requestOrigin)) {
      return new Response(null, { status: 403 });
    }

    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed', message: 'Only POST requests are allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (!DEMO_MODE && ALLOWED_ORIGINS.length === 0) {
      return new Response(
        JSON.stringify({ error: 'configuration_error', message: 'SIWE_ALLOWED_ORIGINS not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                     req.headers.get('x-real-ip') ||
                     'unknown';

    // Check rate limit
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: `Too many requests. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
          retry_after: Math.ceil(rateLimit.resetIn / 1000),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(Date.now() + rateLimit.resetIn).toISOString(),
            'Retry-After': Math.ceil(rateLimit.resetIn / 1000).toString(),
          },
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { wallet_address, chain_id, domain, uri } = body;

    // Validate wallet address
    if (!wallet_address || typeof wallet_address !== 'string') {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'wallet_address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize and validate address format
    const normalizedAddress = wallet_address.toLowerCase();
    if (!isValidWalletAddress(normalizedAddress)) {
      return new Response(
        JSON.stringify({ error: 'invalid_address', message: 'Invalid Ethereum wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let resolvedChainId: number;
    try {
      resolvedChainId = parseChainId(chain_id);
    } catch {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'chain_id must be a positive integer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedUri = uri ?? requestOrigin;
    if (!resolvedUri) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'uri is required for SIWE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let resolvedOrigin: string;
    let resolvedDomain: string;
    try {
      resolvedOrigin = resolveOriginFromUri(resolvedUri);
      resolvedDomain = domain ?? new URL(resolvedUri).host;
    } catch {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'uri must be a valid URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (domain && resolvedDomain !== domain) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'domain must match uri host' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (requestOrigin && resolvedOrigin !== requestOrigin) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'origin must match uri origin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isOriginAllowed(resolvedOrigin)) {
      return new Response(
        JSON.stringify({ error: 'forbidden', message: 'Origin not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing active nonce (idempotency)
    const { data: existingNonce, error: fetchError } = await supabase
      .from('wallet_nonces')
      .select('nonce, expires_at')
      .eq('wallet_address', normalizedAddress)
      .eq('chain_id', resolvedChainId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing nonce:', fetchError);
      return new Response(
        JSON.stringify({ error: 'database_error', message: 'Failed to check existing nonce' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return existing nonce if still valid
    if (existingNonce) {
      const message = createVerificationMessage(
        normalizedAddress,
        existingNonce.nonce,
        resolvedChainId,
        resolvedDomain,
        resolvedUri,
        new Date(existingNonce.expires_at)
      );
      return new Response(
        JSON.stringify({
          nonce: existingNonce.nonce,
          expires_at: existingNonce.expires_at,
          message,
          wallet_address: normalizedAddress,
          chain_id: resolvedChainId,
          reused: true,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          },
        }
      );
    }

    // Generate new nonce
    const nonce = generateSecureNonce();
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS);

    // Store nonce in database
    const { error: insertError } = await supabase
      .from('wallet_nonces')
      .insert({
        nonce,
        wallet_address: normalizedAddress,
        chain_id: resolvedChainId,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error inserting nonce:', insertError);
      return new Response(
        JSON.stringify({ error: 'database_error', message: 'Failed to create nonce' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create verification message
    const message = createVerificationMessage(
      normalizedAddress,
      nonce,
      resolvedChainId,
      resolvedDomain,
      resolvedUri,
      expiresAt
    );

    // Return success response
    return new Response(
      JSON.stringify({
        nonce,
        expires_at: expiresAt.toISOString(),
        message,
        wallet_address: normalizedAddress,
        chain_id: resolvedChainId,
        reused: false,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      }
    );

  } catch (error) {
    console.error('Unexpected error in web3-nonce function:', error);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: 'An unexpected error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
