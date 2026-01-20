/**
 * Shared rate limiting utilities for Supabase Edge Functions
 *
 * Provides standardized rate limiting with in-memory storage
 * to eliminate duplication across functions.
 *
 * Author: OmniLink APEX
 * Date: 2026-01-19
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// In-memory rate limit store (resets on cold start)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for a given key
 * @param key - Unique identifier for the rate limit (e.g., userId, ip)
 * @param config - Rate limiting configuration
 * @returns Rate limit check result
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetAt) {
    // First request or window expired - create new record
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs
    };
  }

  if (record.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetIn: record.resetAt - now
    };
  }

  // Increment counter
  record.count++;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetIn: record.resetAt - now
  };
}

/**
 * Create rate limit exceeded response
 * @param resetIn - Seconds until reset
 * @param message - Custom message (optional)
 * @returns Response object
 */
export function createRateLimitResponse(resetIn: number, message?: string) {
  const retryAfter = Math.ceil(resetIn / 1000);
  return new Response(
    JSON.stringify({
      error: 'rate_limit_exceeded',
      message: message || `Too many requests. Try again in ${retryAfter} seconds.`,
      retry_after: retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + resetIn).toISOString(),
      },
    }
  );
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  WEB3_VERIFY: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  WEB3_NONCE: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
  NFT_VERIFY: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
  AUTOMATION_EXECUTE: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
  INTEGRATION_TEST: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
} as const;
