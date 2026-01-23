/**
 * NFT Verification Edge Function with SIWE + Revocation
 *
 * Purpose: Verify wallet ownership via SIWE signature and check NFT balance
 *
 * Endpoint: POST /verify-nft
 *
 * Request Body:
 *   {
 *     "wallet_address": "0x...",
 *     "signature": "0x...",
 *     "message": "...",           // Full SIWE message
 *     "nonce": "...",             // Nonce from siwe-nonce
 *     "timestamp": "..."          // ISO timestamp
 *   }
 *
 * Response (success):
 *   {
 *     "success": true,
 *     "has_premium_nft": true,
 *     "nft_balance": 1,
 *     "wallet_address": "0x...",
 *     "verified_at": "..."
 *   }
 *
 * Response (revoked):
 *   {
 *     "success": true,
 *     "has_premium_nft": false,
 *     "nft_balance": 0,
 *     "wallet_address": "0x...",
 *     "revoked": true,
 *     "reason": "NFT transferred"
 *   }
 *
 * Security:
 *   - Requires authenticated session
 *   - Verifies nonce exists, not used, not expired
 *   - Verifies signature matches reconstructed SIWE message
 *   - Domain binding check (expected domain)
 *   - Chain ID binding check (80002 for Amoy)
 *   - Marks nonce as used atomically
 *   - Checks NFT balance on chain
 *   - Revokes access if NFT transferred away
 *
 * @author APEX OmniHub
 * @date 2026-01-24
 * @phase Phase 0 - NFT Verification with Revocation
 */

import { verifyMessage } from 'https://esm.sh/viem@2.43.4';
import { createPublicClient, http } from 'https://esm.sh/viem@2.43.4';
import { polygonAmoy } from 'https://esm.sh/viem@2.43.4/chains';
import { handleCors, corsJsonResponse, buildCorsHeaders, isOriginAllowed } from '../_shared/cors.ts';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '../_shared/rate-limit.ts';
import { isValidWalletAddress, isValidSignature, validateRequestBody } from '../_shared/validation.ts';
import { createSupabaseClient, authenticateUser, createAuthErrorResponse, createMethodNotAllowedResponse, createInternalErrorResponse, getClientIP, getUserAgent } from '../_shared/auth.ts';

// =============================================================
//                        CONFIGURATION
// =============================================================

const DEFAULT_CHAIN_ID = 80002; // Polygon Amoy
const EXPECTED_DOMAINS = ['omnihub.app', 'localhost', '127.0.0.1'];

// ERC721 balanceOf ABI
const ERC721_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// =============================================================
//                        SIWE PARSING
// =============================================================

interface ParsedSiweMessage {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: Date;
  expirationTime: Date;
}

/**
 * Parse EIP-4361 SIWE message
 */
function parseSiweMessage(message: string): ParsedSiweMessage | null {
  try {
    const lines = message.split('\n');

    // Line 0: "{domain} wants you to sign in with your Ethereum account:"
    const domainMatch = lines[0]?.match(/^(.+) wants you to sign in with your Ethereum account:$/);
    if (!domainMatch) return null;
    const domain = domainMatch[1];

    // Line 1: address
    const address = lines[1]?.trim();
    if (!address || !isValidWalletAddress(address.toLowerCase())) return null;

    // Line 2: empty
    // Line 3: statement
    const statement = lines[3]?.trim() || '';

    // Parse key-value fields
    const fields: Record<string, string> = {};
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i];
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        fields[key] = value;
      }
    }

    return {
      domain,
      address: address.toLowerCase(),
      statement,
      uri: fields['URI'] || '',
      version: fields['Version'] || '1',
      chainId: parseInt(fields['Chain ID'] || '0', 10),
      nonce: fields['Nonce'] || '',
      issuedAt: new Date(fields['Issued At'] || ''),
      expirationTime: new Date(fields['Expiration Time'] || ''),
    };
  } catch (error) {
    console.error('Failed to parse SIWE message:', error);
    return null;
  }
}

// =============================================================
//                      NFT VERIFICATION
// =============================================================

/**
 * Verify NFT ownership via blockchain RPC
 */
async function verifyNftBalance(walletAddress: string): Promise<{ balance: number; error?: string }> {
  const nftContractAddress = Deno.env.get('MEMBERSHIP_NFT_ADDRESS');
  if (!nftContractAddress) {
    return { balance: 0, error: 'MEMBERSHIP_NFT_ADDRESS not configured' };
  }

  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY_POLYGON');
  if (!alchemyKey) {
    return { balance: 0, error: 'ALCHEMY_API_KEY_POLYGON not configured' };
  }

  try {
    const client = createPublicClient({
      chain: polygonAmoy,
      transport: http(`https://polygon-amoy.g.alchemy.com/v2/${alchemyKey}`),
    });

    const balance = await client.readContract({
      address: nftContractAddress as `0x${string}`,
      abi: ERC721_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    });

    return { balance: Number(balance) };
  } catch (error) {
    console.error('NFT balance check failed:', error);
    return { balance: 0, error: `RPC error: ${error.message}` };
  }
}

// =============================================================
//                      AUDIT LOGGING
// =============================================================

async function logAuditEvent(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string,
  action: string,
  walletAddress: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: 'nft_verification',
      resource_id: walletAddress,
      metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}

// =============================================================
//                      REQUEST HANDLER
// =============================================================

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

    // Authenticate user
    const authResult = await authenticateUser(req.headers.get('Authorization'), supabase);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult.error!);
    }
    const { user } = authResult;
    const userId = user!.id;

    // Check rate limit
    const rateLimit = await checkRateLimit(userId, RATE_LIMIT_CONFIGS.verifyNft);
    if (!rateLimit.allowed) {
      await logAuditEvent(supabase, userId, 'verify_nft_rate_limited', 'unknown', {
        retry_after: Math.ceil(rateLimit.resetIn / 1000),
      });
      return corsJsonResponse({
        success: false,
        error: 'rate_limited',
        message: 'Too many verification attempts',
      }, 429, requestOrigin);
    }

    // Parse and validate request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return corsJsonResponse({
        success: false,
        error: 'invalid_json',
        message: 'Request body must be valid JSON',
      }, 400, requestOrigin);
    }

    const validation = validateRequestBody(body, ['wallet_address', 'signature', 'message', 'nonce']);
    if (!validation.valid) {
      return corsJsonResponse({
        success: false,
        error: 'invalid_request',
        message: validation.errors[0],
      }, 400, requestOrigin);
    }

    const {
      wallet_address,
      signature,
      message,
      nonce,
    } = body as {
      wallet_address: string;
      signature: string;
      message: string;
      nonce: string;
    };

    // Normalize wallet address
    const normalizedAddress = wallet_address.toLowerCase();

    if (!isValidWalletAddress(normalizedAddress)) {
      await logAuditEvent(supabase, userId, 'verify_nft_invalid_address', normalizedAddress, {});
      return corsJsonResponse({
        success: false,
        error: 'invalid_address',
        message: 'Invalid wallet address format',
      }, 400, requestOrigin);
    }

    if (!isValidSignature(signature)) {
      await logAuditEvent(supabase, userId, 'verify_nft_invalid_signature', normalizedAddress, {});
      return corsJsonResponse({
        success: false,
        error: 'invalid_signature',
        message: 'Invalid signature format',
      }, 400, requestOrigin);
    }

    // Parse SIWE message
    const siweMessage = parseSiweMessage(message);
    if (!siweMessage) {
      await logAuditEvent(supabase, userId, 'verify_nft_invalid_siwe', normalizedAddress, {});
      return corsJsonResponse({
        success: false,
        error: 'invalid_message',
        message: 'Failed to parse SIWE message',
      }, 400, requestOrigin);
    }

    // Verify address matches
    if (siweMessage.address !== normalizedAddress) {
      await logAuditEvent(supabase, userId, 'verify_nft_address_mismatch', normalizedAddress, {
        message_address: siweMessage.address,
      });
      return corsJsonResponse({
        success: false,
        error: 'address_mismatch',
        message: 'Wallet address does not match signed message',
      }, 400, requestOrigin);
    }

    // Verify domain binding
    const isDomainAllowed = EXPECTED_DOMAINS.some(d =>
      siweMessage.domain === d || siweMessage.domain.endsWith(`.${d}`)
    );

    // Also check against ALLOWED_ORIGINS if set
    if (!isDomainAllowed) {
      const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS') || '';
      const allowedDomains = allowedOrigins.split(',').map(o => {
        try {
          return new URL(o.trim()).host;
        } catch {
          return o.trim();
        }
      });

      if (!allowedDomains.includes(siweMessage.domain)) {
        await logAuditEvent(supabase, userId, 'verify_nft_domain_invalid', normalizedAddress, {
          domain: siweMessage.domain,
        });
        return corsJsonResponse({
          success: false,
          error: 'invalid_domain',
          message: 'Domain not allowed',
        }, 400, requestOrigin);
      }
    }

    // Verify chain ID
    if (siweMessage.chainId !== DEFAULT_CHAIN_ID) {
      await logAuditEvent(supabase, userId, 'verify_nft_chain_mismatch', normalizedAddress, {
        expected: DEFAULT_CHAIN_ID,
        received: siweMessage.chainId,
      });
      return corsJsonResponse({
        success: false,
        error: 'chain_mismatch',
        message: `Expected chain ID ${DEFAULT_CHAIN_ID} (Polygon Amoy)`,
      }, 400, requestOrigin);
    }

    // Verify nonce matches
    if (siweMessage.nonce !== nonce) {
      await logAuditEvent(supabase, userId, 'verify_nft_nonce_mismatch', normalizedAddress, {});
      return corsJsonResponse({
        success: false,
        error: 'nonce_mismatch',
        message: 'Nonce does not match signed message',
      }, 400, requestOrigin);
    }

    // Atomically verify and consume nonce
    const { data: nonceResult, error: nonceError } = await supabase
      .rpc('use_auth_nonce', {
        p_nonce: nonce,
        p_wallet_address: normalizedAddress,
        p_chain_id: DEFAULT_CHAIN_ID,
      });

    if (nonceError || !nonceResult || nonceResult.length === 0) {
      await logAuditEvent(supabase, userId, 'verify_nft_nonce_rpc_error', normalizedAddress, {
        error: nonceError?.message,
      });
      return corsJsonResponse({
        success: false,
        error: 'nonce_verification_failed',
        message: 'Failed to verify nonce',
      }, 500, requestOrigin);
    }

    const nonceStatus = nonceResult[0];
    if (!nonceStatus.success) {
      await logAuditEvent(supabase, userId, 'verify_nft_nonce_invalid', normalizedAddress, {
        error_code: nonceStatus.error_code,
      });

      const errorMessages: Record<string, string> = {
        'NONCE_NOT_FOUND': 'Nonce not found or already used',
        'NONCE_ALREADY_USED': 'Nonce has already been used (replay attack)',
        'NONCE_EXPIRED': 'Nonce has expired, please request a new one',
      };

      return corsJsonResponse({
        success: false,
        error: nonceStatus.error_code.toLowerCase(),
        message: errorMessages[nonceStatus.error_code] || 'Invalid nonce',
      }, 400, requestOrigin);
    }

    // Verify signature using viem
    let signatureValid = false;
    try {
      signatureValid = await verifyMessage({
        address: normalizedAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (error) {
      console.error('Signature verification error:', error);
      await logAuditEvent(supabase, userId, 'verify_nft_signature_error', normalizedAddress, {
        error: error.message,
      });
      return corsJsonResponse({
        success: false,
        error: 'verification_failed',
        message: 'Signature verification failed',
      }, 400, requestOrigin);
    }

    if (!signatureValid) {
      await logAuditEvent(supabase, userId, 'verify_nft_signature_invalid', normalizedAddress, {});
      return corsJsonResponse({
        success: false,
        error: 'invalid_signature',
        message: 'Wallet signature verification failed',
      }, 400, requestOrigin);
    }

    // Check NFT balance on chain
    const { balance: nftBalance, error: nftError } = await verifyNftBalance(normalizedAddress);

    if (nftError) {
      console.warn('NFT verification warning:', nftError);
      // Continue with balance=0 (fail-safe)
    }

    const hasPremiumNft = nftBalance > 0;
    const verifiedAt = new Date().toISOString();
    const clientIp = getClientIP(req);
    const userAgent = getUserAgent(req);

    // Upsert wallet identity
    const { error: walletError } = await supabase
      .from('user_wallets')
      .upsert({
        user_id: userId,
        wallet_address: normalizedAddress,
        chain_id: DEFAULT_CHAIN_ID,
        signature,
        message,
        verified_at: verifiedAt,
        is_active: true,
        has_premium_nft: hasPremiumNft,
        nft_balance: nftBalance,
        nft_verified_at: verifiedAt,
        nft_contract_address: Deno.env.get('MEMBERSHIP_NFT_ADDRESS') || null,
      }, {
        onConflict: 'wallet_address,chain_id',
        ignoreDuplicates: false,
      });

    if (walletError) {
      console.error('Wallet upsert error:', walletError);
    }

    // Update user profile premium status
    if (hasPremiumNft) {
      await supabase
        .from('profiles')
        .update({
          has_premium_nft: true,
          nft_verified_at: verifiedAt,
        })
        .eq('id', userId);
    } else {
      // REVOCATION: User had wallet verified but no longer has NFT
      const { data: existingWallet } = await supabase
        .from('user_wallets')
        .select('has_premium_nft')
        .eq('user_id', userId)
        .eq('wallet_address', normalizedAddress)
        .maybeSingle();

      if (existingWallet?.has_premium_nft) {
        // This is a revocation scenario
        await logAuditEvent(supabase, userId, 'nft_access_revoked', normalizedAddress, {
          previous_balance: existingWallet.has_premium_nft ? 'unknown' : 0,
          new_balance: nftBalance,
          reason: 'NFT transferred or sold',
        });

        await supabase
          .from('profiles')
          .update({
            has_premium_nft: false,
            nft_verified_at: verifiedAt,
          })
          .eq('id', userId);

        return corsJsonResponse({
          success: true,
          has_premium_nft: false,
          nft_balance: nftBalance,
          wallet_address: normalizedAddress,
          chain_id: DEFAULT_CHAIN_ID,
          verified_at: verifiedAt,
          revoked: true,
          reason: 'NFT transferred or sold',
        }, 200, requestOrigin);
      }
    }

    // Log successful verification
    await logAuditEvent(supabase, userId, 'verify_nft_success', normalizedAddress, {
      has_premium_nft: hasPremiumNft,
      nft_balance: nftBalance,
      ip: clientIp,
    });

    // Return success response
    return corsJsonResponse({
      success: true,
      has_premium_nft: hasPremiumNft,
      nft_balance: nftBalance,
      wallet_address: normalizedAddress,
      chain_id: DEFAULT_CHAIN_ID,
      verified_at: verifiedAt,
    }, 200, requestOrigin);

  } catch (error) {
    console.error('Unexpected error in verify-nft:', error);
    return createInternalErrorResponse('An unexpected error occurred');
  }
});
