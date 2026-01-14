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

import { createSiweMessage } from 'https://esm.sh/viem@2.43.4/siwe';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.177.0/encoding/hex.ts';

import { buildCorsHeaders, corsErrorResponse, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";
import { addRateLimitHeaders, checkRateLimit, rateLimitExceededResponse, RATE_LIMIT_PROFILES } from "../_shared/ratelimit.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";
import { isValidWalletAddress, parseChainId, resolveOriginFromUri } from "../_shared/validation.ts";

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
    return handlePreflight(req);
  }

  if (!isOriginAllowed(requestOrigin)) {
    return corsErrorResponse('origin_not_allowed', 'CORS policy: Origin not allowed', 403, requestOrigin);
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed', message: 'Only POST requests are allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                     req.headers.get('x-real-ip') ||
                     'unknown';

    // Check rate limit
    const rateLimit = await checkRateLimit(clientIp, RATE_LIMIT_PROFILES.nonce);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, RATE_LIMIT_PROFILES.nonce, corsHeaders);
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
    const supabase = createServiceClient();

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
          headers: addRateLimitHeaders(
            { ...corsHeaders, 'Content-Type': 'application/json' },
            rateLimit,
            RATE_LIMIT_PROFILES.nonce
          ),
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
        headers: addRateLimitHeaders(
          { ...corsHeaders, 'Content-Type': 'application/json' },
          rateLimit,
          RATE_LIMIT_PROFILES.nonce
        ),
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
