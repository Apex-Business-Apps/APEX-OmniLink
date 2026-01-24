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
 *         "log": {
 *           "transactionHash": "0x...",
 *           "logIndex": "0x..."
 *         }
 *       }]
 *     }
 *   }
 *
 * Response:
 *   { "success": true, "processed": number, "skipped": number }
 *
 * Security:
 *   - Verifies Alchemy webhook signature (X-Alchemy-Signature header)
 *   - Idempotent: uses (txHash + logIndex) as unique key
 *   - Uses service role for database access
 *   - Validates contract address matches MEMBERSHIP_NFT_ADDRESS
 *   - Fails closed on signature verification errors
 *
 * Environment Variables:
 *   - ALCHEMY_WEBHOOK_SIGNING_KEY
 *   - MEMBERSHIP_NFT_ADDRESS
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

/**
 * Verify Alchemy webhook signature
 */
async function verifyAlchemySignature(
  body: string,
  signature: string,
  signingKey: string
): Promise<boolean> {
  try {
    // Alchemy uses HMAC-SHA256
    const hmac = createHmac('sha256', signingKey);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    console.error('Signature verification error');
    return false;
  }
}

/**
 * NFT Activity Event from Alchemy
 */
interface AlchemyNFTActivity {
  fromAddress: string;
  toAddress: string;
  contractAddress: string;
  tokenId: string;
  category: string;
  log: {
    transactionHash: string;
    logIndex: string;
    blockNumber?: string;
  };
}

interface AlchemyWebhookPayload {
  webhookId: string;
  id: string;
  createdAt: string;
  type: string;
  event: {
    network: string;
    activity: AlchemyNFTActivity[];
  };
}

/**
 * Process a single NFT transfer event
 */
async function processNFTTransfer(
  supabase: unknown,
  activity: AlchemyNFTActivity,
  membershipNFTAddress: string
): Promise<{ success: boolean; reason?: string }> {
  const { fromAddress, toAddress, contractAddress, tokenId, log } = activity;

  // Validate this is for our membership NFT contract
  if (contractAddress.toLowerCase() !== membershipNFTAddress.toLowerCase()) {
    return { success: false, reason: 'contract_mismatch' };
  }

  // Create idempotency key (txHash + logIndex)
  const eventId = `${log.transactionHash}-${log.logIndex}`;

  // Check if event already processed
  const { data: existingEvent } = await supabase
    .from('chain_tx_log')
    .select('id, status')
    .eq('id', eventId)
    .maybeSingle();

  if (existingEvent) {
    return { success: true, reason: 'already_processed' };
  }

  // Record event as pending
  await supabase
    .from('chain_tx_log')
    .upsert({
      id: eventId,
      tx_hash: log.transactionHash,
      status: 'pending',
      metadata: {
        from: fromAddress,
        to: toAddress,
        contract: contractAddress,
        token_id: tokenId,
        log_index: log.logIndex,
        block_number: log.blockNumber,
      },
    });

  try {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const normalizedFrom = fromAddress.toLowerCase();
    const normalizedTo = toAddress.toLowerCase();

    // Handle NFT transfer OUT (user lost NFT)
    if (normalizedFrom !== zeroAddress) {
      // Find users with this wallet
      const { data: fromWallets } = await supabase
        .from('wallet_identities')
        .select('user_id')
        .eq('wallet_address', normalizedFrom);

      if (fromWallets && fromWallets.length > 0) {
        for (const wallet of fromWallets) {
          // Set has_premium_nft to false
          await supabase
            .from('profiles')
            .update({
              has_premium_nft: false,
              nft_verified_at: new Date().toISOString(),
            })
            .eq('id', wallet.user_id);

          console.log(`Removed NFT access for user ${wallet.user_id} (transfer out)`);
        }
      }
    }

    // Handle NFT transfer IN (user received NFT)
    if (normalizedTo !== zeroAddress) {
      // Find users with this wallet
      const { data: toWallets } = await supabase
        .from('wallet_identities')
        .select('user_id')
        .eq('wallet_address', normalizedTo);

      if (toWallets && toWallets.length > 0) {
        for (const wallet of toWallets) {
          // Set has_premium_nft to true
          await supabase
            .from('profiles')
            .update({
              has_premium_nft: true,
              nft_verified_at: new Date().toISOString(),
            })
            .eq('id', wallet.user_id);

          console.log(`Granted NFT access to user ${wallet.user_id} (transfer in)`);
        }
      }
    }

    // Mark event as confirmed
    await supabase
      .from('chain_tx_log')
      .update({ status: 'confirmed' })
      .eq('id', eventId);

    return { success: true };

  } catch (error) {
    console.error('Error processing NFT transfer:', error);

    // Mark event as failed
    await supabase
      .from('chain_tx_log')
      .update({
        status: 'failed',
        metadata: { error: error.message },
      })
      .eq('id', eventId);

    return { success: false, reason: 'processing_error' };
  }
}

/**
 * Main request handler
 */
Deno.serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed', message: 'Only POST requests are allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const demoMode = Deno.env.get('DEMO_MODE')?.toLowerCase() === 'true';
    if (demoMode) {
      return new Response(
        JSON.stringify({ demo: true, ignored: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get webhook signing key
    const signingKey = Deno.env.get('ALCHEMY_WEBHOOK_SIGNING_KEY');
    if (!signingKey) {
      console.error('ALCHEMY_WEBHOOK_SIGNING_KEY not configured');
      // Return 200 to prevent Alchemy retries for configuration issues
      return new Response(
        JSON.stringify({ error: 'configuration_error', message: 'Webhook signing key not configured' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get membership NFT contract address
    const membershipNFTAddress = Deno.env.get('MEMBERSHIP_NFT_ADDRESS');
    if (!membershipNFTAddress) {
      console.error('MEMBERSHIP_NFT_ADDRESS not configured');
      return new Response(
        JSON.stringify({ error: 'configuration_error', message: 'NFT contract address not configured' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get signature from header
    const signature = req.headers.get('x-alchemy-signature');
    if (!signature) {
      console.error('Missing X-Alchemy-Signature header');
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Missing signature header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify signature
    const isValidSignature = await verifyAlchemySignature(rawBody, signature, signingKey);
    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid webhook signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse webhook payload
    let payload: AlchemyWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('Invalid JSON payload:', error);
      return new Response(
        JSON.stringify({ error: 'invalid_payload', message: 'Invalid JSON payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate webhook type
    if (payload.type !== 'NFT_ACTIVITY') {
      console.log(`Ignoring webhook type: ${payload.type}`);
      return new Response(
        JSON.stringify({ success: true, processed: 0, skipped: 1, reason: 'unsupported_type' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process each activity in the event
    const activities = payload.event.activity || [];
    let processed = 0;
    let skipped = 0;

    for (const activity of activities) {
      const result = await processNFTTransfer(supabase, activity, membershipNFTAddress);
      if (result.success) {
        if (result.reason === 'already_processed') {
          skipped++;
        } else {
          processed++;
        }
      } else {
        console.error(`Failed to process activity: ${result.reason}`);
        skipped++;
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        webhook_id: payload.webhookId,
        processed,
        skipped,
        total: activities.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in alchemy-webhook function:', error);
    // Return 200 to prevent Alchemy retries for internal errors
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: 'An unexpected error occurred',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
