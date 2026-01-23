/**
 * OmniPort Metrics & Observability
 * =============================================================================
 * Real-time metrics collection for OmniDash integration.
 * Provides live ingestion stats, risk analysis, and performance tracking.
 * =============================================================================
 */

import { RiskLane, IngestStatus } from '../types/ingress';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Aggregated metrics for a time window
 */
export interface OmniPortMetrics {
  /** Total ingestion attempts */
  totalIngestions: number;

  /** Successful deliveries */
  accepted: number;

  /** Blocked by Zero-Trust */
  blocked: number;

  /** Buffered to DLQ */
  buffered: number;

  /** RED lane (high-risk) events */
  redLaneEvents: number;

  /** Events requiring MAN Mode approval */
  manModeTriggered: number;

  /** Average latency in milliseconds */
  avgLatencyMs: number;

  /** P95 latency in milliseconds */
  p95LatencyMs: number;

  /** Breakdown by input type */
  bySourceType: {
    text: number;
    voice: number;
    webhook: number;
  };

  /** Time window start */
  windowStart: Date;

  /** Time window end */
  windowEnd: Date;

  /** Metrics collection timestamp */
  collectedAt: Date;
}

/**
 * Single ingestion event for tracking
 */
export interface IngestEvent {
  correlationId: string;
  status: IngestStatus;
  riskLane: RiskLane;
  latencyMs: number;
  sourceType: 'text' | 'voice' | 'webhook';
  requiresManApproval: boolean;
  timestamp: Date;
}

/**
 * Real-time status for dashboard
 */
export interface OmniPortStatus {
  /** Engine health status */
  health: 'healthy' | 'degraded' | 'critical';

  /** Is the engine initialized */
  initialized: boolean;

  /** Current events per second */
  eventsPerSecond: number;

  /** DLQ depth (pending items) */
  dlqDepth: number;

  /** Last successful ingestion */
  lastSuccessAt: Date | null;

  /** Last error */
  lastError: string | null;

  /** Uptime in seconds */
  uptimeSeconds: number;
}

// =============================================================================
// METRICS COLLECTOR SINGLETON
// =============================================================================

/**
 * OmniPort Metrics Collector
 * Collects and aggregates ingestion metrics for OmniDash
 */
class MetricsCollector {
  private static instance: MetricsCollector | null = null;

  private events: IngestEvent[] = [];
  private startTime: Date = new Date();
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;
  private dlqDepth = 0;

  // Sliding window configuration
  private readonly maxEvents = 10000;
  private readonly windowMs = 60000; // 1 minute default

  private constructor() {}

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public static resetInstance(): void {
    MetricsCollector.instance = null;
  }

  // ===========================================================================
  // EVENT RECORDING
  // ===========================================================================

  /**
   * Record an ingestion event
   */
  public recordEvent(event: Omit<IngestEvent, 'timestamp'>): void {
    const fullEvent: IngestEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Track last success
    if (event.status === 'accepted') {
      this.lastSuccessAt = new Date();
      this.lastError = null;
    }

    // Prune old events to prevent memory growth
    this.pruneEvents();
  }

  /**
   * Record an error
   */
  public recordError(error: string): void {
    this.lastError = error;
  }

  /**
   * Update DLQ depth
   */
  public setDLQDepth(depth: number): void {
    this.dlqDepth = depth;
  }

  // ===========================================================================
  // METRICS RETRIEVAL
  // ===========================================================================

  /**
   * Get aggregated metrics for a time window
   */
  public getMetrics(windowMs: number = this.windowMs): OmniPortMetrics {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    const windowEvents = this.events.filter((e) => e.timestamp >= windowStart);

    const latencies = windowEvents.map((e) => e.latencyMs).sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0;
    const p95LatencyMs =
      latencies.length > 0
        ? latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1]
        : 0;

    return {
      totalIngestions: windowEvents.length,
      accepted: windowEvents.filter((e) => e.status === 'accepted').length,
      blocked: windowEvents.filter((e) => e.status === 'blocked').length,
      buffered: windowEvents.filter((e) => e.status === 'buffered').length,
      redLaneEvents: windowEvents.filter((e) => e.riskLane === 'RED').length,
      manModeTriggered: windowEvents.filter((e) => e.requiresManApproval).length,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      p95LatencyMs,
      bySourceType: {
        text: windowEvents.filter((e) => e.sourceType === 'text').length,
        voice: windowEvents.filter((e) => e.sourceType === 'voice').length,
        webhook: windowEvents.filter((e) => e.sourceType === 'webhook').length,
      },
      windowStart,
      windowEnd: now,
      collectedAt: now,
    };
  }

  /**
   * Get current status for dashboard
   */
  public getStatus(): OmniPortStatus {
    const now = new Date();
    const recentWindowMs = 10000; // 10 seconds
    const recentEvents = this.events.filter(
      (e) => e.timestamp >= new Date(now.getTime() - recentWindowMs)
    );

    const eventsPerSecond = recentEvents.length / (recentWindowMs / 1000);

    // Determine health based on metrics
    let health: OmniPortStatus['health'] = 'healthy';

    if (this.dlqDepth > 100 || eventsPerSecond === 0) {
      health = 'degraded';
    }

    if (this.dlqDepth > 1000 || this.lastError) {
      health = 'critical';
    }

    const uptimeSeconds = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    return {
      health,
      initialized: true,
      eventsPerSecond: Math.round(eventsPerSecond * 100) / 100,
      dlqDepth: this.dlqDepth,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      uptimeSeconds,
    };
  }

  /**
   * Get raw events for detailed analysis
   */
  public getRecentEvents(limit: number = 100): IngestEvent[] {
    return this.events.slice(-limit);
  }

  // ===========================================================================
  // INTERNAL
  // ===========================================================================

  private pruneEvents(): void {
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Also prune events older than 1 hour
    const cutoff = new Date(Date.now() - 3600000);
    this.events = this.events.filter((e) => e.timestamp >= cutoff);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const omniPortMetrics = MetricsCollector.getInstance();

/**
 * Record an ingestion event (convenience function)
 */
export function recordIngestEvent(
  correlationId: string,
  status: IngestStatus,
  riskLane: RiskLane,
  latencyMs: number,
  sourceType: 'text' | 'voice' | 'webhook',
  requiresManApproval: boolean
): void {
  omniPortMetrics.recordEvent({
    correlationId,
    status,
    riskLane,
    latencyMs,
    sourceType,
    requiresManApproval,
  });
}

/**
 * Get current metrics for OmniDash
 */
export function getOmniPortMetrics(windowMs?: number): OmniPortMetrics {
  return omniPortMetrics.getMetrics(windowMs);
}

/**
 * Get current status for OmniDash
 */
export function getOmniPortStatus(): OmniPortStatus {
  return omniPortMetrics.getStatus();
}

/**
 * Reset metrics collector (for testing)
 */
export function resetMetricsCollector(): void {
  MetricsCollector.resetInstance();
}
