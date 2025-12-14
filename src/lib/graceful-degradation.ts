/**
 * Graceful degradation utilities for production resilience
 */

import { logError, logAnalyticsEvent } from './monitoring';

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logError(lastError!, { action: 'retry_exhausted', metadata: { maxRetries } });
  throw lastError!;
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
  );
  
  return Promise.race([promise, timeout]);
}

/**
 * Safe JSON parse with fallback
 */
export function safeParse<T>(
  json: string,
  fallback: T
): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    logError(error as Error, { action: 'json_parse_failed' });
    return fallback;
  }
}

/**
 * Execute function with fallback
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    logError(error as Error, { action: 'using_fallback' });
    return await fallback();
  }
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      logError(
        new Error('Circuit breaker opened'),
        { metadata: { failures: this.failures } }
      );
    }
  }
  
  getState(): string {
    return this.state;
  }
  
  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

/**
 * Resource loader with fallback
 */
export async function loadResourceWithFallback(
  primaryUrl: string,
  fallbackUrl?: string
): Promise<Response> {
  try {
    const response = await fetch(primaryUrl);
    if (!response.ok) throw new Error('Primary resource load failed');
    return response;
  } catch (error) {
    if (fallbackUrl) {
      logError(error as Error, { action: 'loading_fallback_resource' });
      return fetch(fallbackUrl);
    }
    throw error;
  }
}

/**
 * Degraded mode checker
 */
export class ServiceHealthChecker {
  private services = new Map<string, boolean>();
  
  markServiceDown(service: string): void {
    this.services.set(service, false);
    void logAnalyticsEvent('service.degraded', { service });
  }
  
  markServiceUp(service: string): void {
    this.services.set(service, true);
    void logAnalyticsEvent('service.restored', { service });
  }
  
  isServiceHealthy(service: string): boolean {
    return this.services.get(service) ?? true;
  }
  
  getAllServices(): Map<string, boolean> {
    return new Map(this.services);
  }
  
  isAnyServiceDown(): boolean {
    return Array.from(this.services.values()).some(healthy => !healthy);
  }
}

export const serviceHealth = new ServiceHealthChecker();
