/**
 * OPENTELEMETRY DISTRIBUTED TRACING
 *
 * Provides instrumentation hooks for distributed tracing of chaos simulation events.
 * Enables observability across the entire event lifecycle.
 *
 * USAGE:
 *   import { startSpan, endSpan, recordException } from './telemetry';
 *
 *   const span = startSpan('event-processing', { eventId: '123' });
 *   try {
 *     await processEvent();
 *     endSpan(span, { status: 'success' });
 *   } catch (error) {
 *     recordException(span, error);
 *     endSpan(span, { status: 'error' });
 *   }
 */

import type { EventEnvelope } from './contracts';

// ============================================================================
// TYPES
// ============================================================================

export interface Span {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  status?: 'ok' | 'error';
}

export interface SpanEvent {
  timestamp: number;
  name: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

// ============================================================================
// IN-MEMORY SPAN STORE
// ============================================================================

const activeSpans = new Map<string, Span>();
const completedSpans: Span[] = [];

let spanIdCounter = 0;

/**
 * Generate unique span ID
 */
function generateSpanId(): string {
  return `span-${Date.now()}-${spanIdCounter++}`;
}

// ============================================================================
// SPAN MANAGEMENT
// ============================================================================

/**
 * Start a new span for tracing
 */
export function startSpan(
  name: string,
  attributes: Record<string, string | number | boolean> = {},
  parentSpanId?: string
): Span {
  const span: Span = {
    id: generateSpanId(),
    name,
    startTime: Date.now(),
    attributes: {
      ...attributes,
      'span.kind': 'internal',
      parentSpanId: parentSpanId || 'root',
    },
    events: [],
  };

  activeSpans.set(span.id, span);
  return span;
}

/**
 * End an active span
 */
export function endSpan(
  span: Span,
  options?: { status?: 'ok' | 'error'; attributes?: Record<string, string | number | boolean> }
): void {
  span.endTime = Date.now();
  span.status = options?.status || 'ok';

  if (options?.attributes) {
    Object.assign(span.attributes, options.attributes);
  }

  // Calculate duration
  span.attributes['duration.ms'] = span.endTime - span.startTime;

  // Move from active to completed
  activeSpans.delete(span.id);
  completedSpans.push(span);

  // Auto-export to OpenTelemetry if configured
  if (process.env.OTEL_EXPORTER_ENABLED === 'true') {
    exportSpan(span).catch(err =>
      console.error('[Telemetry] Export failed:', err)
    );
  }
}

/**
 * Add event to span
 */
export function addSpanEvent(
  span: Span,
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  span.events.push({
    timestamp: Date.now(),
    name,
    attributes,
  });
}

/**
 * Record exception in span
 */
export function recordException(span: Span, error: Error | unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  addSpanEvent(span, 'exception', {
    'exception.type': error instanceof Error ? error.constructor.name : 'Error',
    'exception.message': errorMessage,
    'exception.stacktrace': errorStack || '',
  });

  span.status = 'error';
}

/**
 * Set span attributes
 */
export function setSpanAttributes(
  span: Span,
  attributes: Record<string, string | number | boolean>
): void {
  Object.assign(span.attributes, attributes);
}

// ============================================================================
// EVENT-SPECIFIC TRACING
// ============================================================================

/**
 * Create span for event processing
 */
export function startEventSpan(event: EventEnvelope, operation: string): Span {
  return startSpan(`event.${operation}`, {
    'event.id': event.eventId,
    'event.type': event.eventType,
    'event.source': event.source,
    'correlation.id': event.correlationId,
    'idempotency.key': event.idempotencyKey,
    'tenant.id': event.tenantId,
    'trace.id': event.trace.traceId,
    'trace.parent_span_id': event.trace.spanId,
  }, event.trace.spanId);
}

/**
 * Trace chaos decision
 */
export function traceChaosDecision(span: Span, decision: {
  shouldDuplicate: boolean;
  shouldDelay: boolean;
  shouldTimeout: boolean;
  shouldFailNetwork: boolean;
  shouldFailServer: boolean;
}): void {
  addSpanEvent(span, 'chaos.decision', {
    'chaos.duplicate': decision.shouldDuplicate,
    'chaos.delay': decision.shouldDelay,
    'chaos.timeout': decision.shouldTimeout,
    'chaos.network_failure': decision.shouldFailNetwork,
    'chaos.server_failure': decision.shouldFailServer,
  });
}

/**
 * Trace idempotency check
 */
export function traceIdempotencyCheck(span: Span, wasCached: boolean, attemptCount: number): void {
  addSpanEvent(span, 'idempotency.check', {
    'idempotency.cached': wasCached,
    'idempotency.attempt_count': attemptCount,
  });
}

/**
 * Trace circuit breaker state
 */
export function traceCircuitBreaker(span: Span, name: string, state: string, action: string): void {
  addSpanEvent(span, 'circuit_breaker.action', {
    'circuit_breaker.name': name,
    'circuit_breaker.state': state,
    'circuit_breaker.action': action,
  });
}

/**
 * Trace retry attempt
 */
export function traceRetry(span: Span, attempt: number, backoffMs: number): void {
  addSpanEvent(span, 'retry.attempt', {
    'retry.attempt': attempt,
    'retry.backoff_ms': backoffMs,
  });
}

// ============================================================================
// SPAN RETRIEVAL
// ============================================================================

/**
 * Get all active spans
 */
export function getActiveSpans(): Span[] {
  return Array.from(activeSpans.values());
}

/**
 * Get all completed spans
 */
export function getCompletedSpans(): Span[] {
  return [...completedSpans];
}

/**
 * Get span by ID
 */
export function getSpan(spanId: string): Span | undefined {
  return activeSpans.get(spanId) || completedSpans.find(s => s.id === spanId);
}

/**
 * Clear all spans
 */
export function clearAllSpans(): void {
  activeSpans.clear();
  completedSpans.length = 0;
  spanIdCounter = 0;
}

// ============================================================================
// OPENTELEMETRY EXPORT (Stub)
// ============================================================================

/**
 * Export span to OpenTelemetry collector
 *
 * In production, this would send to an OTEL collector like Jaeger, Zipkin, or Honeycomb.
 * For simulation mode, this is a no-op.
 */
async function exportSpan(span: Span): Promise<void> {
  // Skip in simulation mode
  if (process.env.SIM_MODE === 'true') {
    return;
  }

  // Check if OTEL exporter is configured
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!otelEndpoint) {
    return;
  }

  try {
    // In a real implementation, you would use @opentelemetry/sdk-trace-base
    // and @opentelemetry/exporter-trace-otlp-http
    //
    // Example:
    // const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    // const exporter = new OTLPTraceExporter({ url: otelEndpoint });
    // await exporter.export([convertToOTelSpan(span)]);

    console.log(`[Telemetry] Would export span ${span.id} to ${otelEndpoint}`);
  } catch (error) {
    console.error('[Telemetry] Export failed:', error);
  }
}

/**
 * Batch export all completed spans
 */
export async function exportAllSpans(): Promise<number> {
  if (process.env.SIM_MODE === 'true') {
    return 0;
  }

  const spans = getCompletedSpans();
  if (spans.length === 0) {
    return 0;
  }

  for (const span of spans) {
    await exportSpan(span);
  }

  return spans.length;
}

// ============================================================================
// METRICS FROM SPANS
// ============================================================================

/**
 * Generate telemetry summary from completed spans
 */
export function getTelemetrySummary(): {
  totalSpans: number;
  successfulSpans: number;
  errorSpans: number;
  avgDurationMs: number;
  p95DurationMs: number;
  spansByOperation: Record<string, number>;
} {
  const spans = completedSpans;
  const totalSpans = spans.length;
  const successfulSpans = spans.filter(s => s.status === 'ok').length;
  const errorSpans = spans.filter(s => s.status === 'error').length;

  const durations = spans
    .filter(s => s.endTime)
    .map(s => s.endTime! - s.startTime)
    .sort((a, b) => a - b);

  const avgDurationMs = durations.length > 0
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : 0;

  const p95Index = Math.floor(durations.length * 0.95);
  const p95DurationMs = durations[p95Index] || 0;

  const spansByOperation: Record<string, number> = {};
  for (const span of spans) {
    spansByOperation[span.name] = (spansByOperation[span.name] || 0) + 1;
  }

  return {
    totalSpans,
    successfulSpans,
    errorSpans,
    avgDurationMs,
    p95DurationMs,
    spansByOperation,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  startSpan,
  endSpan,
  addSpanEvent,
  recordException,
  setSpanAttributes,
  startEventSpan,
  traceChaosDecision,
  traceIdempotencyCheck,
  traceCircuitBreaker,
  traceRetry,
  getActiveSpans,
  getCompletedSpans,
  getSpan,
  clearAllSpans,
  exportAllSpans,
  getTelemetrySummary,
};
