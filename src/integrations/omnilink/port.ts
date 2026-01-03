import { calculateBackoffDelay } from '@/lib/backoff';
import { recordAuditEvent } from '@/security/auditLog';
import type { OmniLinkAdapter, OmniLinkHealth, OmniLinkRequestOptions } from './types';

const DEFAULTS = {
  enabled: false,
  baseUrl: '',
  healthPath: '/health',
  timeoutMs: 10_000,
  maxAttempts: 3,
  baseDelayMs: 400,
  maxDelayMs: 4_000,
  jitterMs: 250,
  circuitBreakerThreshold: 3,
  circuitBreakerCooldownMs: 30_000,
  dedupeTtlMs: 60_000,
};

type CircuitState = {
  failures: number;
  openedAt?: number;
};

const circuitState: CircuitState = {
  failures: 0,
};

const inflight = new Map<string, Promise<unknown>>();
const dedupeIndex = new Map<string, number>();
let lastError: string | null = null;

function getEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  return (import.meta as any)?.env?.[name];
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = getEnv(name);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function readNumber(name: string, fallback: number): number {
  const value = getEnv(name);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readConfig() {
  const enabled = readBoolean('VITE_OMNILINK_ENABLED', DEFAULTS.enabled)
    || readBoolean('OMNILINK_ENABLED', DEFAULTS.enabled);
  const baseUrl =
    getEnv('VITE_OMNILINK_BASE_URL') ||
    getEnv('OMNILINK_BASE_URL') ||
    DEFAULTS.baseUrl;
  return {
    enabled,
    baseUrl,
    healthPath: getEnv('VITE_OMNILINK_HEALTH_PATH') || getEnv('OMNILINK_HEALTH_PATH') || DEFAULTS.healthPath,
    timeoutMs: readNumber('VITE_OMNILINK_TIMEOUT_MS', DEFAULTS.timeoutMs),
    maxAttempts: readNumber('VITE_OMNILINK_MAX_ATTEMPTS', DEFAULTS.maxAttempts),
    baseDelayMs: readNumber('VITE_OMNILINK_RETRY_BASE_MS', DEFAULTS.baseDelayMs),
    maxDelayMs: readNumber('VITE_OMNILINK_RETRY_MAX_MS', DEFAULTS.maxDelayMs),
    jitterMs: readNumber('VITE_OMNILINK_RETRY_JITTER_MS', DEFAULTS.jitterMs),
    circuitBreakerThreshold: readNumber('VITE_OMNILINK_CIRCUIT_THRESHOLD', DEFAULTS.circuitBreakerThreshold),
    circuitBreakerCooldownMs: readNumber('VITE_OMNILINK_CIRCUIT_COOLDOWN_MS', DEFAULTS.circuitBreakerCooldownMs),
    dedupeTtlMs: readNumber('VITE_OMNILINK_DEDUPE_TTL_MS', DEFAULTS.dedupeTtlMs),
  };
}

function isCircuitOpen(): boolean {
  if (!circuitState.openedAt) return false;
  const elapsed = Date.now() - circuitState.openedAt;
  if (elapsed >= readConfig().circuitBreakerCooldownMs) {
    circuitState.openedAt = undefined;
    circuitState.failures = 0;
    return false;
  }
  return true;
}

function recordFailure(reason: string) {
  circuitState.failures += 1;
  lastError = reason;
  if (circuitState.failures >= readConfig().circuitBreakerThreshold) {
    circuitState.openedAt = Date.now();
  }
  if (typeof window !== 'undefined') {
    recordAuditEvent({
      actionType: 'omnilink.port.failure',
      resourceType: 'omnilink',
      metadata: { reason },
    });
  }
}

function recordSuccess() {
  circuitState.failures = 0;
  lastError = null;
}

function cleanupDedupe(ttlMs: number) {
  const now = Date.now();
  for (const [key, timestamp] of dedupeIndex.entries()) {
    if (now - timestamp > ttlMs) {
      dedupeIndex.delete(key);
    }
  }
}

function getIdempotencyKey(options: OmniLinkRequestOptions): string {
  if (options.idempotencyKey) return options.idempotencyKey;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `omnilink_${Math.random().toString(36).slice(2)}`;
}

async function requestWithRetries<T>(options: OmniLinkRequestOptions): Promise<T> {
  const config = readConfig();
  const attemptLimit = options.method === 'GET' ? config.maxAttempts : config.maxAttempts;
  let attempt = 0;
  let lastFailure: Error | null = null;

  while (attempt < attemptLimit) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? config.timeoutMs);
    try {
      const response = await fetch(`${config.baseUrl}${options.path}`, {
        method: options.method ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': getIdempotencyKey(options),
          'X-OmniLink-Trace-Id': typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : `trace_${Date.now()}`,
          ...(options.headers ?? {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`OmniLink request failed (${response.status}): ${text}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return (await response.text()) as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastFailure = err;
      if (err.name === 'AbortError') {
        lastFailure = new Error(`OmniLink request timed out after ${options.timeoutMs ?? config.timeoutMs}ms`);
      }
      if (attempt >= attemptLimit) break;
      const delay = calculateBackoffDelay(attempt, {
        baseMs: config.baseDelayMs,
        maxMs: config.maxDelayMs,
        jitterMs: config.jitterMs,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastFailure ?? new Error('OmniLink request failed');
}

class HttpOmniLinkAdapter implements OmniLinkAdapter {
  async request<T = unknown>(options: OmniLinkRequestOptions): Promise<T> {
    const config = readConfig();
    if (!config.enabled || !config.baseUrl) {
      recordFailure('OmniLink is disabled or misconfigured');
      throw new Error('OmniLink disabled');
    }
    if (isCircuitOpen()) {
      recordFailure('Circuit breaker open');
      throw new Error('OmniLink circuit breaker open');
    }

    const idempotencyKey = getIdempotencyKey(options);
    const dedupeTtlMs = options.dedupeTtlMs ?? config.dedupeTtlMs;
    cleanupDedupe(dedupeTtlMs);
    if (dedupeIndex.has(idempotencyKey)) {
      recordFailure('Duplicate idempotency key detected');
      throw new Error('Duplicate OmniLink request blocked by idempotency policy');
    }

    if (inflight.has(idempotencyKey)) {
      return inflight.get(idempotencyKey) as Promise<T>;
    }

    const promise = requestWithRetries<T>({ ...options, idempotencyKey })
      .then((result) => {
        dedupeIndex.set(idempotencyKey, Date.now());
        recordSuccess();
        if (typeof window !== 'undefined') {
          recordAuditEvent({
            actionType: 'omnilink.port.request',
            resourceType: 'omnilink',
            metadata: { path: options.path, method: options.method ?? 'POST' },
          });
        }
        return result;
      })
      .catch((error) => {
        recordFailure(error instanceof Error ? error.message : 'OmniLink request failed');
        throw error;
      })
      .finally(() => {
        inflight.delete(idempotencyKey);
      });

    inflight.set(idempotencyKey, promise);
    return promise;
  }

  async health(): Promise<OmniLinkHealth> {
    const config = readConfig();
    if (!config.enabled || !config.baseUrl) {
      lastError = 'OmniLink disabled';
      return {
        status: 'disabled',
        checkedAt: new Date().toISOString(),
        lastError,
      };
    }

    try {
      await this.request({
        path: config.healthPath,
        method: 'GET',
        timeoutMs: Math.min(config.timeoutMs, 5_000),
      });
      return {
        status: 'ok',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'OmniLink health check failed';
      lastError = reason;
      return {
        status: 'error',
        checkedAt: new Date().toISOString(),
        lastError: reason,
      };
    }
  }
}

class NoopOmniLinkAdapter implements OmniLinkAdapter {
  async request<T = unknown>(): Promise<T> {
    lastError = 'OmniLink disabled';
    if (typeof window !== 'undefined') {
      recordAuditEvent({
        actionType: 'omnilink.port.disabled',
        resourceType: 'omnilink',
        metadata: { reason: lastError },
      });
    }
    throw new Error('OmniLink disabled');
  }

  async health(): Promise<OmniLinkHealth> {
    lastError = 'OmniLink disabled';
    return {
      status: 'disabled',
      checkedAt: new Date().toISOString(),
      lastError,
    };
  }
}

let adapter: OmniLinkAdapter = new HttpOmniLinkAdapter();

export function setOmniLinkAdapter(next: OmniLinkAdapter): void {
  adapter = next;
}

export function getOmniLinkAdapter(): OmniLinkAdapter {
  const config = readConfig();
  if (!config.enabled || !config.baseUrl) {
    return new NoopOmniLinkAdapter();
  }
  return adapter;
}

export async function requestOmniLink<T = unknown>(options: OmniLinkRequestOptions): Promise<T> {
  return getOmniLinkAdapter().request<T>(options);
}

export async function getOmniLinkHealth(): Promise<OmniLinkHealth> {
  return getOmniLinkAdapter().health();
}

export function getOmniLinkLastError(): string | null {
  return lastError;
}
