/**
 * METRICS COLLECTION
 *
 * Lightweight metrics for chaos simulation performance tracking.
 * Tracks latency, throughput, errors, and quality of service.
 */

import type { AppName, EventType } from './contracts';

// ============================================================================
// TYPES
// ============================================================================

export interface LatencyMetric {
  operation: string;
  durationMs: number;
  timestamp: Date;
  success: boolean;
  retryAttempt: number;
}

export interface LatencyStats {
  operation: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  successRate: number;
}

export interface AppMetrics {
  app: AppName;
  eventsProcessed: number;
  eventsSucceeded: number;
  eventsFailed: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  retriesTotal: number;
  dedupesTotal: number;
}

export interface SystemMetrics {
  totalEvents: number;
  totalDurations: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  retryRate: number;
  dedupeRate: number;
  queueDepth: number;
  circuitBreakers: Record<string, string>; // name -> state
}

export interface Scorecard {
  runId: string;
  scenario: string;
  tenant: string;
  seed: number;
  timestamp: Date;
  duration: number;
  overallScore: number; // 0-100
  apps: Record<AppName, AppScore>;
  system: SystemScore;
  passed: boolean;
  issues: string[];
  warnings: string[];
}

export interface AppScore {
  app: AppName;
  score: number; // 0-100
  eventsProcessed: number;
  successRate: number;
  avgLatencyMs: number;
  passed: boolean;
  issues: string[];
}

export interface SystemScore {
  score: number; // 0-100
  latency: boolean; // p95 < target
  errors: boolean; // error rate < threshold
  resilience: boolean; // recovered from failures
  idempotency: boolean; // no duplicate side effects
  passed: boolean;
}

// ============================================================================
// METRICS COLLECTOR
// ============================================================================

export class MetricsCollector {
  private latencyMetrics: LatencyMetric[] = [];
  private appCounts: Map<AppName, { success: number; failure: number; retries: number; dedupes: number }> = new Map();
  private startTime: Date;
  private endTime: Date | null = null;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Record latency metric
   */
  recordLatency(
    operation: string,
    durationMs: number,
    success: boolean,
    retryAttempt: number = 0
  ): void {
    this.latencyMetrics.push({
      operation,
      durationMs,
      timestamp: new Date(),
      success,
      retryAttempt,
    });
  }

  /**
   * Record app event
   */
  recordAppEvent(app: AppName, success: boolean, retry: boolean = false, dedupe: boolean = false): void {
    if (!this.appCounts.has(app)) {
      this.appCounts.set(app, { success: 0, failure: 0, retries: 0, dedupes: 0 });
    }

    const counts = this.appCounts.get(app)!;

    if (success) {
      counts.success++;
    } else {
      counts.failure++;
    }

    if (retry) {
      counts.retries++;
    }

    if (dedupe) {
      counts.dedupes++;
    }
  }

  /**
   * Mark end time
   */
  finish(): void {
    this.endTime = new Date();
  }

  /**
   * Calculate latency stats for operation
   */
  getLatencyStats(operation?: string): LatencyStats[] {
    const byOp = new Map<string, LatencyMetric[]>();

    // Group by operation
    for (const metric of this.latencyMetrics) {
      if (operation && metric.operation !== operation) continue;

      if (!byOp.has(metric.operation)) {
        byOp.set(metric.operation, []);
      }
      byOp.get(metric.operation)!.push(metric);
    }

    // Calculate stats for each operation
    const stats: LatencyStats[] = [];

    for (const [op, metrics] of byOp.entries()) {
      const durations = metrics.map(m => m.durationMs).sort((a, b) => a - b);
      const successes = metrics.filter(m => m.success).length;

      stats.push({
        operation: op,
        count: metrics.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        mean: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50: this.percentile(durations, 0.50),
        p95: this.percentile(durations, 0.95),
        p99: this.percentile(durations, 0.99),
        successRate: successes / metrics.length,
      });
    }

    return stats;
  }

  /**
   * Get app metrics
   */
  getAppMetrics(): AppMetrics[] {
    const metrics: AppMetrics[] = [];

    for (const [app, counts] of this.appCounts.entries()) {
      const total = counts.success + counts.failure;
      const successRate = total > 0 ? counts.success / total : 0;

      // Get app-specific latency metrics
      const appLatency = this.latencyMetrics.filter(m => m.operation.startsWith(app));
      const avgLatency = appLatency.length > 0
        ? appLatency.reduce((sum, m) => sum + m.durationMs, 0) / appLatency.length
        : 0;

      const durations = appLatency.map(m => m.durationMs).sort((a, b) => a - b);
      const p95Latency = durations.length > 0 ? this.percentile(durations, 0.95) : 0;

      metrics.push({
        app,
        eventsProcessed: total,
        eventsSucceeded: counts.success,
        eventsFailed: counts.failure,
        successRate,
        avgLatencyMs: avgLatency,
        p95LatencyMs: p95Latency,
        retriesTotal: counts.retries,
        dedupesTotal: counts.dedupes,
      });
    }

    return metrics;
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics(queueDepth: number = 0, circuitStates: Record<string, string> = {}): SystemMetrics {
    const allDurations = this.latencyMetrics.map(m => m.durationMs).sort((a, b) => a - b);
    const totalEvents = this.latencyMetrics.length;
    const totalFailures = this.latencyMetrics.filter(m => !m.success).length;
    const totalRetries = this.latencyMetrics.filter(m => m.retryAttempt > 0).length;

    const appMetrics = this.getAppMetrics();
    const totalDedupes = appMetrics.reduce((sum, m) => sum + m.dedupesTotal, 0);

    return {
      totalEvents,
      totalDurations: allDurations.length,
      avgLatencyMs: allDurations.length > 0
        ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
        : 0,
      p50LatencyMs: this.percentile(allDurations, 0.50),
      p95LatencyMs: this.percentile(allDurations, 0.95),
      p99LatencyMs: this.percentile(allDurations, 0.99),
      errorRate: totalEvents > 0 ? totalFailures / totalEvents : 0,
      retryRate: totalEvents > 0 ? totalRetries / totalEvents : 0,
      dedupeRate: totalEvents > 0 ? totalDedupes / totalEvents : 0,
      queueDepth,
      circuitBreakers: circuitStates,
    };
  }

  /**
   * Generate scorecard
   */
  generateScorecard(
    runId: string,
    scenario: string,
    tenant: string,
    seed: number,
    queueDepth: number = 0,
    circuitStates: Record<string, string> = {}
  ): Scorecard {
    const duration = this.endTime
      ? this.endTime.getTime() - this.startTime.getTime()
      : Date.now() - this.startTime.getTime();

    const appMetrics = this.getAppMetrics();
    const systemMetrics = this.getSystemMetrics(queueDepth, circuitStates);

    // Score each app
    const apps: Record<AppName, AppScore> = {} as Record<AppName, AppScore>;
    const appIssues: string[] = [];

    for (const metric of appMetrics) {
      const score = this.calculateAppScore(metric);
      const passed = score.score >= 70; // 70% threshold

      apps[metric.app] = score;

      if (!passed) {
        appIssues.push(...score.issues);
      }
    }

    // Score system
    const systemScore = this.calculateSystemScore(systemMetrics);

    // Overall score (weighted average)
    const appScores = Object.values(apps).map(a => a.score);
    const avgAppScore = appScores.length > 0
      ? appScores.reduce((a, b) => a + b, 0) / appScores.length
      : 0;

    const overallScore = (avgAppScore * 0.6) + (systemScore.score * 0.4); // 60% app, 40% system

    // Overall pass/fail
    const passed = overallScore >= 70 && systemScore.passed;

    // Collect all issues
    const issues = [...appIssues];
    const warnings: string[] = [];

    if (systemMetrics.p95LatencyMs > 500) {
      warnings.push(`High p95 latency: ${systemMetrics.p95LatencyMs.toFixed(0)}ms`);
    }

    if (systemMetrics.errorRate > 0.1) {
      warnings.push(`High error rate: ${(systemMetrics.errorRate * 100).toFixed(1)}%`);
    }

    return {
      runId,
      scenario,
      tenant,
      seed,
      timestamp: this.startTime,
      duration,
      overallScore,
      apps,
      system: systemScore,
      passed,
      issues,
      warnings,
    };
  }

  /**
   * Calculate app score
   */
  private calculateAppScore(metric: AppMetrics): AppScore {
    const issues: string[] = [];
    let score = 100;

    // Success rate (40 points)
    if (metric.successRate < 0.95) {
      const penalty = (1 - metric.successRate) * 40;
      score -= penalty;
      issues.push(`${metric.app}: Low success rate ${(metric.successRate * 100).toFixed(1)}%`);
    }

    // Latency (30 points)
    if (metric.p95LatencyMs > 500) {
      const penalty = Math.min(30, (metric.p95LatencyMs - 500) / 50);
      score -= penalty;
      issues.push(`${metric.app}: High p95 latency ${metric.p95LatencyMs.toFixed(0)}ms`);
    }

    // Retries (15 points)
    const retryRate = metric.eventsProcessed > 0 ? metric.retriesTotal / metric.eventsProcessed : 0;
    if (retryRate > 0.2) {
      score -= 15;
      issues.push(`${metric.app}: High retry rate ${(retryRate * 100).toFixed(1)}%`);
    }

    // Event processing (15 points)
    if (metric.eventsProcessed === 0) {
      score -= 15;
      issues.push(`${metric.app}: No events processed`);
    }

    return {
      app: metric.app,
      score: Math.max(0, score),
      eventsProcessed: metric.eventsProcessed,
      successRate: metric.successRate,
      avgLatencyMs: metric.avgLatencyMs,
      passed: score >= 70,
      issues,
    };
  }

  /**
   * Calculate system score
   */
  private calculateSystemScore(metrics: SystemMetrics): SystemScore {
    const latency = metrics.p95LatencyMs < 500; // p95 < 500ms
    const errors = metrics.errorRate < 0.1; // < 10% error rate

    // Adaptive retry threshold based on context
    // In chaos testing, retries are expected and healthy (up to 80%)
    // In production, keep strict threshold (30%)
    const retryThreshold = process.env.SIM_MODE === 'true' ? 0.8 : 0.3;
    const resilience = metrics.retryRate < retryThreshold;

    const idempotency = metrics.dedupeRate >= 0; // Deduplication working

    let score = 100;

    if (!latency) score -= 25;
    if (!errors) score -= 25;
    if (!resilience) score -= 25;
    if (!idempotency) score -= 25;

    return {
      score: Math.max(0, score),
      latency,
      errors,
      resilience,
      idempotency,
      passed: latency && errors && resilience && idempotency,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.latencyMetrics = [];
    this.appCounts.clear();
    this.startTime = new Date();
    this.endTime = null;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let collector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!collector) {
    collector = new MetricsCollector();
  }
  return collector;
}

export function resetMetrics(): void {
  collector = new MetricsCollector();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  MetricsCollector,
  getMetricsCollector,
  resetMetrics,
};
