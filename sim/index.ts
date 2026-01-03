/**
 * CHAOS SIMULATION FRAMEWORK
 *
 * Main exports for programmatic use.
 */

// Core runner
export { SimulationRunner, runSimulation, quickTest } from './runner';
export type { SimulationConfig, Beat, BeatResult, SimulationResult } from './runner';

// Chaos engine
export { ChaosEngine, createChaosEngine, DEFAULT_CHAOS_CONFIG, LIGHT_CHAOS_CONFIG, HEAVY_CHAOS_CONFIG, NO_CHAOS_CONFIG } from './chaos-engine';
export type { ChaosConfig, ChaosDecision, ChaosStats } from './chaos-engine';

// Guard rails
export { checkGuardRails, checkGuardRailsFromEnv, assertGuardRails, isProductionUrl, generateSandboxConfig } from './guard-rails';
export type { GuardRailConfig, GuardRailResult } from './guard-rails';

// Idempotency
export { withIdempotency, executeEventIdempotently, clearAllReceipts, getStats as getIdempotencyStats } from './idempotency';
export type { IdempotencyReceipt, IdempotencyStats } from './idempotency';

// Circuit breaker
export { CircuitBreaker, getCircuitBreaker, getAllCircuitStats, resetAllCircuits } from './circuit-breaker';
export type { CircuitState, CircuitBreakerConfig, CircuitBreakerStats } from './circuit-breaker';

// Metrics
export { MetricsCollector, getMetricsCollector, resetMetrics } from './metrics';
export type { LatencyMetric, LatencyStats, AppMetrics, SystemMetrics, Scorecard } from './metrics';

// Contracts
export * from './contracts';

// Evidence
export { createEvidenceBundle, generateHTMLReport } from './evidence';
export type { EvidenceManifest } from './evidence';
