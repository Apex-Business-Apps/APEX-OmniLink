/**
 * Alchemy Webhook Event Processor Edge Function
 *
 * Purpose: Process blockchain events from Alchemy webhooks and update user state
 *
 * Endpoint: POST /alchemy-webhook
 *
 * Request Body: Alchemy webhook payload
 *   {
 *     "webhookId": "...",
 *     "id": "...",
 *     "createdAt": "...",
 *     "type": "NFT_ACTIVITY",
 *     "event": {
 *       "network": "MATIC_MAINNET",
 *       "activity": [{
 *         "fromAddress": "0x...",
 *         "toAddress": "0x...",
 *         "contractAddress": "0x...",
 *         "tokenId": "1",
 *         "category": "erc721",
 *         "log": { ... }
 *       }]
 *     }
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "processed": number,
 *     "webhook_id": "..."
 *   }
 *
 * Security:
 *   - Validates Alchemy webhook signature
 *   - Idempotent processing (webhook_id deduplication)
 *   - Fail-closed on signature validation
 *   - Comprehensive audit logging
 *   - Only processes APEXMembershipNFT contract
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// CORS headers (minimal - webhooks are server-to-server)
const corsHeaders = {
  'Content-Type': 'application/json',
};

interface AlchemyActivity {
  fromAddress: string;
  toAddress: string;
  contractAddress: string;
  tokenId: string;
  category: string;
  log?: {
    blockNumber: string;
    transactionHash: string;
  };
}

interface AlchemyWebhookPayload {
  webhookId: string;
  id: string;
  createdAt: string;
  type: string;
  event: {
    network: string;
    activity: AlchemyActivity[];
  };
}

/**
 * Verify Alchemy webhook signature
 * Alchemy uses X-Alchemy-Signature header with HMAC-SHA256
 */
async function verifyWebhookSignature(
  req: Request,
  body: string
): Promise<boolean> {
  const signature = req.headers.get('X-Alchemy-Signature');
  if (!signature) {
    console.error('[alchemy-webhook] Missing signature header');
    return false;
  }

  const signingKey = Deno.env.get('ALCHEMY_WEBHOOK_SIGNING_KEY');
  if (!signingKey) {
    console.error('[alchemy-webhook] Webhook signing key not configured');
    return false;
  }

  try {
    // Import the signing key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Compute HMAC
    const mac = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(body)
    );

    // Convert to hex string
    const computedSignature = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare signatures (constant-time comparison would be ideal)
    const isValid = computedSignature === signature.toLowerCase();

    if (!isValid) {
      console.error('[alchemy-webhook] Signature mismatch');
      console.error('[alchemy-webhook] Expected:', computedSignature);
      console.error('[alchemy-webhook] Received:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('[alchemy-webhook] Signature verification error:', error);
    return false;
  }
}

/**
 * Check if webhook was already processed (idempotency)
 */
async function isWebhookProcessed(supabase: any, webhookId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('action', 'alchemy_webhook_processed')
    .eq('metadata->>webhook_id', webhookId)
    .limit(1);

  return !error && data && data.length > 0;
}

/**
 * Log webhook processing
 */
async function logWebhookProcessing(
  supabase: any,
  webhookId: string,
  payload: AlchemyWebhookPayload,
  processed: number
): Promise<void> {
  await supabase.from('audit_logs').insert({
    action: 'alchemy_webhook_processed',
    resource_type: 'blockchain_event',
    resource_id: webhookId,
    metadata: {
      webhook_id: webhookId,
      webhook_type: payload.type,
      network: payload.event.network,
      activities_processed: processed,
      created_at: payload.createdAt,
    },
  });
}

/**
 * Process NFT transfer activity
 */
async function processNFTActivity(
  supabase: any,
  activity: AlchemyActivity,
  nftContractAddress: string
): Promise<boolean> {
  // Only process transfers for our NFT contract
  if (activity.contractAddress.toLowerCase() !== nftContractAddress.toLowerCase()) {
    return false;
  }

  // Normalize addresses
  const fromAddress = activity.fromAddress.toLowerCase();
  const toAddress = activity.toAddress.toLowerCase();

  // Find users with these wallet addresses
  const { data: wallets } = await supabase
    .from('wallet_identities')
    .select('user_id, wallet_address')
    .or(`wallet_address.eq.${fromAddress},wallet_address.eq.${toAddress}`);

  if (!wallets || wallets.length === 0) {
    console.log('[alchemy-webhook] No registered users involved in transfer');
    return false;
  }

  // For each affected wallet, invalidate cache and update profile
  for (const wallet of wallets) {
    // Invalidate chain cache
    await supabase
      .from('chain_entitlements_cache')
      .delete()
      .eq('wallet_address', wallet.wallet_address.toLowerCase())
      .eq('query_type', 'nft_balance');

    // Query fresh balance from contract (we'll do this via the verify-nft function)
    // For now, just mark as needing verification
    await supabase
      .from('profiles')
      .update({
        nft_verified_at: null, // Force re-verification
      })
      .eq('id', wallet.user_id);

    console.log(`[alchemy-webhook] Invalidated NFT cache for user ${wallet.user_id}`);
  }

  return true;
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    // Read body as text for signature verification
    const bodyText = await req.text();

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(req, bodyText);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse payload
    let payload: AlchemyWebhookPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate payload structure
    if (!payload.webhookId || !payload.event || !payload.event.activity) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload structure' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already processed (idempotency)
    const alreadyProcessed = await isWebhookProcessed(supabase, payload.webhookId);
    if (alreadyProcessed) {
      console.log(`[alchemy-webhook] Webhook ${payload.webhookId} already processed`);
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          webhook_id: payload.webhookId,
          message: 'Already processed',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get NFT contract address
    const nftContractAddress = Deno.env.get('MEMBERSHIP_NFT_ADDRESS');
    if (!nftContractAddress) {
      return new Response(
        JSON.stringify({ error: 'NFT contract not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Process all activities
    let processedCount = 0;
    for (const activity of payload.event.activity) {
      const processed = await processNFTActivity(supabase, activity, nftContractAddress);
      if (processed) {
        processedCount++;
      }
    }

    // Log webhook processing
    await logWebhookProcessing(supabase, payload.webhookId, payload, processedCount);

    console.log(`[alchemy-webhook] Processed ${processedCount} activities from webhook ${payload.webhookId}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        webhook_id: payload.webhookId,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[alchemy-webhook] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
