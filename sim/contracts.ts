/**
 * EVENT SPINE CONTRACTS
 *
 * Unified event schema and contracts for all 12 APEX apps.
 * Used by the chaos simulation runner for deterministic, idempotent testing.
 *
 * NON-NEGOTIABLES:
 * - All events MUST include correlationId + idempotencyKey
 * - All events MUST be serializable (JSON)
 * - All contracts MUST be versioned
 * - All operations MUST be idempotent
 */

// ============================================================================
// CORE EVENT ENVELOPE
// ============================================================================

export interface EventEnvelope<T = unknown> {
  /** Unique event identifier */
  eventId: string;

  /** Correlation ID for tracing across apps */
  correlationId: string;

  /** Idempotency key for deduplication (format: {tenantId}-{eventType}-{timestamp}-{nonce}) */
  idempotencyKey: string;

  /** Tenant ID for multi-tenancy isolation */
  tenantId: string;

  /** Event type (format: {app}:{domain}.{action}) */
  eventType: EventType;

  /** Event payload (app-specific) */
  payload: T;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Source app that emitted the event */
  source: AppName;

  /** Target app(s) (null = broadcast) */
  target?: AppName | AppName[];

  /** Trace context for observability */
  trace: TraceContext;

  /** Metadata for chaos engineering */
  chaos?: ChaosMetadata;

  /** Schema version for backwards compatibility */
  schemaVersion: string;
}

export interface TraceContext {
  /** Trace ID (same as correlationId for simplicity) */
  traceId: string;

  /** Span ID (unique per hop) */
  spanId: string;

  /** Parent span ID (null for root) */
  parentSpanId?: string;

  /** Baggage for context propagation */
  baggage?: Record<string, string>;
}

export interface ChaosMetadata {
  /** Was this event duplicated by chaos engine? */
  isDuplicate?: boolean;

  /** Injected delay in milliseconds */
  injectedDelayMs?: number;

  /** Was delivery order scrambled? */
  outOfOrder?: boolean;

  /** Simulated failure type */
  simulatedFailure?: 'timeout' | 'network' | 'server' | 'validation';

  /** Retry attempt number */
  retryAttempt?: number;
}

// ============================================================================
// APP NAMES (12 APEX Apps)
// ============================================================================

export type AppName =
  | 'omnilink'         // 1. Event fabric / integration SDK
  | 'omnihub'          // 2. Dashboard / orchestration UI
  | 'tradeline247'     // 3. AI receptionist (TradeLine 24/7)
  | 'autorepai'        // 4. Auto repair AI
  | 'flowbills'        // 5. Billing automation
  | 'flowc'            // 6. Silent compliance integration
  | 'aspiral'          // 7. aSpiral (stub)
  | 'jubeelove'        // 8. AI relationship coach
  | 'trutalk'          // 9. TRU Talk (stub)
  | 'keepsafe'         // 10. Safety & compliance
  | 'bright'           // 11. Bright Beginnings (stub)
  | 'careconnect';     // 12. CareConnect (stub, not MVP)

// ============================================================================
// EVENT TYPES (Canonical Taxonomy)
// ============================================================================

export type EventType =
  // OmniLink (Integration Fabric)
  | 'omnilink:system.started'
  | 'omnilink:system.health_check'
  | 'omnilink:integration.connected'
  | 'omnilink:integration.disconnected'
  | 'omnilink:event.routed'
  | 'omnilink:event.failed'

  // OmniHub (Dashboard / Orchestration)
  | 'omnihub:dashboard.opened'
  | 'omnihub:workflow.triggered'
  | 'omnihub:alert.created'
  | 'omnihub:report.generated'

  // TradeLine 24/7 (AI Receptionist)
  | 'tradeline247:call.received'
  | 'tradeline247:call.answered'
  | 'tradeline247:call.transferred'
  | 'tradeline247:call.completed'
  | 'tradeline247:message.recorded'
  | 'tradeline247:appointment.scheduled'

  // AutoRepAi (Auto Repair AI)
  | 'autorepai:repair.estimated'
  | 'autorepai:parts.ordered'
  | 'autorepai:service.scheduled'
  | 'autorepai:invoice.generated'
  | 'autorepai:customer.notified'

  // FLOWBills (Billing Automation)
  | 'flowbills:invoice.created'
  | 'flowbills:invoice.sent'
  | 'flowbills:payment.received'
  | 'flowbills:payment.failed'
  | 'flowbills:reminder.sent'
  | 'flowbills:reconciliation.completed'

  // FlowC (Silent Compliance)
  | 'flowc:compliance.check_triggered'
  | 'flowc:compliance.validated'
  | 'flowc:compliance.failed'
  | 'flowc:audit.logged'

  // aSpiral (Stub)
  | 'aspiral:task.created'
  | 'aspiral:task.completed'
  | 'aspiral:milestone.reached'

  // Jubee.Love (AI Relationship Coach)
  | 'jubeelove:session.started'
  | 'jubeelove:advice.given'
  | 'jubeelove:progress.tracked'
  | 'jubeelove:goal.achieved'

  // TRU Talk (Stub)
  | 'trutalk:conversation.started'
  | 'trutalk:message.sent'
  | 'trutalk:trust.verified'

  // KeepSafe (Safety & Compliance)
  | 'keepsafe:incident.reported'
  | 'keepsafe:safety_check.completed'
  | 'keepsafe:alert.triggered'
  | 'keepsafe:compliance.verified'

  // Bright Beginnings (Stub)
  | 'bright:enrollment.started'
  | 'bright:progress.updated'
  | 'bright:milestone.celebrated'

  // CareConnect (Stub)
  | 'careconnect:patient.registered'
  | 'careconnect:appointment.booked'
  | 'careconnect:care.coordinated';

// ============================================================================
// PAYLOAD CONTRACTS (Per Event Type)
// ============================================================================

// --- OmniLink Events ---
export interface SystemStartedPayload {
  version: string;
  environment: 'sandbox' | 'staging' | 'production';
  capabilities: string[];
}

export interface IntegrationConnectedPayload {
  appName: AppName;
  connectionId: string;
  features: string[];
}

export interface EventRoutedPayload {
  sourceEvent: string;
  targetApps: AppName[];
  routingDecision: string;
}

// --- TradeLine 24/7 Events ---
export interface CallReceivedPayload {
  callId: string;
  from: string;
  to: string;
  timestamp: string;
}

export interface CallCompletedPayload {
  callId: string;
  duration: number;
  outcome: 'answered' | 'voicemail' | 'transferred' | 'missed';
  summary: string;
  actionItems: string[];
}

export interface AppointmentScheduledPayload {
  appointmentId: string;
  callId: string;
  clientName: string;
  scheduledFor: string;
  serviceType: string;
  notes?: string;
}

// --- AutoRepAi Events ---
export interface RepairEstimatedPayload {
  estimateId: string;
  vehicleInfo: {
    make: string;
    model: string;
    year: number;
    vin?: string;
  };
  issues: string[];
  estimatedCost: number;
  estimatedDuration: string;
}

export interface PartsOrderedPayload {
  orderId: string;
  estimateId: string;
  parts: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  supplier: string;
  expectedDelivery: string;
}

export interface ServiceScheduledPayload {
  serviceId: string;
  estimateId: string;
  scheduledDate: string;
  technician: string;
  bayNumber: number;
}

// --- FLOWBills Events ---
export interface InvoiceCreatedPayload {
  invoiceId: string;
  clientId: string;
  amount: number;
  currency: string;
  dueDate: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  taxRate: number;
  totalAmount: number;
}

export interface PaymentReceivedPayload {
  paymentId: string;
  invoiceId: string;
  amount: number;
  method: 'card' | 'bank' | 'cash' | 'check';
  paidAt: string;
  reference: string;
}

export interface ReconciliationCompletedPayload {
  reconciliationId: string;
  period: string;
  invoicesProcessed: number;
  paymentsMatched: number;
  discrepancies: number;
  status: 'balanced' | 'unbalanced';
}

// --- FlowC Events ---
export interface ComplianceCheckTriggeredPayload {
  checkId: string;
  invoiceId: string;
  rules: string[];
  triggeredBy: 'flowbills' | 'manual';
}

export interface ComplianceValidatedPayload {
  checkId: string;
  status: 'passed' | 'failed';
  violations: Array<{
    rule: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  validatedAt: string;
}

// --- KeepSafe Events ---
export interface IncidentReportedPayload {
  incidentId: string;
  type: 'safety' | 'security' | 'compliance' | 'health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportedBy: string;
  description: string;
  location: string;
  timestamp: string;
}

export interface SafetyCheckCompletedPayload {
  checkId: string;
  facility: string;
  inspector: string;
  items: Array<{
    category: string;
    status: 'pass' | 'fail' | 'warning';
    notes?: string;
  }>;
  overallStatus: 'compliant' | 'non-compliant';
  completedAt: string;
}

// --- Jubee.Love Events ---
export interface SessionStartedPayload {
  sessionId: string;
  userId: string;
  relationshipGoal: string;
  sessionType: 'chat' | 'video' | 'coaching';
}

export interface AdviceGivenPayload {
  sessionId: string;
  category: 'communication' | 'conflict' | 'intimacy' | 'trust';
  advice: string;
  exercises: string[];
  followUpDate: string;
}

export interface ProgressTrackedPayload {
  userId: string;
  metrics: {
    communicationScore: number;
    conflictResolutionScore: number;
    intimacyScore: number;
    trustScore: number;
  };
  improvement: number;
  period: string;
}

// --- Generic Stubs (for apps not fully implemented) ---
export interface GenericTaskPayload {
  taskId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

// ============================================================================
// IDEMPOTENCY KEY GENERATION
// ============================================================================

/**
 * Generate deterministic idempotency key
 * Format: {tenantId}-{eventType}-{timestamp}-{nonce}
 */
export function generateIdempotencyKey(
  tenantId: string,
  eventType: EventType,
  timestamp: Date,
  nonce: string = ''
): string {
  const ts = timestamp.getTime();
  const nonceStr = nonce || Math.random().toString(36).substring(2, 10);
  return `${tenantId}-${eventType}-${ts}-${nonceStr}`;
}

/**
 * Generate deterministic idempotency key with seed for chaos testing
 * Same seed + inputs → same key (deterministic)
 */
export function generateDeterministicKey(
  tenantId: string,
  eventType: EventType,
  timestamp: Date,
  seed: number,
  sequence: number
): string {
  // Simple deterministic hash from seed + sequence
  const hash = ((seed * 31 + sequence) % 1000000).toString(36);
  return `${tenantId}-${eventType}-${timestamp.getTime()}-${hash}`;
}

// ============================================================================
// EVENT ENVELOPE BUILDER
// ============================================================================

export interface EventBuilder<T = unknown> {
  correlationId(id: string): EventBuilder<T>;
  idempotencyKey(key: string): EventBuilder<T>;
  source(app: AppName): EventBuilder<T>;
  target(app: AppName | AppName[]): EventBuilder<T>;
  payload(data: T): EventBuilder<T>;
  chaos(metadata: ChaosMetadata): EventBuilder<T>;
  build(): EventEnvelope<T>;
}

export function createEvent<T = unknown>(
  tenantId: string,
  eventType: EventType
): EventBuilder<T> {
  const builder: Partial<EventEnvelope<T>> = {
    eventId: crypto.randomUUID(),
    tenantId,
    eventType,
    timestamp: new Date().toISOString(),
    schemaVersion: '1.0.0',
    trace: {
      traceId: crypto.randomUUID(),
      spanId: crypto.randomUUID(),
    },
  };

  return {
    correlationId(id: string) {
      builder.correlationId = id;
      builder.trace!.traceId = id; // Align trace with correlation
      return this;
    },

    idempotencyKey(key: string) {
      builder.idempotencyKey = key;
      return this;
    },

    source(app: AppName) {
      builder.source = app;
      return this;
    },

    target(app: AppName | AppName[]) {
      builder.target = app;
      return this;
    },

    payload(data: T) {
      builder.payload = data;
      return this;
    },

    chaos(metadata: ChaosMetadata) {
      builder.chaos = metadata;
      return this;
    },

    build(): EventEnvelope<T> {
      if (!builder.correlationId) {
        throw new Error('correlationId is required');
      }
      if (!builder.idempotencyKey) {
        throw new Error('idempotencyKey is required');
      }
      if (!builder.source) {
        throw new Error('source app is required');
      }
      if (!builder.payload) {
        throw new Error('payload is required');
      }

      return builder as EventEnvelope<T>;
    },
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isValidEventEnvelope(obj: unknown): obj is EventEnvelope {
  if (typeof obj !== 'object' || obj === null) return false;

  const env = obj as EventEnvelope;

  return (
    typeof env.eventId === 'string' &&
    typeof env.correlationId === 'string' &&
    typeof env.idempotencyKey === 'string' &&
    typeof env.tenantId === 'string' &&
    typeof env.eventType === 'string' &&
    typeof env.timestamp === 'string' &&
    typeof env.source === 'string' &&
    env.payload !== undefined &&
    typeof env.trace === 'object' &&
    typeof env.schemaVersion === 'string'
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SCHEMA_VERSION = '1.0.0';

export const ALL_APPS: readonly AppName[] = [
  'omnilink',
  'omnihub',
  'tradeline247',
  'autorepai',
  'flowbills',
  'flowc',
  'aspiral',
  'jubeelove',
  'trutalk',
  'keepsafe',
  'bright',
  'careconnect',
] as const;

export const APPS_WITH_REAL_IMPL: readonly AppName[] = [
  'omnilink',
  'omnihub',
  'tradeline247',
  'autorepai',
  'flowbills',
  'jubeelove',
  'keepsafe',
] as const;

export const APPS_STUBBED: readonly AppName[] = [
  'flowc',
  'aspiral',
  'trutalk',
  'bright',
  'careconnect',
] as const;

// ============================================================================
// VALIDATION
// ============================================================================

export function validateEvent(event: EventEnvelope): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!event.eventId) errors.push('eventId is required');
  if (!event.correlationId) errors.push('correlationId is required');
  if (!event.idempotencyKey) errors.push('idempotencyKey is required');
  if (!event.tenantId) errors.push('tenantId is required');
  if (!event.eventType) errors.push('eventType is required');
  if (!event.source) errors.push('source is required');
  if (!event.payload) errors.push('payload is required');
  if (!event.timestamp) errors.push('timestamp is required');
  if (!event.trace) errors.push('trace is required');
  if (!event.schemaVersion) errors.push('schemaVersion is required');

  // Validate timestamp format
  if (event.timestamp && isNaN(Date.parse(event.timestamp))) {
    errors.push('timestamp must be valid ISO 8601');
  }

  // Validate app name
  if (event.source && !ALL_APPS.includes(event.source)) {
    errors.push(`source must be one of: ${ALL_APPS.join(', ')}`);
  }

  // Validate idempotency key format
  if (event.idempotencyKey && !event.idempotencyKey.includes('-')) {
    errors.push('idempotencyKey must follow format: {tenantId}-{eventType}-{timestamp}-{nonce}');
  }

  return { valid: errors.length === 0, errors };
}
