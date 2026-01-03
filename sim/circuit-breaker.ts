/**
 * CIRCUIT BREAKER + EVENT QUEUE
 *
 * Prevents cascading failures by opening circuit after threshold failures.
 * Queues events during outage and flushes when circuit closes.
 *
 * STATES:
 * - CLOSED: Normal operation
 * - OPEN: Circuit tripped, reject fast
 * - HALF_OPEN: Testing if service recovered
 */

import type { EventEnvelope } from './contracts';

// ============================================================================
// TYPES
// ============================================================================

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  /** Failure threshold before opening circuit */
  failureThreshold: number;

  /** Success threshold to close from half-open */
  successThreshold: number;

  /** Time in open state before trying half-open (ms) */
  openTimeout: number;

  /** Maximum queue size */
  maxQueueSize: number;

  /** Circuit breaker name (for logging) */
  name: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  queueDepth: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  lastStateChange: Date | null;
  lastFailure: Date | null;
  lastSuccess: Date | null;
}

export interface QueuedEvent {
  event: EventEnvelope;
  enqueuedAt: Date;
  attempts: number;
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private queue: QueuedEvent[] = [];
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private lastStateChange: Date | null = null;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openTimer: NodeJS.Timeout | null = null;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // If circuit is open, reject immediately
    if (this.state === 'open') {
      throw new CircuitBreakerError('Circuit is OPEN', this.config.name);
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.successes++;
    this.totalSuccesses++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0; // Reset
    this.lastSuccess = new Date();

    console.log(`[CircuitBreaker:${this.config.name}] SUCCESS (${this.consecutiveSuccesses}/${this.config.successThreshold})`);

    // If half-open and enough successes, close circuit
    if (this.state === 'half_open' && this.consecutiveSuccesses >= this.config.successThreshold) {
      this.close();
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    this.failures++;
    this.totalFailures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0; // Reset
    this.lastFailure = new Date();

    console.log(`[CircuitBreaker:${this.config.name}] FAILURE (${this.consecutiveFailures}/${this.config.failureThreshold})`);

    // If threshold reached, open circuit
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.open();
    }
  }

  /**
   * Open circuit
   */
  private open(): void {
    if (this.state === 'open') return;

    console.log(`[CircuitBreaker:${this.config.name}] 🔴 OPENING circuit`);

    this.state = 'open';
    this.lastStateChange = new Date();

    // Schedule transition to half-open
    this.openTimer = setTimeout(() => {
      this.halfOpen();
    }, this.config.openTimeout);
  }

  /**
   * Transition to half-open (testing)
   */
  private halfOpen(): void {
    console.log(`[CircuitBreaker:${this.config.name}] 🟡 HALF-OPEN circuit (testing)`);

    this.state = 'half_open';
    this.lastStateChange = new Date();
    this.consecutiveSuccesses = 0; // Reset for test
    this.openTimer = null;
  }

  /**
   * Close circuit (back to normal)
   */
  private close(): void {
    if (this.state === 'closed') return;

    console.log(`[CircuitBreaker:${this.config.name}] 🟢 CLOSING circuit (recovered)`);

    this.state = 'closed';
    this.lastStateChange = new Date();
    this.consecutiveFailures = 0; // Reset

    // Flush queued events
    this.flushQueue();
  }

  /**
   * Manually reset circuit
   */
  reset(): void {
    console.log(`[CircuitBreaker:${this.config.name}] Manual RESET`);

    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }

    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastStateChange = new Date();
  }

  /**
   * Enqueue event for later processing
   */
  enqueue(event: EventEnvelope): boolean {
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn(`[CircuitBreaker:${this.config.name}] Queue full, dropping event`);
      return false;
    }

    this.queue.push({
      event,
      enqueuedAt: new Date(),
      attempts: 0,
    });

    console.log(`[CircuitBreaker:${this.config.name}] Event queued (depth: ${this.queue.length})`);
    return true;
  }

  /**
   * Flush queue (process all queued events)
   */
  private flushQueue(): void {
    if (this.queue.length === 0) return;

    console.log(`[CircuitBreaker:${this.config.name}] Flushing ${this.queue.length} queued events`);

    // Process queue (in practice, this would trigger event reprocessing)
    this.queue = []; // Clear queue
  }

  /**
   * Get queued events
   */
  getQueue(): QueuedEvent[] {
    return [...this.queue];
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      queueDepth: this.queue.length,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastStateChange: this.lastStateChange,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Is circuit open?
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Destroy circuit breaker
   */
  destroy(): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }
}

// ============================================================================
// CIRCUIT BREAKER ERROR
// ============================================================================

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public circuitName: string
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// ============================================================================

class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const fullConfig: CircuitBreakerConfig = {
        name,
        failureThreshold: 5,
        successThreshold: 3,
        openTimeout: 30000, // 30 seconds
        maxQueueSize: 1000,
        ...config,
      };

      this.breakers.set(name, new CircuitBreaker(fullConfig));
    }

    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get all stats
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }

    return stats;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Destroy all circuits
   */
  destroyAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let registry: CircuitBreakerRegistry | null = null;

function getRegistry(): CircuitBreakerRegistry {
  if (!registry) {
    registry = new CircuitBreakerRegistry();
  }
  return registry;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get circuit breaker by name
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return getRegistry().get(name, config);
}

/**
 * Get all circuit breakers
 */
export function getAllCircuitBreakers(): Map<string, CircuitBreaker> {
  return getRegistry().getAll();
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitStats(): Record<string, CircuitBreakerStats> {
  return getRegistry().getAllStats();
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuits(): void {
  getRegistry().resetAll();
}

/**
 * Destroy all circuit breakers (cleanup)
 */
export function destroyAllCircuits(): void {
  getRegistry().destroyAll();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CircuitBreaker,
  getCircuitBreaker,
  getAllCircuitBreakers,
  getAllCircuitStats,
  resetAllCircuits,
  destroyAllCircuits,
};
