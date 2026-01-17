/**
 * Distributed Rate Limiting for Supabase Edge Functions
 *
 * Uses Supabase database for persistent rate limiting that survives cold starts.
 * Falls back to in-memory limiting if database is unavailable.
 *
 * CVE Remediation: Replaces in-memory Map() that reset on serverless cold starts.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Unique identifier prefix for this rate limit type */
  prefix: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in current window */
  remaining: number;
  /** Timestamp when the rate limit resets */
  resetAt: number;
  /** Whether distributed storage was used (vs fallback) */
  distributed: boolean;
}

// Fallback in-memory store (used when Supabase is unavailable)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Initialize Supabase client for rate limiting
 */
function getSupabaseClient(): SupabaseClient | null {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return null;
    return createClient(url, key);
  } catch {
    return null;
  }
}

/** Build a distributed rate limit result */
function buildResult(allowed: boolean, remaining: number, resetAt: number): RateLimitResult {
  return { allowed, remaining, resetAt, distributed: true };
}

/** Try RPC-based rate limiting */
async function tryRpcRateLimit(
  supabase: SupabaseClient,
  key: string,
  windowStart: number,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_window_start: new Date(windowStart).toISOString(),
    p_max_requests: config.maxRequests,
    p_window_ms: config.windowMs,
  });

  if (error || !data) return null;

  return buildResult(data.allowed, data.remaining, new Date(data.reset_at).getTime());
}

/** Handle race condition retry after upsert conflict */
async function handleUpsertRetry(
  supabase: SupabaseClient,
  key: string,
  now: number,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  const { data: retryRecord } = await supabase
    .from('rate_limits')
    .select('request_count, window_start')
    .eq('key', key)
    .single();

  if (!retryRecord) return null;

  const retryCount = retryRecord.request_count;
  const retryWindowStart = new Date(retryRecord.window_start).getTime();
  const withinWindow = now - retryWindowStart < config.windowMs;

  if (!withinWindow) return null;

  if (retryCount >= config.maxRequests) {
    return buildResult(false, 0, retryWindowStart + config.windowMs);
  }

  // Increment atomically
  await incrementRateLimit(supabase, key, retryCount);
  return null; // Let caller return default success
}

/** Increment rate limit counter with optimistic locking */
async function incrementRateLimit(
  supabase: SupabaseClient,
  key: string,
  currentCount: number
): Promise<void> {
  try {
    await supabase.rpc('increment_rate_limit', { p_key: key });
  } catch {
    // Fallback: direct update with optimistic lock
    await supabase
      .from('rate_limits')
      .update({ request_count: currentCount + 1 })
      .eq('key', key)
      .eq('request_count', currentCount);
  }
}

/** Create or reset rate limit record */
async function upsertRateLimitRecord(
  supabase: SupabaseClient,
  key: string,
  now: number,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { error: upsertError } = await supabase
    .from('rate_limits')
    .upsert(
      { key, request_count: 1, window_start: new Date(now).toISOString() },
      { onConflict: 'key', ignoreDuplicates: false }
    );

  if (upsertError) {
    const retryResult = await handleUpsertRetry(supabase, key, now, config);
    if (retryResult) return retryResult;
  }

  return buildResult(true, config.maxRequests - 1, now + config.windowMs);
}

/** Process existing rate limit record */
async function processExistingRecord(
  supabase: SupabaseClient,
  key: string,
  record: { request_count: number; window_start: string },
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const currentCount = record.request_count;
  const windowStartTime = new Date(record.window_start).getTime();
  const resetAt = windowStartTime + config.windowMs;

  if (currentCount >= config.maxRequests) {
    return buildResult(false, 0, resetAt);
  }

  // Atomic increment with optimistic locking
  const { error: updateError } = await supabase
    .from('rate_limits')
    .update({ request_count: currentCount + 1 })
    .eq('key', key)
    .eq('request_count', currentCount);

  if (updateError) {
    console.warn('Rate limit optimistic lock failed, allowing request:', updateError);
  }

  return buildResult(true, config.maxRequests - currentCount - 1, resetAt);
}

/**
 * Check and update rate limit using distributed storage
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const supabase = getSupabaseClient();

  if (!supabase) {
    return checkMemoryRateLimit(key, config, now);
  }

  try {
    // Try RPC-based rate limiting first
    const rpcResult = await tryRpcRateLimit(supabase, key, windowStart, config);
    if (rpcResult) return rpcResult;

    // Fallback to manual check with atomic operations
    const { data: existingRecord, error: selectError } = await supabase
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('key', key)
      .gte('window_start', new Date(windowStart).toISOString())
      .maybeSingle();

    if (selectError) throw selectError;

    if (!existingRecord) {
      return upsertRateLimitRecord(supabase, key, now, config);
    }

    return processExistingRecord(supabase, key, existingRecord, config);
  } catch (dbError) {
    console.warn('Rate limit DB error, falling back to memory:', dbError);
    return checkMemoryRateLimit(key, config, now);
  }
}

/**
 * In-memory rate limiting fallback
 */
function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number
): RateLimitResult {
  let record = memoryStore.get(key);

  if (!record || now >= record.resetAt) {
    record = { count: 1, resetAt: now + config.windowMs };
    memoryStore.set(key, record);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: record.resetAt,
      distributed: false,
    };
  }

  if (record.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      distributed: false,
    };
  }

  record.count++;
  memoryStore.set(key, record);

  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetAt: record.resetAt,
    distributed: false,
  };
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  headers: HeadersInit,
  result: RateLimitResult,
  config: RateLimitConfig
): HeadersInit {
  return {
    ...headers,
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    ...(result.allowed ? {} : { 'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString() }),
  };
}

/**
 * Create rate limit exceeded response
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
  config: RateLimitConfig,
  corsHeaders: HeadersInit
): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'rate_limit_exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retry_after: retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...addRateLimitHeaders({}, result, config),
        'Content-Type': 'application/json',
      },
    }
  );
}

// Pre-configured rate limit profiles
export const RATE_LIMIT_PROFILES = {
  /** Standard API endpoint: 100 requests per minute */
  standard: { maxRequests: 100, windowMs: 60_000, prefix: 'std' },

  /** Sensitive operations: 10 requests per minute */
  sensitive: { maxRequests: 10, windowMs: 60_000, prefix: 'sens' },

  /** AI/LLM endpoints: 20 requests per minute */
  ai: { maxRequests: 20, windowMs: 60_000, prefix: 'ai' },

  /** Authentication: 5 requests per minute */
  auth: { maxRequests: 5, windowMs: 60_000, prefix: 'auth' },

  /** Nonce generation: 5 requests per minute per IP */
  nonce: { maxRequests: 5, windowMs: 60_000, prefix: 'nonce' },

  /** Verification attempts: 10 per hour */
  verify: { maxRequests: 10, windowMs: 3_600_000, prefix: 'verify' },

  /** NFT verification: 30 per minute */
  nftVerify: { maxRequests: 30, windowMs: 60_000, prefix: 'nft' },

  /** File uploads: 20 per minute */
  upload: { maxRequests: 20, windowMs: 60_000, prefix: 'upload' },
} as const;
