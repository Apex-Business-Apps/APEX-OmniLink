/**
 * CHAOS SIMULATION RUNNER
 *
 * Main orchestration engine for deterministic chaos testing.
 * Executes story beats, injects chaos, tracks metrics, generates scorecards.
 *
 * USAGE:
 *   const runner = new SimulationRunner(config);
 *   const result = await runner.run();
 */

import { assertGuardRails } from './guard-rails';
import {
  ChaosEngine,
  type ChaosConfig,
  type ChaosDecision,
  type ChaosStats,
  DEFAULT_CHAOS_CONFIG,
} from './chaos-engine';
import {
  getCircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  getAllCircuitStats,
} from './circuit-breaker';
import {
  executeEventIdempotently,
  clearAllReceipts,
  type IdempotencyStats,
  getStats as getIdempotencyStats,
} from './idempotency';
import { MetricsCollector, type Scorecard } from './metrics';
import type { EventEnvelope, AppName, EventType } from './contracts';
import { createEvent, type CallCompletedPayload } from './contracts';

// ============================================================================
// TYPES
// ============================================================================

export interface SimulationConfig {
  /** Unique run ID */
  runId?: string;

  /** Scenario name */
  scenario: string;

  /** Tenant ID (SANDBOX_TENANT) */
  tenantId: string;

  /** Random seed for determinism */
  seed: number;

  /** Chaos configuration */
  chaos: ChaosConfig;

  /** Story beats to execute */
  beats: Beat[];

  /** Circuit breaker config (per app) */
  circuitBreakers?: Record<string, Partial<CircuitBreakerConfig>>;

  /** Dry run mode (no real API calls) */
  dryRun?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

export interface Beat {
  /** Beat number (sequence) */
  number: number;

  /** Beat name/description */
  name: string;

  /** Source app */
  app: AppName;

  /** Event type */
  eventType: EventType;

  /** Event payload */
  payload: unknown;

  /** Target app(s) (null = broadcast) */
  target?: AppName | AppName[];

  /** Expected outcome */
  expectedOutcome: string;

  /** Observability proof (what to check) */
  observability: string;
}

export interface BeatResult {
  beat: Beat;
  success: boolean;
  latencyMs: number;
  retries: number;
  wasCached: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SimulationResult {
  runId: string;
  scenario: string;
  tenantId: string;
  seed: number;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  beats: BeatResult[];
  scorecard: Scorecard;
  chaosStats: ChaosStats;
  idempotencyStats: IdempotencyStats;
  circuitStats: Record<string, CircuitBreakerStats>;
  logs: string[];
  passed: boolean;
}

// ============================================================================
// SIMULATION RUNNER
// ============================================================================

export class SimulationRunner {
  private config: SimulationConfig;
  private chaos: ChaosEngine;
  private metrics: MetricsCollector;
  private logs: string[] = [];
  private startTime: Date | null = null;

  constructor(config: SimulationConfig) {
    this.config = {
      runId: crypto.randomUUID(),
      dryRun: false,
      verbose: false,
      ...config,
    };

    this.chaos = new ChaosEngine(this.config.chaos);
    this.metrics = new MetricsCollector();
  }

  /**
   * Run simulation
   */
  async run(): Promise<SimulationResult> {
    this.log('╔════════════════════════════════════════════════════════════════╗');
    this.log('║            CHAOS SIMULATION - AUTONOMOUS ISOLATION             ║');
    this.log('╚════════════════════════════════════════════════════════════════╝');
    this.log('');

    // STEP 1: Guard Rails
    this.log('🛡️  STEP 1: Guard Rails Check');
    try {
      assertGuardRails();
      this.log('✅ Guard rails PASSED - safe to proceed\n');
    } catch (error) {
      this.log(`❌ Guard rails FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }

    // STEP 2: Initialize
    this.log('🔧 STEP 2: Initialize Components');
    this.log(`   Run ID: ${this.config.runId}`);
    this.log(`   Scenario: ${this.config.scenario}`);
    this.log(`   Tenant: ${this.config.tenantId}`);
    this.log(`   Seed: ${this.config.seed}`);
    this.log(`   Beats: ${this.config.beats.length}`);
    this.log(`   Dry Run: ${this.config.dryRun ? 'YES' : 'NO'}\n`);

    this.startTime = new Date();
    clearAllReceipts(); // Clear previous run
    this.chaos.reset(this.config.seed); // Reset with seed

    // STEP 3: Execute Beats
    this.log('🎬 STEP 3: Execute Story Beats');
    this.log('═'.repeat(64));

    const beatResults: BeatResult[] = [];

    for (const beat of this.config.beats) {
      const result = await this.executeBeat(beat);
      beatResults.push(result);

      this.log(`${result.success ? '✅' : '❌'} Beat ${beat.number}: ${beat.name} (${result.latencyMs}ms)`);
      if (result.wasCached) {
        this.log(`   ♻️  Deduplicated (idempotency hit)`);
      }
      if (result.retries > 0) {
        this.log(`   🔄 Retried ${result.retries} time(s)`);
      }
      if (result.error) {
        this.log(`   ⚠️  Error: ${result.error}`);
      }
    }

    this.log('');

    // STEP 4: Generate Results
    this.log('📊 STEP 4: Generate Results & Scorecard');

    this.metrics.finish();

    const endTime = new Date();
    const durationMs = endTime.getTime() - this.startTime.getTime();

    const scorecard = this.metrics.generateScorecard(
      this.config.runId!,
      this.config.scenario,
      this.config.tenantId,
      this.config.seed,
      0, // Queue depth (would come from circuit breakers)
      this.getCircuitStates()
    );

    const result: SimulationResult = {
      runId: this.config.runId!,
      scenario: this.config.scenario,
      tenantId: this.config.tenantId,
      seed: this.config.seed,
      startedAt: this.startTime,
      completedAt: endTime,
      durationMs,
      beats: beatResults,
      scorecard,
      chaosStats: this.chaos.getStats(),
      idempotencyStats: getIdempotencyStats(),
      circuitStats: getAllCircuitStats(),
      logs: [...this.logs],
      passed: scorecard.passed,
    };

    // Print summary
    this.printSummary(result);

    return result;
  }

  /**
   * Execute single beat
   */
  private async executeBeat(beat: Beat): Promise<BeatResult> {
    const startTime = Date.now();
    let retries = 0;
    let wasCached = false;
    let lastError: string | undefined;
    const maxRetries = this.config.chaos.maxRetries || 2;

    // Create event ONCE (outside retry loop)
    const event = createEvent(this.config.tenantId, beat.eventType)
      .correlationId(this.config.runId!)
      .idempotencyKey(`${this.config.tenantId}-${beat.eventType}-${Date.now()}-${beat.number}`)
      .source(beat.app)
      .target(beat.target || 'omnihub')
      .payload(beat.payload)
      .build();

    // Make chaos decision ONCE (outside retry loop)
    // Retries should NOT get new chaos injections
    const chaosDecision = this.chaos.decide(event, beat.number);

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {

        // Execute with idempotency
        // Only apply chaos on first attempt - retries should be clean
        const { wasCached: cached, attemptCount: _attemptCount } = await executeEventIdempotently(
          event,
          async (evt) => {
            return await this.executeEvent(evt, beat, chaosDecision, attempt);
          }
        );

        wasCached = cached;
        retries = attempt;

        const latencyMs = Date.now() - startTime;

        // Record metrics
        this.metrics.recordLatency(
          `${beat.app}:${beat.eventType}`,
          latencyMs,
          true,
          retries
        );

        this.metrics.recordAppEvent(beat.app, true, retries > 0, wasCached);

        return {
          beat,
          success: true,
          latencyMs,
          retries,
          wasCached,
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        retries = attempt;

        // If this is the last attempt, fail
        if (attempt >= maxRetries) {
          const latencyMs = Date.now() - startTime;

          this.metrics.recordLatency(
            `${beat.app}:${beat.eventType}`,
            latencyMs,
            false,
            retries
          );

          this.metrics.recordAppEvent(beat.app, false, retries > 0, false);

          return {
            beat,
            success: false,
            latencyMs,
            retries,
            wasCached,
            error: lastError,
          };
        }

        // Exponential backoff before retry
        const backoffMs = this.chaos.calculateBackoff(attempt);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // Should never reach here, but TypeScript needs this
    const latencyMs = Date.now() - startTime;
    return {
      beat,
      success: false,
      latencyMs,
      retries,
      wasCached,
      error: lastError || 'Max retries exceeded',
    };
  }

  /**
   * Execute event with chaos and circuit breakers
   */
  private async executeEvent(
    event: EventEnvelope,
    beat: Beat,
    chaosDecision: ChaosDecision,
    attempt: number = 0
  ): Promise<Record<string, unknown>> {
    // Get circuit breaker for target app
    const targetApp = Array.isArray(beat.target) ? beat.target[0] : (beat.target || 'omnihub');
    const circuitName = `circuit:${targetApp}`;
    const circuit = getCircuitBreaker(circuitName, this.config.circuitBreakers?.[targetApp]);

    // Execute through circuit breaker
    return await circuit.execute(async () => {
      // Only apply chaos on first attempt (retries should be clean)
      const shouldApplyChaos = attempt === 0;

      // Simulate delay if chaos says so (only on first attempt)
      if (shouldApplyChaos && chaosDecision.shouldDelay && chaosDecision.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, chaosDecision.delayMs));
      }

      // Simulate failures (only on first attempt)
      if (shouldApplyChaos && chaosDecision.shouldTimeout) {
        throw new Error('Simulated timeout');
      }

      if (shouldApplyChaos && chaosDecision.shouldFailNetwork) {
        throw new Error('Simulated network failure');
      }

      if (shouldApplyChaos && chaosDecision.shouldFailServer) {
        throw new Error('Simulated server error (500)');
      }

      // Execute actual operation
      if (this.config.dryRun) {
        return { status: 'ok', dryRun: true };
      }

      // Call app adapter (stubbed for now)
      return await this.callAppAdapter(beat.app, event);
    });
  }

  /**
   * Call app adapter (stub - would call real adapters)
   */
  private async callAppAdapter(app: AppName, event: EventEnvelope): Promise<Record<string, unknown>> {
    // Simulate network delay
    const delay = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Return mock response
    return {
      app,
      eventId: event.eventId,
      status: 'processed',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get circuit breaker states
   */
  private getCircuitStates(): Record<string, string> {
    const stats = getAllCircuitStats();
    const states: Record<string, string> = {};

    for (const [name, stat] of Object.entries(stats)) {
      states[name] = stat.state;
    }

    return states;
  }

  /**
   * Print summary
   */
  private printSummary(result: SimulationResult): void {
    this.log('\n╔════════════════════════════════════════════════════════════════╗');
    this.log('║                      SIMULATION SUMMARY                        ║');
    this.log('╚════════════════════════════════════════════════════════════════╝\n');

    this.log(`⏱️  Duration: ${result.durationMs}ms`);
    this.log(`📋 Beats Executed: ${result.beats.length}`);
    this.log(`✅ Successes: ${result.beats.filter(b => b.success).length}`);
    this.log(`❌ Failures: ${result.beats.filter(b => !b.success).length}`);
    this.log(`🔄 Total Retries: ${result.beats.reduce((sum, b) => sum + b.retries, 0)}`);
    this.log(`♻️  Dedupes: ${result.beats.filter(b => b.wasCached).length}`);
    this.log('');

    this.log('📈 Chaos Stats:');
    this.log(`   Duplicates: ${result.chaosStats.duplicates} (${(result.chaosStats.duplicateRate * 100).toFixed(1)}%)`);
    this.log(`   Delays: ${result.chaosStats.delayed} (${(result.chaosStats.delayRate * 100).toFixed(1)}%)`);
    this.log(`   Timeouts: ${result.chaosStats.timeouts} (${(result.chaosStats.timeoutRate * 100).toFixed(1)}%)`);
    this.log(`   Network Failures: ${result.chaosStats.networkFailures} (${(result.chaosStats.networkFailureRate * 100).toFixed(1)}%)`);
    this.log('');

    this.log('🏆 Scorecard:');
    this.log(`   Overall Score: ${result.scorecard.overallScore.toFixed(1)}/100`);
    this.log(`   Required Score: ${result.scorecard.requiredScore}/100`);
    this.log(`   Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    this.log('');

    if (result.scorecard.issues.length > 0) {
      this.log('⚠️  Issues:');
      result.scorecard.issues.forEach((issue: string) => this.log(`   - ${issue}`));
      this.log('');
    }

    if (result.scorecard.warnings.length > 0) {
      this.log('⚠️  Warnings:');
      result.scorecard.warnings.forEach((warning: string) => this.log(`   - ${warning}`));
      this.log('');
    }

    this.log(`📄 Run ID: ${result.runId}`);
    this.log(`💾 Evidence: evidence/${result.runId}.json\n`);
  }

  /**
   * Log message
   */
  private log(message: string): void {
    this.logs.push(message);
    if (this.config.verbose !== false) {
      console.log(message);
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Run simulation with config
 */
export async function runSimulation(config: SimulationConfig): Promise<SimulationResult> {
  const runner = new SimulationRunner(config);
  return await runner.run();
}

/**
 * Quick test run (minimal beats, light chaos)
 */
export async function quickTest(scenario: string = 'Quick Test'): Promise<SimulationResult> {
  return await runSimulation({
    scenario,
    tenantId: 'sandbox-test',
    seed: 42,
    chaos: {
      ...DEFAULT_CHAOS_CONFIG,
      duplicateRate: 0.05,
      outOfOrderRate: 0.05,
      timeoutRate: 0.01,
      networkFailureRate: 0.01,
      serverErrorRate: 0.01,
    },
    beats: [
      {
        number: 1,
        name: 'Test Beat',
        app: 'tradeline247',
        eventType: 'tradeline247:call.completed',
        payload: {
          callId: 'test-1',
          duration: 120,
          outcome: 'answered',
          summary: 'Test call',
          actionItems: [],
        } as CallCompletedPayload,
        expectedOutcome: 'Event processed successfully',
        observability: 'Check agent_runs table',
      },
    ],
    dryRun: true,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SimulationRunner,
  runSimulation,
  quickTest,
};
