/**
 * Distributed Rate Limiting for Supabase Edge Functions
 *
 * Uses Upstash Redis REST API for persistent rate limiting across serverless instances.
 * Falls back to fail-open (allow requests + warn) if Upstash is unavailable.
 *
 * Author: OmniLink APEX
 * Date: 2026-01-21
 * Remediation: R3 - In-memory rate limiting replaced with distributed Upstash REST
 */

import { Redis } from "npm:@upstash/redis@1.35.3";
import { Ratelimit } from "npm:@upstash/ratelimit@2.0.8";
import { buildCorsHeaders } from './cors.ts';

export interface RateLimitConfig {
    /** Maximum number of requests allowed in the window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Unique identifier prefix for this rate limit type */
    keyPrefix: string;
}

export interface RateLimitResult {
    /** Whether the request is allowed */
    allowed: boolean;
    /** Maximum number of requests allowed */
    limit: number;
    /** Number of remaining requests in current window */
    remaining: number;
    /** Unix timestamp (ms) when the rate limit resets */
    reset: number;
    /** Milliseconds until rate limit resets */
    resetIn: number;
    /** Headers to include in response */
    headers: Headers;
}

/**
 * Pre-configured rate limit profiles for different use cases
 */
export const RATE_LIMIT_CONFIGS = {
    web3Nonce: { maxRequests: 10, windowMs: 60000, keyPrefix: 'web3-nonce' },
    verifyNft: { maxRequests: 5, windowMs: 60000, keyPrefix: 'verify-nft' },
    web3Verify: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'web3-verify' }, // 10/hour
    alchemyWebhook: { maxRequests: 60, windowMs: 60000, keyPrefix: 'alchemy' },
    healthcheck: { maxRequests: 30, windowMs: 60000, keyPrefix: 'health' },
    storageUploadUrl: { maxRequests: 20, windowMs: 60000, keyPrefix: 'upload' },
    automationExecute: { maxRequests: 100, windowMs: 60000, keyPrefix: 'automation' },
} as const;

// Cache Upstash client and ratelimiter instances at module scope
let redisClient: Redis | null = null;
const ratelimiters = new Map<string, Ratelimit>();

/**
 * Initialize or get cached Redis client
 * Returns null if environment variables are not configured (fail-open mode)
 */
function getRedisClient(): Redis | null {
    if (redisClient) return redisClient;

    const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
    const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

    if (!url || !token) {
        return null;
    }

    try {
        redisClient = new Redis({ url, token });
        return redisClient;
    } catch (error) {
        console.error('Failed to initialize Upstash Redis client:', error);
        return null;
    }
}

/**
 * Get or create a Ratelimit instance for the given config
 */
function getRatelimiter(config: RateLimitConfig): Ratelimit | null {
    const cacheKey = `${config.keyPrefix}:${config.maxRequests}:${config.windowMs}`;

    if (ratelimiters.has(cacheKey)) {
        return ratelimiters.get(cacheKey)!;
    }

    const redis = getRedisClient();
    if (!redis) return null;

    try {
        const limiter = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowMs} ms`),
            prefix: config.keyPrefix,
        });

        ratelimiters.set(cacheKey, limiter);
        return limiter;
    } catch (error) {
        console.error('Failed to create Ratelimit instance:', error);
        return null;
    }
}

/**
 * Normalize identifier for rate limiting
 * @param identifier - Raw identifier (e.g., IP address, user ID)
 * @returns Normalized, safe identifier
 */
function normalizeIdentifier(identifier: string): string {
    const trimmed = identifier?.trim();
    if (!trimmed) return 'anonymous';
    return trimmed;
}

/**
 * Create rate limit headers
 */
function createRateLimitHeaders(result: {
    limit: number;
    remaining: number;
    reset: number;
}): Headers {
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
    headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());

    if (result.remaining <= 0) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        headers.set('Retry-After', retryAfter.toString());
    }

    return headers;
}

/**
 * Check rate limit for a given identifier
 * 
 * FAIL-OPEN BEHAVIOR: If Upstash is not configured or errors occur,
 * this function will return allowed=true and log a warning.
 * 
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @param opts - Optional parameters including clientOverride for testing
 * @returns Rate limit result with allowed status and headers
 */
export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig,
    opts?: {
        clientOverride?: {
            limit: (key: string) => Promise<{
                success: boolean;
                limit: number;
                remaining: number;
                reset: number;
            }>;
        };
    }
): Promise<RateLimitResult> {
    const normalized = normalizeIdentifier(identifier);
    const key = `${config.keyPrefix}:${normalized}`;
    const now = Date.now();

    // Handle test override
    if (opts?.clientOverride) {
        try {
            const result = await opts.clientOverride.limit(key);
            return {
                allowed: result.success,
                limit: result.limit,
                remaining: result.remaining,
                reset: result.reset,
                resetIn: result.reset - now,
                headers: createRateLimitHeaders(result),
            };
        } catch (error) {
            console.error('Rate limit clientOverride error:', error);
            // Fall through to normal behavior
        }
    }

    // Get or create ratelimiter
    const limiter = getRatelimiter(config);

    if (!limiter) {
        // FAIL-OPEN: Upstash not configured or initialization failed
        console.warn(
            `Rate limiting fail-open: Upstash not configured for ${config.keyPrefix}. ` +
            'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable distributed rate limiting.'
        );

        return {
            allowed: true,
            limit: config.maxRequests,
            remaining: config.maxRequests,
            reset: now + config.windowMs,
            resetIn: config.windowMs,
            headers: new Headers(),
        };
    }

    try {
        // Call Upstash rate limiter
        const result = await limiter.limit(key);

        return {
            allowed: result.success,
            limit: result.limit,
            remaining: result.remaining,
            reset: result.reset,
            resetIn: result.reset - now,
            headers: createRateLimitHeaders(result),
        };
    } catch (error) {
        // FAIL-OPEN: Upstash error (network, timeout, etc.)
        console.error(`Rate limiting fail-open: Upstash error for ${config.keyPrefix}:`, error);

        return {
            allowed: true,
            limit: config.maxRequests,
            remaining: config.maxRequests,
            reset: now + config.windowMs,
            resetIn: config.windowMs,
            headers: new Headers(),
        };
    }
}

/**
 * Create a 429 response for rate limit exceeded
 * @param origin - Origin for CORS headers
 * @param result - Rate limit result
 * @returns 429 Response with appropriate headers
 */
export function rateLimitExceededResponse(
    origin: string | null,
    result: RateLimitResult
): Response {
    const retryAfter = Math.ceil(result.resetIn / 1000);
    const corsHeaders = buildCorsHeaders(origin);

    const headers = new Headers(corsHeaders);

    // Add rate limit headers
    result.headers.forEach((value, key) => {
        headers.set(key, value);
    });

    headers.set('Content-Type', 'application/json');

    return new Response(
        JSON.stringify({
            error: 'rate_limit_exceeded',
            message: `Too many requests. Please try again in ${retryAfter} seconds.`,
            retry_after: retryAfter,
        }),
        {
            status: 429,
            headers,
        }
    );
}

/**
 * Add rate limit headers to an existing response
 * @param res - Original response
 * @param result - Rate limit result
 * @returns Cloned response with rate limit headers added
 */
export function addRateLimitHeaders(
    res: Response,
    result: RateLimitResult
): Response {
    const headers = new Headers(res.headers);

    result.headers.forEach((value, key) => {
        headers.set(key, value);
    });

    return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
    });
}
