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

import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.177.0/encoding/hex.ts';
import { handleCors, corsJsonResponse } from '../_shared/cors.ts';
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '../_shared/rate-limiting.ts';
import { isValidWalletAddress } from '../_shared/validation.ts';
import { createSupabaseClient, createMethodNotAllowedResponse, createInternalErrorResponse } from '../_shared/auth.ts';

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
function createVerificationMessage(walletAddress: string, nonce: string): string {
  return `Welcome to OmniLink APEX!

Sign this message to verify your wallet ownership.

Wallet: ${walletAddress}
Nonce: ${nonce}

This request will not trigger a blockchain transaction or cost any gas fees.`;
}

/**
 * Main request handler
 */
Deno.serve(async (req) => {


  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only allow POST requests
  if (req.method !== 'POST') {
    return createMethodNotAllowedResponse(['POST']);
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                     req.headers.get('x-real-ip') ||
                     'unknown';

    // Check rate limit
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.WEB3_NONCE);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.resetIn, `Too many requests. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`);
    }

    // Parse request body
    const body = await req.json();
    const { wallet_address } = body;

    // Validate wallet address
    if (!wallet_address || typeof wallet_address !== 'string') {
      return corsJsonResponse({ error: 'invalid_request', message: 'wallet_address is required' }, 400);
    }

    // Normalize and validate address format
    const normalizedAddress = wallet_address.toLowerCase();
    if (!isValidWalletAddress(normalizedAddress)) {
      return corsJsonResponse({ error: 'invalid_address', message: 'Invalid Ethereum wallet address format' }, 400);
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Check for existing active nonce (idempotency)
    const { data: existingNonce, error: fetchError } = await supabase
      .from('wallet_nonces')
      .select('nonce, expires_at')
      .eq('wallet_address', normalizedAddress)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing nonce:', fetchError);
      return corsJsonResponse({ error: 'database_error', message: 'Failed to check existing nonce' }, 500);
    }

    // Return existing nonce if still valid
    if (existingNonce) {
      const message = createVerificationMessage(normalizedAddress, existingNonce.nonce);
      return corsJsonResponse({
        nonce: existingNonce.nonce,
        expires_at: existingNonce.expires_at,
        message,
        wallet_address: normalizedAddress,
        reused: true,
      });
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
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error inserting nonce:', insertError);
      return corsJsonResponse({ error: 'database_error', message: 'Failed to create nonce' }, 500);
    }

    // Create verification message
    const message = createVerificationMessage(normalizedAddress, nonce);

    // Return success response
    return corsJsonResponse({
      nonce,
      expires_at: expiresAt.toISOString(),
      message,
      wallet_address: normalizedAddress,
      reused: false,
    });

  } catch (error) {
    console.error('Unexpected error in web3-nonce function:', error);
    return createInternalErrorResponse('An unexpected error occurred');
  }
});
