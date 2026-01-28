/**
 * OmniSentry - Adaptive, Self-Healing, Ultra-Resilient Monitoring System
 * 
 * Features:
 * - Circuit Breaker Pattern: Prevents cascade failures
 * - Self-Healing: Automatic recovery with exponential backoff
 * - Self-Diagnosing: Health checks and anomaly detection
 * - Atomic Idempotency: Deduplication of error reports
 * - Zero-Maintenance: Autonomous operation
 */

/* eslint-disable no-console */
// Console statements are intentional for monitoring system diagnostics

// ============================================================================
// TYPES
// ============================================================================

export interface SentryConfig {
  /** Maximum errors per minute before circuit opens */
  errorThreshold: number;
  /** Circuit reset timeout in ms */
  circuitResetMs: number;
  /** Retry backoff base in ms */
  retryBaseMs: number;
  /** Max retry attempts */
  maxRetries: number;
  /** Health check interval in ms */
  healthCheckIntervalMs: number;
  /** Error deduplication window in ms */
  dedupeWindowMs: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  metrics: {
    errorRate: number;
    circuitState: 'closed' | 'open' | 'half-open';
    memoryUsage: number;
    uptime: number;
  };
  diagnostics: string[];
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: number;
  lastSuccess: number;
}

interface ErrorFingerprint {
  hash: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: SentryConfig = {
  errorThreshold: 10,
  circuitResetMs: 60_000,
  retryBaseMs: 1_000,
  maxRetries: 3,
  healthCheckIntervalMs: 30_000,
  dedupeWindowMs: 60_000,
};

// ============================================================================
// STATE
// ============================================================================

let config: SentryConfig = { ...DEFAULT_CONFIG };
let circuitBreaker: CircuitBreakerState = {
  state: 'closed',
  failures: 0,
  lastFailure: 0,
  lastSuccess: Date.now(),
};
const errorFingerprints = new Map<string, ErrorFingerprint>();
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let startTime = Date.now();

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate stable hash for error deduplication
 */
function hashError(error: Error, context?: Record<string, unknown>): string {
  const key = `${error.name}:${error.message}:${JSON.stringify(context || {})}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Sleep with exponential backoff
 */
function sleep(attempt: number): Promise<void> {
  const delay = Math.min(config.retryBaseMs * Math.pow(2, attempt), 30_000);
  const jitter = delay * 0.2 * Math.random();
  return new Promise(resolve => setTimeout(resolve, delay + jitter));
}

/**
 * Safely persist to localStorage with fallback
 */
function safePersist(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable - non-fatal
  }
}

/**
 * Safely read from localStorage
 */
function safeRead<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

/**
 * Check if circuit allows operation
 */
function isCircuitClosed(): boolean {
  const now = Date.now();

  if (circuitBreaker.state === 'closed') {
    return true;
  }

  if (circuitBreaker.state === 'open') {
    // Check if reset timeout has passed
    if (now - circuitBreaker.lastFailure >= config.circuitResetMs) {
      circuitBreaker.state = 'half-open';
      return true;
    }
    return false;
  }

  // half-open: allow one test request
  return true;
}

/**
 * Record successful operation
 */
function recordSuccess(): void {
  circuitBreaker.state = 'closed';
  circuitBreaker.failures = 0;
  circuitBreaker.lastSuccess = Date.now();
}

/**
 * Record failed operation
 */
function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();

  if (circuitBreaker.failures >= config.errorThreshold) {
    circuitBreaker.state = 'open';
    console.warn('[OmniSentry] Circuit opened due to error threshold');
  }
}

// ============================================================================
// ERROR DEDUPLICATION
// ============================================================================

/**
 * Check if error should be reported (deduplication)
 */
function shouldReportError(hash: string): boolean {
  const now = Date.now();
  const existing = errorFingerprints.get(hash);

  if (!existing) {
    errorFingerprints.set(hash, {
      hash,
      count: 1,
      firstSeen: now,
      lastSeen: now,
    });
    return true;
  }

  // Check if outside deduplication window
  if (now - existing.lastSeen > config.dedupeWindowMs) {
    existing.count = 1;
    existing.lastSeen = now;
    return true;
  }

  // Within window - increment count but don't report
  existing.count++;
  existing.lastSeen = now;
  return false;
}

/**
 * Clean up stale fingerprints
 */
function cleanupFingerprints(): void {
  const now = Date.now();
  const staleThreshold = config.dedupeWindowMs * 2;

  for (const [hash, fp] of errorFingerprints) {
    if (now - fp.lastSeen > staleThreshold) {
      errorFingerprints.delete(hash);
    }
  }
}

// ============================================================================
// SELF-HEALING RETRY
// ============================================================================

/**
 * Execute operation with automatic retry and circuit breaker
 */
export async function withResilience<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T | null> {
  if (!isCircuitClosed()) {
    console.warn(`[OmniSentry] Circuit open, skipping: ${operationName}`);
    return null;
  }

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const result = await operation();
      recordSuccess();
      return result;
    } catch (error) {
      console.warn(`[OmniSentry] ${operationName} attempt ${attempt + 1} failed:`, error);

      if (attempt < config.maxRetries - 1) {
        await sleep(attempt);
      }
    }
  }

  recordFailure();
  return null;
}

// ============================================================================
// HEALTH DIAGNOSTICS
// ============================================================================

/**
 * Get current health status
 */
export function getHealthStatus(): HealthStatus {
  const now = Date.now();
  const errorRate = circuitBreaker.failures / Math.max(1, (now - circuitBreaker.lastSuccess) / 60_000);
  const memoryUsage = typeof performance !== 'undefined' && 'memory' in performance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (performance as any).memory?.usedJSHeapSize / (performance as any).memory?.jsHeapSizeLimit * 100
    : 0;

  const diagnostics: string[] = [];

  // Memory check
  if (memoryUsage > 80) {
    diagnostics.push('High memory usage detected');
  }

  // Error rate check
  if (errorRate > 5) {
    diagnostics.push('Elevated error rate');
  }

  // Circuit state check
  if (circuitBreaker.state === 'open') {
    diagnostics.push('Circuit breaker is open - system in protective mode');
  }

  // Fingerprint cleanup suggestion
  if (errorFingerprints.size > 100) {
    diagnostics.push('Error fingerprint cache growing - cleanup recommended');
    cleanupFingerprints();
  }

  let status: HealthStatus['status'] = 'healthy';
  if (circuitBreaker.state === 'open' || errorRate > 10) {
    status = 'critical';
  } else if (diagnostics.length > 0) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    metrics: {
      errorRate: Math.round(errorRate * 100) / 100,
      circuitState: circuitBreaker.state,
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      uptime: now - startTime,
    },
    diagnostics,
  };
}

/**
 * Run self-diagnostics and attempt healing
 */
function runSelfDiagnostics(): void {
  const health = getHealthStatus();

  if (health.status === 'critical') {
    console.warn('[OmniSentry] Critical health status - initiating healing');

    // Clean up fingerprints
    cleanupFingerprints();

    // Reset circuit if stuck
    if (circuitBreaker.state === 'open' &&
        Date.now() - circuitBreaker.lastFailure > config.circuitResetMs * 2) {
      circuitBreaker.state = 'half-open';
      console.info('[OmniSentry] Force-reset circuit to half-open');
    }
  }

  // Persist health status for external monitoring
  safePersist('omni_sentry_health', health);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize OmniSentry with optional configuration
 */
export function initializeOmniSentry(customConfig?: Partial<SentryConfig>): void {
  config = { ...DEFAULT_CONFIG, ...customConfig };
  startTime = Date.now();

  // Restore state from persistence
  const savedState = safeRead<Partial<CircuitBreakerState>>('omni_sentry_circuit', {});
  if (savedState.state) {
    circuitBreaker = { ...circuitBreaker, ...savedState };
  }

  // Start health check interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  healthCheckInterval = setInterval(runSelfDiagnostics, config.healthCheckIntervalMs);

  // Run initial diagnostics
  runSelfDiagnostics();

  console.info('[OmniSentry] Initialized with config:', config);
}

/**
 * Report error with deduplication and circuit breaker protection
 */
export async function reportError(
  error: Error,
  context?: Record<string, unknown>
): Promise<void> {
  const hash = hashError(error, context);

  if (!shouldReportError(hash)) {
    return; // Deduplicated
  }

  if (!isCircuitClosed()) {
    // Persist locally when circuit is open
    const offlineErrors = safeRead<unknown[]>('omni_sentry_offline', []);
    offlineErrors.push({
      error: { name: error.name, message: error.message, stack: error.stack },
      context,
      timestamp: new Date().toISOString(),
    });
    safePersist('omni_sentry_offline', offlineErrors.slice(-50));
    return;
  }

  // Log locally
  const entry = {
    error: { name: error.name, message: error.message },
    context,
    timestamp: new Date().toISOString(),
    hash,
  };
  const logs = safeRead<unknown[]>('omni_sentry_errors', []);
  logs.push(entry);
  safePersist('omni_sentry_errors', logs.slice(-100));

  recordSuccess();
}

/**
 * Flush offline errors when circuit recovers
 */
export async function flushOfflineErrors(): Promise<number> {
  const offlineErrors = safeRead<unknown[]>('omni_sentry_offline', []);
  if (offlineErrors.length === 0) return 0;

  let flushed = 0;
  for (const entry of offlineErrors) {
    if (isCircuitClosed()) {
      const logs = safeRead<unknown[]>('omni_sentry_errors', []);
      logs.push(entry);
      safePersist('omni_sentry_errors', logs.slice(-100));
      flushed++;
    }
  }

  if (flushed > 0) {
    safePersist('omni_sentry_offline', []);
    console.info(`[OmniSentry] Flushed ${flushed} offline errors`);
  }

  return flushed;
}

/**
 * Shutdown OmniSentry gracefully
 */
export function shutdownOmniSentry(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Persist final state
  safePersist('omni_sentry_circuit', circuitBreaker);
  console.info('[OmniSentry] Shutdown complete');
}

/**
 * Get configuration (for debugging)
 */
export function getConfig(): SentryConfig {
  return { ...config };
}

/**
 * Get all stored errors (for debugging)
 */
export function getStoredErrors(): unknown[] {
  return safeRead<unknown[]>('omni_sentry_errors', []);
}

/**
 * Clear all stored data
 */
export function clearAllData(): void {
  localStorage.removeItem('omni_sentry_errors');
  localStorage.removeItem('omni_sentry_offline');
  localStorage.removeItem('omni_sentry_health');
  localStorage.removeItem('omni_sentry_circuit');
  errorFingerprints.clear();
  circuitBreaker = {
    state: 'closed',
    failures: 0,
    lastFailure: 0,
    lastSuccess: Date.now(),
  };
  console.info('[OmniSentry] All data cleared');
}
