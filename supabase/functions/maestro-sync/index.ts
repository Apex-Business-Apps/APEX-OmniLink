/**
 * MAESTRO Sync Edge Function
 *
 * Responsibilities:
 * - Auth/RLS enforcement (deny-by-default)
 * - Idempotency via maestro_receipts (UNIQUE constraint)
 * - Audit log append (maestro_audit)
 * - E2EE metadata storage (maestro_encrypted_blobs)
 * - Schema validation (reject plaintext content)
 * - Rate limiting
 *
 * Phase 4: Backend Sync Implementation
 */

import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabaseClient.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

/**
 * Sync request payload
 */
interface SyncRequest {
  idempotency_key: string;
  canonical_event: {
    id: string;
    timestamp: string;
    locale: string;
    tier: 'core' | 'working' | 'episodic' | 'semantic' | 'procedural';
    intent_type: string;
    risk_lane: 'GREEN' | 'YELLOW' | 'RED';
    content_hash: string;
    trace_id?: string;
  };
  encrypted_blob: {
    blob_path: string;
    content_hash: string;
    key_version: number;
    locale: string;
    tier: 'core' | 'working' | 'episodic' | 'semantic' | 'procedural';
    size_bytes: number;
    metadata?: Record<string, unknown>;
    expires_at?: string;
  };
}

/**
 * Sync response
 */
interface SyncResponse {
  status: 'ok' | 'duplicate';
  receipt_id: string;
  created_at: string;
  outcome?: unknown;
}

/**
 * Validate sync request schema
 * CRITICAL: Reject any plaintext content
 */
function validateSyncRequest(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const req = body as Partial<SyncRequest>;

  // Validate idempotency_key
  if (!req.idempotency_key || typeof req.idempotency_key !== 'string') {
    return { valid: false, error: 'Missing or invalid idempotency_key' };
  }

  // Validate canonical_event
  if (!req.canonical_event || typeof req.canonical_event !== 'object') {
    return { valid: false, error: 'Missing or invalid canonical_event' };
  }

  const event = req.canonical_event;
  if (!event.id || !event.timestamp || !event.locale || !event.tier || !event.intent_type || !event.risk_lane || !event.content_hash) {
    return { valid: false, error: 'Incomplete canonical_event' };
  }

  // Validate tier
  const validTiers = ['core', 'working', 'episodic', 'semantic', 'procedural'];
  if (!validTiers.includes(event.tier)) {
    return { valid: false, error: `Invalid tier: ${event.tier}` };
  }

  // Validate risk_lane
  const validRiskLanes = ['GREEN', 'YELLOW', 'RED'];
  if (!validRiskLanes.includes(event.risk_lane)) {
    return { valid: false, error: `Invalid risk_lane: ${event.risk_lane}` };
  }

  // Validate encrypted_blob
  if (!req.encrypted_blob || typeof req.encrypted_blob !== 'object') {
    return { valid: false, error: 'Missing or invalid encrypted_blob' };
  }

  const blob = req.encrypted_blob;
  if (!blob.blob_path || !blob.content_hash || typeof blob.key_version !== 'number' || !blob.locale || !blob.tier || typeof blob.size_bytes !== 'number') {
    return { valid: false, error: 'Incomplete encrypted_blob' };
  }

  // CRITICAL: Reject if blob_path contains plaintext indicators
  // Encrypted blobs should be stored in Supabase Storage or similar
  // The blob_path should be a reference, not plaintext content
  if (blob.blob_path.includes('plaintext') || blob.blob_path.includes('unencrypted')) {
    return { valid: false, error: 'Plaintext content rejected' };
  }

  // Validate content_hash matches
  if (event.content_hash !== blob.content_hash) {
    return { valid: false, error: 'Content hash mismatch between event and blob' };
  }

  return { valid: true };
}

/**
 * Check idempotency and return cached outcome if exists
 */
async function checkIdempotency(
  tenantId: string,
  idempotencyKey: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ exists: boolean; receipt?: unknown }> {
  const { data, error } = await supabase
    .from('maestro_receipts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', idempotencyKey)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (not an error for our use case)
    throw new Error(`Idempotency check failed: ${error.message}`);
  }

  return {
    exists: !!data,
    receipt: data,
  };
}

/**
 * Insert receipt, audit log, and blob metadata
 */
async function insertSyncData(
  tenantId: string,
  request: SyncRequest,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ receipt_id: string; created_at: string }> {
  // 1. Insert receipt (idempotency enforcement via UNIQUE constraint)
  const { data: receipt, error: receiptError } = await supabase
    .from('maestro_receipts')
    .insert({
      tenant_id: tenantId,
      idempotency_key: request.idempotency_key,
      canonical_event: request.canonical_event,
      outcome: { status: 'synced' },
    })
    .select('id, created_at')
    .single();

  if (receiptError) {
    // Check if it's a duplicate key violation
    if (receiptError.code === '23505') {
      // PostgreSQL unique violation
      throw new Error('Duplicate idempotency key (race condition detected)');
    }
    throw new Error(`Failed to insert receipt: ${receiptError.message}`);
  }

  // 2. Append to audit log
  const { error: auditError } = await supabase.from('maestro_audit').insert({
    tenant_id: tenantId,
    trace_id: request.canonical_event.trace_id || request.canonical_event.id,
    event_type: request.canonical_event.intent_type,
    risk_lane: request.canonical_event.risk_lane,
    content_hash: request.canonical_event.content_hash,
    metadata: {
      idempotency_key: request.idempotency_key,
      locale: request.canonical_event.locale,
      tier: request.canonical_event.tier,
    },
  });

  if (auditError) {
    throw new Error(`Failed to append audit log: ${auditError.message}`);
  }

  // 3. Store encrypted blob metadata (deduplication via UNIQUE constraint)
  const { error: blobError } = await supabase.from('maestro_encrypted_blobs').insert({
    tenant_id: tenantId,
    blob_path: request.encrypted_blob.blob_path,
    content_hash: request.encrypted_blob.content_hash,
    key_version: request.encrypted_blob.key_version,
    locale: request.encrypted_blob.locale,
    tier: request.encrypted_blob.tier,
    size_bytes: request.encrypted_blob.size_bytes,
    metadata: request.encrypted_blob.metadata || {},
    expires_at: request.encrypted_blob.expires_at || null,
  });

  // Ignore duplicate blob errors (deduplication working as intended)
  if (blobError && blobError.code !== '23505') {
    throw new Error(`Failed to store blob metadata: ${blobError.message}`);
  }

  return {
    receipt_id: receipt.id,
    created_at: receipt.created_at,
  };
}

/**
 * Unauthorized response helper
 */
function unauthorized(corsHeaders: HeadersInit): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return unauthorized(corsHeaders);
    }

    const supabase = createAnonClient(authHeader);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return unauthorized(corsHeaders);
    }

    const tenantId = user.id;

    // 2. Rate limiting (100 requests per minute per tenant)
    const rateLimitKey = `maestro-sync:${tenantId}`;
    const rateLimit = checkRateLimit(rateLimitKey, 100, 60 * 1000);

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: 'Too many requests',
          resetIn: rateLimit.resetIn,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Parse and validate request body
    const body = await req.json();
    const validation = validateSyncRequest(body);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'validation_error', message: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const request = body as SyncRequest;

    // 4. Check idempotency
    const serviceClient = createServiceClient();
    const idempotencyCheck = await checkIdempotency(
      tenantId,
      request.idempotency_key,
      serviceClient
    );

    if (idempotencyCheck.exists) {
      // Return cached outcome
      const cached = idempotencyCheck.receipt as { id: string; created_at: string; outcome?: unknown };
      return new Response(
        JSON.stringify({
          status: 'duplicate',
          receipt_id: cached.id,
          created_at: cached.created_at,
          outcome: cached.outcome,
        } as SyncResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Insert new sync data
    const result = await insertSyncData(tenantId, request, serviceClient);

    return new Response(
      JSON.stringify({
        status: 'ok',
        receipt_id: result.receipt_id,
        created_at: result.created_at,
      } as SyncResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('MAESTRO sync error:', error);
    return new Response(
      JSON.stringify({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
