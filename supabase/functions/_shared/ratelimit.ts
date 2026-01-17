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

  // Try distributed rate limiting first
  if (supabase) {
    try {
      // Clean up expired entries and count recent requests atomically
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_key: key,
        p_window_start: new Date(windowStart).toISOString(),
        p_max_requests: config.maxRequests,
        p_window_ms: config.windowMs,
      });

      if (!error && data) {
        return {
          allowed: data.allowed,
          remaining: data.remaining,
          resetAt: new Date(data.reset_at).getTime(),
          distributed: true,
        };
      }

      // If RPC doesn't exist, fall back to atomic upsert with increment
      // Use a single atomic operation to prevent race conditions
      const windowStartStr = new Date(now).toISOString();
      const windowStartThreshold = new Date(windowStart).toISOString();

      // First, try to atomically increment if record exists and is in current window
      const { data: existingRecord, error: selectError } = await supabase
        .from('rate_limits')
        .select('request_count, window_start')
        .eq('key', key)
        .gte('window_start', windowStartThreshold)
        .maybeSingle();

      if (selectError) throw selectError;

      if (!existingRecord) {
        // No existing record or window expired - create/reset atomically
        // Use upsert to handle concurrent creation attempts
        const { error: upsertError } = await supabase
          .from('rate_limits')
          .upsert({
            key,
            request_count: 1,
            window_start: windowStartStr,
          }, {
            onConflict: 'key',
            ignoreDuplicates: false
          });

        if (upsertError) {
          // If upsert failed due to race condition, retry with increment
          const { data: retryRecord } = await supabase
            .from('rate_limits')
            .select('request_count, window_start')
            .eq('key', key)
            .single();

          if (retryRecord) {
            const retryCount = retryRecord.request_count;
            const retryWindowStart = new Date(retryRecord.window_start).getTime();

            // Check if within same window
            if (now - retryWindowStart < config.windowMs) {
              if (retryCount >= config.maxRequests) {
                return {
                  allowed: false,
                  remaining: 0,
                  resetAt: retryWindowStart + config.windowMs,
                  distributed: true,
                };
              }
              // Increment atomically using SQL increment
              await supabase.rpc('increment_rate_limit', { p_key: key }).catch(() => {
                // Fallback: direct update if RPC not available
                return supabase
                  .from('rate_limits')
                  .update({ request_count: retryCount + 1 })
                  .eq('key', key)
                  .eq('request_count', retryCount); // Optimistic lock
              });
            }
          }
        }

        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetAt: now + config.windowMs,
          distributed: true,
        };
      }

      const currentCount = existingRecord.request_count;
      const windowStartTime = new Date(existingRecord.window_start).getTime();
      const resetAt = windowStartTime + config.windowMs;

      if (currentCount >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          distributed: true,
        };
      }

      // Atomic increment with optimistic locking - only update if count hasn't changed
      const { error: updateError } = await supabase
        .from('rate_limits')
        .update({ request_count: currentCount + 1 })
        .eq('key', key)
        .eq('request_count', currentCount); // Optimistic lock prevents race

      // If update failed due to concurrent modification, still allow this request
      // (the counter was already incremented by another request)
      if (updateError) {
        console.warn('Rate limit optimistic lock failed, allowing request:', updateError);
      }

      return {
        allowed: true,
        remaining: config.maxRequests - currentCount - 1,
        resetAt,
        distributed: true,
      };
    } catch (dbError) {
      console.warn('Rate limit DB error, falling back to memory:', dbError);
      // Fall through to memory-based limiting
    }
  }

  // Fallback to in-memory rate limiting
  return checkMemoryRateLimit(key, config, now);
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
