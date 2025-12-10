/**
 * Shared rate limiting utility for Supabase Edge Functions
 * Production-grade rate limiting with automatic cleanup
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Rate limiter class for managing request limits
 */
export class RateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();
  private config: RateLimitConfig;
  private cleanupInterval: number;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Clean up expired rate limit records
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Check if request is allowed and update counter
   */
  check(identifier: string): RateLimitResult {
    const now = Date.now();
    let record = this.store.get(identifier);

    // Initialize or reset if window expired
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + this.config.windowMs };
    }

    // Check if limit exceeded
    if (record.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetTime
      };
    }

    // Increment counter
    record.count++;
    this.store.set(identifier, record);

    return {
      allowed: true,
      remaining: this.config.maxRequests - record.count,
      resetAt: record.resetTime
    };
  }

  /**
   * Get rate limit headers for HTTP response
   */
  getHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    };

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      headers['Retry-After'] = retryAfter.toString();
    }

    return headers;
  }

  /**
   * Destroy rate limiter and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Expensive AI endpoints - 5 requests per minute
  AI_EXPENSIVE: { maxRequests: 5, windowMs: 60000 },

  // Standard AI endpoints - 10 requests per minute
  AI_STANDARD: { maxRequests: 10, windowMs: 60000 },

  // Voice/Realtime - 10 requests per minute
  AI_VOICE: { maxRequests: 10, windowMs: 60000 },

  // Standard API - 20 requests per minute
  API_STANDARD: { maxRequests: 20, windowMs: 60000 },

  // Health checks - 10 requests per minute
  HEALTH_CHECK: { maxRequests: 10, windowMs: 60000 },
};
