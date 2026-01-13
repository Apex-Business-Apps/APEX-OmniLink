/**
 * Shared Rate Limiting Utilities for Supabase Edge Functions
 *
 * In-memory rate limiting for edge functions.
 * Note: This resets on cold starts; use Redis for distributed rate limiting.
 */

interface RateLimitRecord {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
}

/**
 * Check rate limit for a given key.
 *
 * @param key - Unique identifier (e.g., `nonce:${ip}` or `verify:${userId}`)
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number
): RateLimitResult {
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now >= record.resetAt) {
        // First request or window expired
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    if (record.count >= maxRequests) {
        // Rate limit exceeded
        return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
    }

    // Increment counter
    record.count++;
    rateLimitStore.set(key, record);

    return {
        allowed: true,
        remaining: maxRequests - record.count,
        resetIn: record.resetAt - now,
    };
}

/**
 * Clear rate limit for a key (useful for testing).
 */
export function clearRateLimit(key: string): void {
    rateLimitStore.delete(key);
}
