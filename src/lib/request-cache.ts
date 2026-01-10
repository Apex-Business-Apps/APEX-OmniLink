/**
 * Request deduplication and caching utility
 * Prevents duplicate requests to the same endpoint
 */
import { recordLoopHeartbeat } from '@/guardian/heartbeat';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, PendingRequest<unknown>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Generate cache key from request details
 */
function getCacheKey(url: string, options?: RequestInit): string {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.stringify(options.body) : '';
  return `${method}:${url}:${body}`;
}

/**
 * Clean up expired cache entries and old pending requests
 */
function cleanup(): void {
  try {
    const now = Date.now();
    
    // Clean cache
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key);
      }
    }
    
    // Clean pending requests older than 1 minute
    for (const [key, pending] of pendingRequests.entries()) {
      if (now - pending.timestamp > 60000) {
        pendingRequests.delete(key);
      }
    }

    recordLoopHeartbeat('request-cache-cleanup');
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error in request cache cleanup:', error);
    }
  }
}

/**
 * Initialize cleanup interval
 */
function startCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanup, 60000);
}

/**
 * Stop cleanup interval
 */
export function stopCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Run cleanup every minute
startCleanup();

/**
 * Deduplicated fetch with caching
 */
export async function cachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const key = getCacheKey(url, options);
  const now = Date.now();

  // Check cache first (only for GET requests)
  if ((!options?.method || options.method === 'GET') && cache.has(key)) {
    const entry = cache.get(key)!;
    if (now < entry.expiresAt) {
      return entry.data;
    }
    cache.delete(key);
  }

  // Check for pending request
  if (pendingRequests.has(key)) {
    const pending = pendingRequests.get(key)!;
    return pending.promise;
  }

  // Make new request
  const promise = fetch(url, options)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data: T) => {
      // Cache GET requests
      if (!options?.method || options.method === 'GET') {
        cache.set(key, {
          data,
          timestamp: now,
          expiresAt: now + ttl,
        });
      }
      pendingRequests.delete(key);
      return data;
    })
    .catch((error) => {
      pendingRequests.delete(key);
      throw error;
    });

  pendingRequests.set(key, { promise, timestamp: now });
  return promise;
}

/**
 * Clear cache for specific key or pattern
 */
export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    cacheSize: cache.size,
    pendingRequests: pendingRequests.size,
  };
}
