/**
 * CHAOS ENGINEERING ENGINE
 *
 * Deterministic chaos injection for testing system resilience.
 * All chaos is seeded for reproducibility.
 *
 * CAPABILITIES:
 * - Duplicate event injection
 * - Out-of-order delivery
 * - Timeout simulation
 * - Network failure simulation
 * - Partial outage simulation
 *
 * DETERMINISM:
 * - Same seed + sequence → same chaos decisions
 * - Reproducible test runs
 */

import type { EventEnvelope, ChaosMetadata } from './contracts';

// ============================================================================
// TYPES
// ============================================================================

export interface ChaosConfig {
  /** Random seed for deterministic chaos */
  seed: number;

  /** Duplicate injection rate (0.0 - 1.0) */
  duplicateRate: number;

  /** Out-of-order delivery rate (0.0 - 1.0) */
  outOfOrderRate: number;

  /** Timeout injection rate (0.0 - 1.0) */
  timeoutRate: number;

  /** Network failure rate (0.0 - 1.0) */
  networkFailureRate: number;

  /** Server error rate (0.0 - 1.0) */
  serverErrorRate: number;

  /** Maximum delay for out-of-order events (ms) */
  maxDelayMs: number;

  /** Timeout duration (ms) */
  timeoutMs: number;

  /** Maximum number of retries allowed */
  maxRetries: number;

  /** Base backoff delay (ms) */
  baseBackoffMs: number;

  /** Target app for partial outage (null = no outage) */
  partialOutageApp?: string;

  /** When partial outage starts (event sequence number) */
  outageStartSeq?: number;

  /** When partial outage ends (event sequence number) */
  outageEndSeq?: number;
}

export interface ChaosDecision {
  /** Should this event be duplicated? */
  shouldDuplicate: boolean;

  /** Should delivery be delayed (out of order)? */
  shouldDelay: boolean;

  /** Delay amount in milliseconds */
  delayMs: number;

  /** Should this event timeout? */
  shouldTimeout: boolean;

  /** Should this event fail with network error? */
  shouldFailNetwork: boolean;

  /** Should this event fail with server error? */
  shouldFailServer: boolean;

  /** Is this app in partial outage? */
  inPartialOutage: boolean;

  /** Metadata to attach to event */
  metadata: ChaosMetadata;
}

export interface ChaosStats {
  totalEvents: number;
  duplicates: number;
  delayed: number;
  timeouts: number;
  networkFailures: number;
  serverErrors: number;
  duplicateRate: number;
  delayRate: number;
  timeoutRate: number;
  networkFailureRate: number;
  serverErrorRate: number;
}

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

/**
 * Simple seeded PRNG for deterministic chaos
 * Using Mulberry32 algorithm
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Generate next random number [0, 1)
   */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer [min, max)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Generate random boolean with probability p
   */
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Reset to initial seed
   */
  reset(seed: number): void {
    this.state = seed;
  }
}

// ============================================================================
// CHAOS ENGINE
// ============================================================================

export class ChaosEngine {
  private config: ChaosConfig;
  private rng: SeededRandom;
  private stats: ChaosStats;
  private eventSequence: number = 0;

  constructor(config: ChaosConfig) {
    this.config = config;
    this.rng = new SeededRandom(config.seed);
    this.stats = {
      totalEvents: 0,
      duplicates: 0,
      delayed: 0,
      timeouts: 0,
      networkFailures: 0,
      serverErrors: 0,
      duplicateRate: 0,
      delayRate: 0,
      timeoutRate: 0,
      networkFailureRate: 0,
      serverErrorRate: 0,
    };
  }

  /**
   * Make chaos decision for event
   */
  decide(event: EventEnvelope, sequenceOverride?: number): ChaosDecision {
    const seq = sequenceOverride ?? this.eventSequence++;
    this.stats.totalEvents++;

    // Check if in partial outage
    const inPartialOutage = this.isInPartialOutage(event.target as string, seq);

    // Make decisions
    const shouldDuplicate = !inPartialOutage && this.rng.nextBool(this.config.duplicateRate);
    const shouldDelay = !inPartialOutage && this.rng.nextBool(this.config.outOfOrderRate);
    const delayMs = shouldDelay ? this.rng.nextInt(0, this.config.maxDelayMs) : 0;
    const shouldTimeout = inPartialOutage || this.rng.nextBool(this.config.timeoutRate);
    const shouldFailNetwork = inPartialOutage || this.rng.nextBool(this.config.networkFailureRate);
    const shouldFailServer = this.rng.nextBool(this.config.serverErrorRate);

    // Update stats
    if (shouldDuplicate) this.stats.duplicates++;
    if (shouldDelay) this.stats.delayed++;
    if (shouldTimeout) this.stats.timeouts++;
    if (shouldFailNetwork) this.stats.networkFailures++;
    if (shouldFailServer) this.stats.serverErrors++;

    // Update rates
    this.updateRates();

    // Build metadata
    const metadata: ChaosMetadata = {
      isDuplicate: shouldDuplicate,
      injectedDelayMs: delayMs,
      outOfOrder: shouldDelay,
      simulatedFailure: shouldTimeout
        ? 'timeout'
        : shouldFailNetwork
          ? 'network'
          : shouldFailServer
            ? 'server'
            : undefined,
    };

    return {
      shouldDuplicate,
      shouldDelay,
      delayMs,
      shouldTimeout,
      shouldFailNetwork,
      shouldFailServer,
      inPartialOutage,
      metadata,
    };
  }

  /**
   * Check if target app is in partial outage
   */
  private isInPartialOutage(targetApp: string | undefined, sequence: number): boolean {
    if (!this.config.partialOutageApp || !targetApp) {
      return false;
    }

    if (targetApp !== this.config.partialOutageApp) {
      return false;
    }

    const start = this.config.outageStartSeq ?? 0;
    const end = this.config.outageEndSeq ?? Infinity;

    return sequence >= start && sequence < end;
  }

  /**
   * Update calculated rates
   */
  private updateRates(): void {
    const total = this.stats.totalEvents;
    if (total === 0) return;

    this.stats.duplicateRate = this.stats.duplicates / total;
    this.stats.delayRate = this.stats.delayed / total;
    this.stats.timeoutRate = this.stats.timeouts / total;
    this.stats.networkFailureRate = this.stats.networkFailures / total;
    this.stats.serverErrorRate = this.stats.serverErrors / total;
  }

  /**
   * Get statistics
   */
  getStats(): ChaosStats {
    return { ...this.stats };
  }

  /**
   * Calculate exponential backoff delay for retry attempt
   */
  calculateBackoff(attempt: number): number {
    const baseDelay = 100; // 100ms base delay
    const maxDelay = 5000; // 5s max delay
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    // Add jitter (±25%)
    const jitter = delay * 0.25 * (this.rng.next() * 2 - 1);

    return Math.round(delay + jitter);
  }

  /**
   * Reset engine (for new run)
   */
  reset(newSeed?: number): void {
    if (newSeed !== undefined) {
      this.config.seed = newSeed;
      this.rng.reset(newSeed);
    }

    this.eventSequence = 0;
    this.stats = {
      totalEvents: 0,
      duplicates: 0,
      delayed: 0,
      timeouts: 0,
      networkFailures: 0,
      serverErrors: 0,
      duplicateRate: 0,
      delayRate: 0,
      timeoutRate: 0,
      networkFailureRate: 0,
      serverErrorRate: 0,
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt: number): number {
    if (attempt >= this.config.maxRetries) {
      return -1; // No more retries
    }

    // Exponential backoff: baseDelay * 2^attempt + jitter
    const exponential = this.config.baseBackoffMs * Math.pow(2, attempt);
    const jitter = this.rng.nextInt(0, this.config.baseBackoffMs);

    return exponential + jitter;
  }

  /**
   * Should retry after failure?
   */
  shouldRetry(attempt: number): boolean {
    return attempt < this.config.maxRetries;
  }

  /**
   * Get current sequence number
   */
  getSequence(): number {
    return this.eventSequence;
  }
}

// ============================================================================
// DEFAULT CONFIGS
// ============================================================================

export const DEFAULT_CHAOS_CONFIG: ChaosConfig = {
  seed: 42,
  duplicateRate: 0.15, // 15% duplicate rate
  outOfOrderRate: 0.10, // 10% out of order
  timeoutRate: 0.05, // 5% timeout rate
  networkFailureRate: 0.03, // 3% network failures
  serverErrorRate: 0.02, // 2% server errors
  maxDelayMs: 5000, // Max 5 second delay
  timeoutMs: 30000, // 30 second timeout
  maxRetries: 2, // Max 2 retries
  baseBackoffMs: 500, // 500ms base backoff
};

export const LIGHT_CHAOS_CONFIG: ChaosConfig = {
  seed: 42,
  duplicateRate: 0.05,
  outOfOrderRate: 0.05,
  timeoutRate: 0.01,
  networkFailureRate: 0.01,
  serverErrorRate: 0.01,
  maxDelayMs: 2000,
  timeoutMs: 30000,
  maxRetries: 2,
  baseBackoffMs: 500,
};

export const HEAVY_CHAOS_CONFIG: ChaosConfig = {
  seed: 42,
  duplicateRate: 0.30, // 30% duplicates
  outOfOrderRate: 0.25, // 25% out of order
  timeoutRate: 0.15, // 15% timeouts
  networkFailureRate: 0.10, // 10% network failures
  serverErrorRate: 0.05, // 5% server errors
  maxDelayMs: 10000, // Max 10 second delay
  timeoutMs: 15000, // 15 second timeout
  maxRetries: 3,
  baseBackoffMs: 1000,
};

export const NO_CHAOS_CONFIG: ChaosConfig = {
  seed: 42,
  duplicateRate: 0,
  outOfOrderRate: 0,
  timeoutRate: 0,
  networkFailureRate: 0,
  serverErrorRate: 0,
  maxDelayMs: 0,
  timeoutMs: 30000,
  maxRetries: 0,
  baseBackoffMs: 500,
};

// ============================================================================
// FACTORY
// ============================================================================

export function createChaosEngine(config: Partial<ChaosConfig> = {}): ChaosEngine {
  return new ChaosEngine({
    ...DEFAULT_CHAOS_CONFIG,
    ...config,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Inject chaos metadata into event
 */
export function injectChaos<T>(event: EventEnvelope<T>, metadata: ChaosMetadata): EventEnvelope<T> {
  return {
    ...event,
    chaos: {
      ...event.chaos,
      ...metadata,
    },
  };
}

/**
 * Create duplicate event
 */
export function createDuplicate<T>(event: EventEnvelope<T>): EventEnvelope<T> {
  return {
    ...event,
    eventId: crypto.randomUUID(), // New event ID
    chaos: {
      ...event.chaos,
      isDuplicate: true,
    },
  };
}

/**
 * Simulate delay
 */
export async function simulateDelay(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulate failure
 */
export class ChaosError extends Error {
  constructor(
    public type: 'timeout' | 'network' | 'server' | 'validation',
    message: string
  ) {
    super(message);
    this.name = 'ChaosError';
  }
}

export function simulateFailure(type: 'timeout' | 'network' | 'server'): never {
  switch (type) {
    case 'timeout':
      throw new ChaosError('timeout', 'Simulated timeout error');
    case 'network':
      throw new ChaosError('network', 'Simulated network error');
    case 'server':
      throw new ChaosError('server', 'Simulated server error (500)');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ChaosEngine,
  createChaosEngine,
  DEFAULT_CHAOS_CONFIG,
  LIGHT_CHAOS_CONFIG,
  HEAVY_CHAOS_CONFIG,
  NO_CHAOS_CONFIG,
  injectChaos,
  createDuplicate,
  simulateDelay,
  simulateFailure,
  ChaosError,
};
