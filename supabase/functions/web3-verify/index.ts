/**
 * Web3 Signature Verification Edge Function
 *
 * Purpose: Verify wallet signature and link wallet to authenticated user
 *
 * Endpoint: POST /web3-verify
 *
 * Request Body:
 *   {
 *     "wallet_address": "0x...",
 *     "signature": "0x...",
 *     "message": "..."
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "wallet_identity_id": "...",
 *     "wallet_address": "...",
 *     "chain_id": 1
 *   }
 *
 * Security:
 *   - Requires authenticated session
 *   - Rate limited (10 verification attempts per hour per user)
 *   - Nonce must be unused and not expired
 *   - Signature verification using viem
 *   - Audit logging for all attempts
 *   - Fail closed on verification errors
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { verifyMessage } from 'https://esm.sh/viem@2.21.54';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Rate limiting configuration
const VERIFY_RATE_LIMIT_MAX = 10;
const VERIFY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Validate Ethereum wallet address format
 */
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Ethereum signature format
 */
function isValidSignature(signature: string): boolean {
  return /^0x[a-fA-F0-9]{130}$/.test(signature);
}

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = `verify:${userId}`;

  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + VERIFY_RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: VERIFY_RATE_LIMIT_MAX - 1, resetIn: VERIFY_RATE_LIMIT_WINDOW_MS };
  }

  if (record.count >= VERIFY_RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }

  record.count++;
  rateLimitStore.set(key, record);

  return { allowed: true, remaining: VERIFY_RATE_LIMIT_MAX - record.count, resetIn: record.resetAt - now };
}

/**
 * Extract nonce from verification message
 */
function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/Nonce:\s*([a-f0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Log audit event
 */
async function logAuditEvent(
  supabase: any,
  userId: string,
  action: string,
  walletAddress: string,
  metadata: Record<string, any>
) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: 'wallet_identity',
      resource_id: walletAddress,
      metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Non-blocking - don't fail the request if audit logging fails
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

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed', message: 'Only POST requests are allowed' }),
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
      await logAuditEvent(supabase, user.id, 'wallet_verify_rate_limited', 'unknown', {
        retry_after: Math.ceil(rateLimit.resetIn / 1000),
      });

      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: `Too many verification attempts. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
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

    // Parse request body
    const body = await req.json();
    const { wallet_address, signature, message } = body;

    // Validate required fields
    if (!wallet_address || !signature || !message) {
      return new Response(
        JSON.stringify({
          error: 'invalid_request',
          message: 'wallet_address, signature, and message are required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize and validate wallet address
    const normalizedAddress = wallet_address.toLowerCase();
    if (!isValidWalletAddress(normalizedAddress)) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'invalid_address_format',
      });

      return new Response(
        JSON.stringify({ error: 'invalid_address', message: 'Invalid Ethereum wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate signature format
    if (!isValidSignature(signature)) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'invalid_signature_format',
      });

      return new Response(
        JSON.stringify({ error: 'invalid_signature', message: 'Invalid signature format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract and validate nonce from message
    const nonce = extractNonceFromMessage(message);
    if (!nonce) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'nonce_not_found_in_message',
      });

      return new Response(
        JSON.stringify({ error: 'invalid_message', message: 'Message does not contain a valid nonce' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify nonce exists, is unused, and not expired
    const { data: nonceRecord, error: nonceError } = await supabase
      .from('wallet_nonces')
      .select('*')
      .eq('nonce', nonce)
      .eq('wallet_address', normalizedAddress)
      .is('used_at', null)
      .maybeSingle();

    if (nonceError || !nonceRecord) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'nonce_not_found',
        nonce,
      });

      return new Response(
        JSON.stringify({ error: 'invalid_nonce', message: 'Nonce not found or already used' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check nonce expiration
    const expiresAt = new Date(nonceRecord.expires_at);
    if (expiresAt < new Date()) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'nonce_expired',
        nonce,
        expires_at: nonceRecord.expires_at,
      });

      return new Response(
        JSON.stringify({ error: 'nonce_expired', message: 'Nonce has expired, please request a new one' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature using viem
    let isValid = false;
    try {
      isValid = await verifyMessage({
        address: normalizedAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (error) {
      console.error('Signature verification error:', error);
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'signature_verification_error',
        error: error.message,
      });

      return new Response(
        JSON.stringify({ error: 'verification_failed', message: 'Signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValid) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'invalid_signature',
      });

      return new Response(
        JSON.stringify({ error: 'invalid_signature', message: 'Signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark nonce as used
    await supabase
      .from('wallet_nonces')
      .update({ used_at: new Date().toISOString() })
      .eq('nonce', nonce);

    // Get client metadata
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                     req.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Upsert wallet identity (idempotent)
    // Assume chain_id = 1 (Ethereum mainnet) for Phase 1
    const chainId = 1;

    const { data: walletIdentity, error: upsertError } = await supabase
      .from('wallet_identities')
      .upsert(
        {
          user_id: user.id,
          wallet_address: normalizedAddress,
          chain_id: chainId,
          signature,
          message,
          verified_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          metadata: {
            ip: clientIp,
            user_agent: userAgent,
            verification_timestamp: new Date().toISOString(),
          },
        },
        {
          onConflict: 'wallet_address,chain_id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting wallet identity:', upsertError);
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'database_error',
        error: upsertError.message,
      });

      return new Response(
        JSON.stringify({ error: 'database_error', message: 'Failed to save wallet identity' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful verification
    await logAuditEvent(supabase, user.id, 'wallet_verified', normalizedAddress, {
      wallet_identity_id: walletIdentity.id,
      chain_id: chainId,
      ip: clientIp,
    });

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        wallet_identity_id: walletIdentity.id,
        wallet_address: normalizedAddress,
        chain_id: chainId,
        verified_at: walletIdentity.verified_at,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Unexpected error in web3-verify function:', error);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: 'An unexpected error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
