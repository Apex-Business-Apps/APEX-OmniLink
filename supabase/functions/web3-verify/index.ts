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

import { verifyMessage, verifyTypedData } from 'https://esm.sh/viem@2.21.54';
import { handleCors, corsJsonResponse, buildCorsHeaders, isOriginAllowed } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitExceededResponse, RATE_LIMIT_CONFIGS } from '../_shared/rate-limit.ts';
import { isValidWalletAddress, isValidSignature, validateRequestBody } from '../_shared/validation.ts';
import { createSupabaseClient, authenticateUser, createAuthErrorResponse, createMethodNotAllowedResponse, createInternalErrorResponse } from '../_shared/auth.ts';




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
  supabase: unknown,
  userId: string,
  action: string,
  walletAddress: string,
  metadata: Record<string, unknown>
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
  const requestOrigin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;
  const corsHeaders = buildCorsHeaders(requestOrigin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only allow POST requests
  if (req.method !== 'POST') {
    return createMethodNotAllowedResponse(['POST']);
  }

  try {
    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Get authenticated user from JWT
    const authResult = await authenticateUser(req.headers.get('Authorization'), supabase);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult.error!);
    }
    const { user } = authResult;

    // Check rate limit (now async)
    const rateLimit = await checkRateLimit(user!.id, RATE_LIMIT_CONFIGS.web3Verify);
    if (!rateLimit.allowed) {
      await logAuditEvent(supabase, user!.id, 'wallet_verify_rate_limited', 'unknown', {
        retry_after: Math.ceil(rateLimit.resetIn / 1000),
      });

      const origin = req.headers.get('origin');
      return rateLimitExceededResponse(origin, rateLimit);
    }

    // Parse and validate request body
    const body = await req.json();
    const { wallet_address, signature, message, typedData, domain, types, primaryType } = body;

    // Validate required fields - support both personal_sign and typedData
    const validation = validateRequestBody(body, ['wallet_address', 'signature']);
    if (!validation.valid) {
      return corsJsonResponse({ error: 'invalid_request', message: validation.errors[0] }, 400);
    }

    // Must have either message (personal_sign) or typedData (EIP-712)
    if (!message && !typedData) {
      return corsJsonResponse({
        error: 'invalid_request',
        message: 'Either message (personal_sign) or typedData (EIP-712) must be provided',
      }, 400);
    }

    // Normalize and validate wallet address
    const normalizedAddress = wallet_address.toLowerCase();
    if (!isValidWalletAddress(normalizedAddress)) {
      await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'invalid_address_format',
      });

      return corsJsonResponse({ error: 'invalid_address', message: 'Invalid Ethereum wallet address format' }, 400);
    }

    // Validate signature format
    if (!isValidSignature(signature)) {
      await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'invalid_signature_format',
      });

      return corsJsonResponse({ error: 'invalid_signature', message: 'Invalid signature format' }, 400);
    }

    // Extract and validate nonce from message
    const nonce = extractNonceFromMessage(message);
    if (!nonce) {
      await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'nonce_not_found_in_message',
      });

      return corsJsonResponse({ error: 'invalid_message', message: 'Message does not contain a valid nonce' }, 400);
    }

    if (!siweMessage.domain || !siweMessage.uri) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'missing_siwe_fields',
      });

      return new Response(
        JSON.stringify({ error: 'invalid_message', message: 'Missing required SIWE fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let messageOrigin: string;
    try {
      messageOrigin = resolveOriginFromUri(siweMessage.uri);
    } catch {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'invalid_siwe_uri',
      });

      return new Response(
        JSON.stringify({ error: 'invalid_message', message: 'SIWE uri must be a valid URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expectedDomain = new URL(siweMessage.uri).host;
    if (siweMessage.domain !== expectedDomain) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'siwe_domain_mismatch',
      });

      return new Response(
        JSON.stringify({ error: 'invalid_message', message: 'SIWE domain mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (requestOrigin && requestOrigin !== messageOrigin) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'origin_mismatch',
      });

      return new Response(
        JSON.stringify({ error: 'invalid_message', message: 'Origin does not match SIWE uri' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isOriginAllowed(messageOrigin)) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'origin_not_allowed',
      });

      return new Response(
        JSON.stringify({ error: 'forbidden', message: 'Origin not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!siweMessage.chainId || siweMessage.chainId !== resolvedChainId) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'chain_id_mismatch',
        chain_id: resolvedChainId,
        message_chain_id: siweMessage.chainId,
      });

      return new Response(
        JSON.stringify({ error: 'invalid_message', message: 'SIWE chainId mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify nonce exists, is unused, and not expired
    const { data: nonceRecord, error: nonceError } = await supabase
      .from('wallet_nonces')
      .select('*')
      .eq('nonce', messageNonce)
      .eq('wallet_address', normalizedAddress)
      .eq('chain_id', resolvedChainId)
      .is('used_at', null)
      .maybeSingle();

    if (nonceError || !nonceRecord) {
      await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'nonce_not_found',
        nonce: messageNonce,
      });

      return corsJsonResponse({ error: 'invalid_nonce', message: 'Nonce not found or already used' }, 400);
    }

    // Check nonce expiration
    const expiresAt = new Date(nonceRecord.expires_at);
    if (expiresAt < new Date()) {
      await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'nonce_expired',
        nonce: messageNonce,
        expires_at: nonceRecord.expires_at,
      });

      return corsJsonResponse({ error: 'nonce_expired', message: 'Nonce has expired, please request a new one' }, 400);
    }

    const expirationTime = siweMessage.expirationTime;
    if (!expirationTime || expirationTime.getTime() !== expiresAt.getTime()) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'expiration_mismatch',
        nonce: messageNonce,
      });

      return new Response(
        JSON.stringify({ error: 'invalid_message', message: 'SIWE expiration mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValidSiwe = validateSiweMessage({
      message: siweMessage,
      address: normalizedAddress as `0x${string}`,
      domain: expectedDomain,
      nonce: nonceRecord.nonce,
      time: new Date(),
    });

    if (!isValidSiwe) {
      await logAuditEvent(supabase, user.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'siwe_validation_failed',
        nonce: messageNonce,
      });

      return new Response(
        JSON.stringify({ error: 'invalid_message', message: 'SIWE validation failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature using viem
    let isValid = false;
    try {
      if (typedData && domain && types && primaryType) {
        // EIP-712 typedData verification
        isValid = await verifyTypedData({
          address: normalizedAddress as `0x${string}`,
          domain,
          types,
          primaryType,
          message: typedData,
          signature: signature as `0x${string}`,
        });
        await logAuditEvent(supabase, user.id, 'wallet_verify_typed_data_attempt', normalizedAddress, {
          verification_type: 'eip712',
          primary_type: primaryType,
        });
      } else if (message) {
        // Personal sign verification
        isValid = await verifyMessage({
          address: normalizedAddress as `0x${string}`,
          message,
          signature: signature as `0x${string}`,
        });
        await logAuditEvent(supabase, user.id, 'wallet_verify_personal_sign_attempt', normalizedAddress, {
          verification_type: 'personal_sign',
        });
      } else {
        await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
          reason: 'no_verification_data',
        });
        return corsJsonResponse({ error: 'invalid_request', message: 'No verification data provided' }, 400);
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'signature_verification_error',
        error: error.message,
      });

      return corsJsonResponse({ error: 'verification_failed', message: 'Signature verification failed' }, 400);
    }

    if (!isValid) {
      await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'invalid_signature',
      });

      return corsJsonResponse({ error: 'invalid_signature', message: 'Signature verification failed' }, 400);
    }

    // Mark nonce as used
    await supabase
      .from('wallet_nonces')
      .update({ used_at: new Date().toISOString() })
      .eq('nonce', messageNonce)
      .eq('chain_id', resolvedChainId);

    // Get client metadata
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Upsert wallet identity (idempotent)
    const { data: walletIdentity, error: upsertError } = await supabase
      .from('wallet_identities')
      .upsert(
        {
          user_id: user.id,
          wallet_address: normalizedAddress,
          chain_id: resolvedChainId,
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
      await logAuditEvent(supabase, user!.id, 'wallet_verify_failed', normalizedAddress, {
        reason: 'database_error',
        error: upsertError.message,
      });

      return corsJsonResponse({ error: 'database_error', message: 'Failed to save wallet identity' }, 500);
    }

    // Log successful verification
    await logAuditEvent(supabase, user!.id, 'wallet_verified', normalizedAddress, {
      wallet_identity_id: walletIdentity.id,
      chain_id: resolvedChainId,
      ip: clientIp,
    });

    // Return success response
    return corsJsonResponse({
      success: true,
      wallet_identity_id: walletIdentity.id,
      wallet_address: normalizedAddress,
      chain_id: chainId,
      verified_at: walletIdentity.verified_at,
    });

  } catch (error) {
    console.error('Unexpected error in web3-verify function:', error);
    return createInternalErrorResponse('An unexpected error occurred');
  }
});
