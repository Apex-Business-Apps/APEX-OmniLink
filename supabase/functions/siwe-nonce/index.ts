/**
 * SIWE Nonce Issuance Edge Function
 *
 * Purpose: Generate cryptographically secure nonces for SIWE authentication
 *
 * Endpoint: POST /siwe-nonce
 *
 * Request Body:
 *   {
 *     "wallet_address": "0x...",
 *     "chain_id": 80002,         // Optional, defaults to Polygon Amoy
 *     "domain": "omnihub.app",   // Optional, for binding
 *     "request_id": "uuid"       // Optional, for idempotency
 *   }
 *
 * Response:
 *   {
 *     "nonce": "...",
 *     "expires_at": "...",
 *     "message": "...",          // Pre-formatted SIWE message
 *     "chain_id": 80002,
 *     "idempotent": false        // true if reusing existing nonce
 *   }
 *
 * Security:
 *   - Rate limited (5 requests per minute per IP)
 *   - Cryptographically secure nonce generation
 *   - Nonces expire after 5 minutes
 *   - Idempotent with request_id
 *   - No authentication required (public endpoint)
 *   - Wallet address normalized to lowercase
 *
 * @author APEX OmniHub
 * @date 2026-01-24
 * @phase Phase 0 - NFT Verification
 */

import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.177.0/encoding/hex.ts';
import { handleCors, corsJsonResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitExceededResponse, RATE_LIMIT_CONFIGS } from '../_shared/rate-limit.ts';
import { isValidWalletAddress } from '../_shared/validation.ts';
import { createSupabaseClient, createMethodNotAllowedResponse, createInternalErrorResponse, getClientIP } from '../_shared/auth.ts';

// =============================================================
//                        CONFIGURATION
// =============================================================

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_LENGTH = 32; // 32 bytes = 64 hex characters
const DEFAULT_CHAIN_ID = 80002; // Polygon Amoy
const DEFAULT_STATEMENT = 'Sign in with Ethereum to APEX OmniHub';

// =============================================================
//                        UTILITIES
// =============================================================

/**
 * Generate cryptographically secure random nonce
 * @returns 64-character hex string
 */
function generateSecureNonce(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  return encodeHex(randomBytes);
}

/**
 * Create EIP-4361 SIWE message
 * @see https://eips.ethereum.org/EIPS/eip-4361
 */
function createSiweMessage(params: {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  nonce: string;
  chainId: number;
  issuedAt: string;
  expirationTime: string;
}): string {
  const { domain, address, statement, uri, nonce, chainId, issuedAt, expirationTime } = params;

  // EIP-4361 compliant message format
  return `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`;
}

// =============================================================
//                      REQUEST HANDLER
// =============================================================

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
    const clientIp = getClientIP(req);

    // Check rate limit
    const rateLimit = await checkRateLimit(clientIp, RATE_LIMIT_CONFIGS.web3Nonce);
    if (!rateLimit.allowed) {
      const origin = req.headers.get('origin');
      return rateLimitExceededResponse(origin, rateLimit);
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return corsJsonResponse({
        error: 'invalid_json',
        message: 'Request body must be valid JSON',
      }, 400);
    }

    const {
      wallet_address,
      chain_id = DEFAULT_CHAIN_ID,
      domain: requestDomain,
      request_id,
    } = body as {
      wallet_address?: string;
      chain_id?: number;
      domain?: string;
      request_id?: string;
    };

    // Validate wallet address
    if (!wallet_address || typeof wallet_address !== 'string') {
      return corsJsonResponse({
        error: 'invalid_request',
        message: 'wallet_address is required',
      }, 400);
    }

    // Normalize wallet address to lowercase
    const normalizedAddress = wallet_address.toLowerCase();

    if (!isValidWalletAddress(normalizedAddress)) {
      return corsJsonResponse({
        error: 'invalid_address',
        message: 'Invalid Ethereum wallet address format',
      }, 400);
    }

    // Validate chain_id
    if (typeof chain_id !== 'number' || chain_id <= 0) {
      return corsJsonResponse({
        error: 'invalid_chain_id',
        message: 'chain_id must be a positive integer',
      }, 400);
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Get request origin for domain binding
    const origin = req.headers.get('origin') || '';
    let domain = requestDomain || '';
    let uri = origin;

    if (!domain && origin) {
      try {
        const url = new URL(origin);
        domain = url.host;
      } catch {
        domain = 'omnihub.app';
        uri = 'https://omnihub.app';
      }
    }

    if (!domain) {
      domain = 'omnihub.app';
      uri = 'https://omnihub.app';
    }

    // Check for idempotent request (if request_id provided)
    if (request_id) {
      const { data: existingNonce } = await supabase
        .from('auth_nonces')
        .select('nonce, expires_at, domain, uri')
        .eq('request_id', request_id)
        .eq('wallet_address', normalizedAddress)
        .eq('chain_id', chain_id)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingNonce) {
        const issuedAt = new Date().toISOString();
        const message = createSiweMessage({
          domain: existingNonce.domain || domain,
          address: normalizedAddress,
          statement: DEFAULT_STATEMENT,
          uri: existingNonce.uri || uri,
          nonce: existingNonce.nonce,
          chainId: chain_id,
          issuedAt,
          expirationTime: existingNonce.expires_at,
        });

        return corsJsonResponse({
          nonce: existingNonce.nonce,
          expires_at: existingNonce.expires_at,
          message,
          wallet_address: normalizedAddress,
          chain_id,
          idempotent: true,
        });
      }
    }

    // Check for existing active nonce (reuse if valid)
    const { data: activeNonce } = await supabase
      .from('auth_nonces')
      .select('nonce, expires_at, domain, uri')
      .eq('wallet_address', normalizedAddress)
      .eq('chain_id', chain_id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeNonce) {
      const issuedAt = new Date().toISOString();
      const message = createSiweMessage({
        domain: activeNonce.domain || domain,
        address: normalizedAddress,
        statement: DEFAULT_STATEMENT,
        uri: activeNonce.uri || uri,
        nonce: activeNonce.nonce,
        chainId: chain_id,
        issuedAt,
        expirationTime: activeNonce.expires_at,
      });

      return corsJsonResponse({
        nonce: activeNonce.nonce,
        expires_at: activeNonce.expires_at,
        message,
        wallet_address: normalizedAddress,
        chain_id,
        idempotent: true,
        reused: true,
      });
    }

    // Generate new nonce
    const nonce = generateSecureNonce();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS).toISOString();

    // Store nonce in database
    const { error: insertError } = await supabase
      .from('auth_nonces')
      .insert({
        nonce,
        wallet_address: normalizedAddress,
        chain_id,
        expires_at: expiresAt,
        domain,
        uri,
        statement: DEFAULT_STATEMENT,
        request_id: request_id || null,
        ip_address: clientIp,
        user_agent: req.headers.get('user-agent') || null,
      });

    if (insertError) {
      console.error('Failed to insert nonce:', insertError);
      return corsJsonResponse({
        error: 'database_error',
        message: 'Failed to create nonce',
      }, 500);
    }

    // Create SIWE message
    const message = createSiweMessage({
      domain,
      address: normalizedAddress,
      statement: DEFAULT_STATEMENT,
      uri,
      nonce,
      chainId: chain_id,
      issuedAt,
      expirationTime: expiresAt,
    });

    // Return success response
    return corsJsonResponse({
      nonce,
      expires_at: expiresAt,
      message,
      wallet_address: normalizedAddress,
      chain_id,
      idempotent: false,
    });

  } catch (error) {
    console.error('Unexpected error in siwe-nonce:', error);
    return createInternalErrorResponse('An unexpected error occurred');
  }
});
