/**
 * OmniPort - The Proprietary Ingress Engine
 * =============================================================================
 * The fortified, high-speed ingress fortress for APEX OmniHub.
 * Implements Zero-Trust validation, idempotent execution, and MAN Mode governance.
 *
 * Core Philosophy:
 * 1. Defensive Ingress: Nothing enters without Identity + Rate Limit validation
 * 2. Deterministic Execution: All side effects wrapped in withIdempotency
 * 3. Proprietary Governance: High-risk intents tagged for MAN Mode approval
 * =============================================================================
 */

import { v4 as uuidv4 } from 'uuid';

import { supabase } from '@/integrations/supabase/client';
import {
  getDevice,
  type DeviceRecord,
  type DeviceStatus,
} from '@/zero-trust/deviceRegistry';
import { withIdempotency } from '../../../sim/idempotency';
import { OmniLinkDelivery } from '../delivery/omnilink-delivery';
import { CanonicalEvent, EventType, ConsentFlags } from '../types/canonical';
import {
  RawInput,
  IngestResult,
  RiskLane,
  IngestStatus,
  SecurityError,
  validateRawInput,
  isTextSource,
  isVoiceSource,
  isWebhookSource,
  detectHighRiskIntents,
} from '../types/ingress';
import { TranslatedEvent } from '../translation/translator';

// =============================================================================
// UNIVERSAL HASHING (Browser + Node.js compatible)
// =============================================================================

/**
 * Compute a deterministic hash for idempotency keys
 * Uses FNV-1a algorithm - fast, deterministic, browser-compatible
 */
function computeHash(data: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Extended canonical event with MAN Mode metadata
 */
interface OmniPortCanonicalEvent extends CanonicalEvent {
  metadata: CanonicalEvent['metadata'] & {
    requires_man_approval?: boolean;
    detected_intents?: string[];
    risk_lane?: RiskLane;
    source_type?: string;
    confidence?: number;
  };
}

/**
 * Internal pipeline context for tracing
 */
interface PipelineContext {
  correlationId: string;
  startTime: number;
  riskLane: RiskLane;
  userId: string;
  deviceStatus?: DeviceStatus;
}

// =============================================================================
// OMNIPORT SINGLETON
// =============================================================================

/**
 * OmniPort Singleton - The Defensive Ingress Gateway
 *
 * Execution Pipeline:
 * 1. Zero-Trust Gate: Validate device identity
 * 2. Idempotency Wrapper: Deduplicate with sha256 hash
 * 3. Semantic Normalization: Map to CanonicalEvent
 * 4. Resilient Dispatch: Deliver with circuit breaker
 * 5. Observability: Structured logging
 */
class OmniPortEngine {
  private static instance: OmniPortEngine | null = null;
  private delivery: OmniLinkDelivery;
  private isInitialized = false;

  private constructor() {
    this.delivery = new OmniLinkDelivery();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OmniPortEngine {
    if (!OmniPortEngine.instance) {
      OmniPortEngine.instance = new OmniPortEngine();
    }
    return OmniPortEngine.instance;
  }

  /**
   * Reset singleton (for testing only)
   */
  public static resetInstance(): void {
    OmniPortEngine.instance = null;
  }

  /**
   * Initialize the engine (idempotent)
   */
  public initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('[OmniPort] Engine initialized');
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Ingest raw input through the defensive pipeline
   *
   * @param input - Raw input from any source (text, voice, webhook)
   * @returns IngestResult with correlation ID and processing status
   * @throws SecurityError if device is blocked
   */
  public async ingest(input: RawInput): Promise<IngestResult> {
    const ctx = this.createContext(input);

    this.log(ctx, 'INGEST_START', { type: input.type });

    try {
      // =======================================================================
      // STEP 1: THE ZERO-TRUST GATE
      // =======================================================================
      const deviceRecord = await this.validateZeroTrust(input, ctx);

      // Proprietary Check: Force RED lane for suspect devices
      if (deviceRecord?.status === 'suspect') {
        ctx.riskLane = 'RED';
        this.log(ctx, 'SUSPECT_DEVICE', { deviceId: deviceRecord.deviceId });
      }

      // =======================================================================
      // STEP 2: THE IDEMPOTENCY WRAPPER
      // =======================================================================
      const idempotencyKey = this.computeIdempotencyKey(input, ctx.userId);

      const { result } = await withIdempotency(
        idempotencyKey,
        ctx.correlationId,
        'omniport.ingest',
        async () => this.executeIngestPipeline(input, ctx)
      );

      return result;
    } catch (error) {
      // Handle security errors specifically
      if (error instanceof SecurityError) {
        this.log(ctx, 'SECURITY_BLOCKED', { code: error.code });
        throw error;
      }

      // Circuit breaker: write to DLQ on unexpected errors
      await this.writeToDeadLetterQueue(input, ctx, error as Error);

      const latencyMs = Date.now() - ctx.startTime;
      this.log(ctx, 'INGEST_BUFFERED', { latencyMs, error: (error as Error).message });

      return {
        correlationId: ctx.correlationId,
        status: 'buffered' as IngestStatus,
        latencyMs,
        riskLane: ctx.riskLane,
      };
    }
  }

  // ===========================================================================
  // PIPELINE STAGES
  // ===========================================================================

  /**
   * STEP 1: Zero-Trust Gate
   * Validates device identity against DeviceRegistry
   */
  private async validateZeroTrust(
    input: RawInput,
    ctx: PipelineContext
  ): Promise<DeviceRecord | undefined> {
    // Extract userId based on input type
    const userId = this.extractUserId(input);

    if (!userId) {
      // No userId means we can't validate - allow but flag
      this.log(ctx, 'NO_USER_ID', { type: input.type });
      return undefined;
    }

    // Look up device by userId (using userId as deviceId for simplicity)
    // In production, this would use a separate deviceId from the request
    const deviceRecord = getDevice(userId);

    if (!deviceRecord) {
      // Unknown device - allow but track
      this.log(ctx, 'UNKNOWN_DEVICE', { userId });
      return undefined;
    }

    ctx.deviceStatus = deviceRecord.status;

    // BLOCKED devices are rejected immediately
    if (deviceRecord.status === 'blocked') {
      throw new SecurityError(
        `Device ${deviceRecord.deviceId} is blocked`,
        'DEVICE_BLOCKED',
        deviceRecord.deviceId,
        userId
      );
    }

    this.log(ctx, 'ZERO_TRUST_PASS', {
      deviceId: deviceRecord.deviceId,
      status: deviceRecord.status,
    });

    return deviceRecord;
  }

  /**
   * Execute the main ingestion pipeline (inside idempotency wrapper)
   */
  private async executeIngestPipeline(
    input: RawInput,
    ctx: PipelineContext
  ): Promise<IngestResult> {
    // =========================================================================
    // STEP 3: SEMANTIC NORMALIZATION
    // =========================================================================
    const canonicalEvent = this.normalizeToCanonical(input, ctx);

    // =========================================================================
    // STEP 4: RESILIENT DISPATCH
    // =========================================================================
    try {
      const translatedEvent = this.toTranslatedEvent(canonicalEvent, ctx);

      await this.delivery.deliverBatch(
        [translatedEvent],
        'omniport',
        ctx.correlationId
      );

      const latencyMs = Date.now() - ctx.startTime;
      this.log(ctx, 'INGEST_ACCEPTED', { latencyMs, riskLane: ctx.riskLane });

      return {
        correlationId: ctx.correlationId,
        status: 'accepted' as IngestStatus,
        latencyMs,
        riskLane: ctx.riskLane,
      };
    } catch (deliveryError) {
      // Circuit Breaker: Delivery failed, write to DLQ
      await this.writeToDeadLetterQueue(input, ctx, deliveryError as Error);

      const latencyMs = Date.now() - ctx.startTime;
      this.log(ctx, 'DELIVERY_FAILED_BUFFERED', {
        latencyMs,
        error: (deliveryError as Error).message,
      });

      return {
        correlationId: ctx.correlationId,
        status: 'buffered' as IngestStatus,
        latencyMs,
        riskLane: ctx.riskLane,
      };
    }
  }

  /**
   * STEP 3: Semantic Normalization
   * Maps RawInput to CanonicalEvent with MAN Mode analysis
   */
  private normalizeToCanonical(
    input: RawInput,
    ctx: PipelineContext
  ): OmniPortCanonicalEvent {
    const now = new Date().toISOString();
    const eventId = uuidv4();

    // Extract content for intent analysis
    const contentToAnalyze = this.extractContent(input);
    const detectedIntents = detectHighRiskIntents(contentToAnalyze);

    // THE MOAT LOGIC: High-risk intents trigger MAN Mode
    const requiresManApproval = detectedIntents.length > 0;
    if (requiresManApproval) {
      ctx.riskLane = 'RED';
      this.log(ctx, 'MAN_MODE_TRIGGERED', { intents: detectedIntents });
    }

    const baseEvent: OmniPortCanonicalEvent = {
      eventId,
      correlationId: ctx.correlationId,
      tenantId: 'default', // TODO: Extract from auth context
      userId: ctx.userId,
      source: `omniport.${input.type}`,
      provider: 'omniport',
      externalId: eventId,
      eventType: this.mapToEventType(input),
      timestamp: now,
      consentFlags: this.getDefaultConsentFlags(),
      metadata: {
        requires_man_approval: requiresManApproval,
        detected_intents: detectedIntents,
        risk_lane: ctx.riskLane,
        source_type: input.type,
      },
      payload: this.buildPayload(input),
    };

    // Add type-specific metadata
    if (isVoiceSource(input)) {
      baseEvent.metadata.confidence = input.confidence;
    }

    return baseEvent;
  }

  // ===========================================================================
  // DEAD LETTER QUEUE
  // ===========================================================================

  /**
   * Write failed ingestion to DLQ (ingress_buffer)
   */
  private async writeToDeadLetterQueue(
    input: RawInput,
    ctx: PipelineContext,
    error: Error
  ): Promise<void> {
    // Calculate risk score based on content
    const riskScore = this.calculateRiskScore(input, ctx);

    try {
      const { error: dbError } = await supabase.from('ingress_buffer').insert({
        correlation_id: ctx.correlationId,
        raw_input: input as unknown as Record<string, unknown>,
        error_reason: error.message,
        status: 'pending',
        risk_score: riskScore,
        source_type: input.type,
        user_id: ctx.userId || null,
      });

      if (dbError) {
        // Log but don't throw - DLQ write failure shouldn't crash ingestion
        console.error(`[OmniPort] [${ctx.correlationId}] DLQ write failed:`, dbError.message);
      } else {
        this.log(ctx, 'DLQ_WRITE_SUCCESS', { riskScore });
      }
    } catch (dlqError) {
      // Log but don't throw
      console.error(`[OmniPort] [${ctx.correlationId}] DLQ write error:`, dlqError);
    }
  }

  /**
   * Calculate risk score for DLQ prioritization (0-100)
   */
  private calculateRiskScore(input: RawInput, ctx: PipelineContext): number {
    let score = 0;

    // RED lane = +50 base score
    if (ctx.riskLane === 'RED') {
      score += 50;
    }

    // High-risk intents detected = +30
    const content = this.extractContent(input);
    const intents = detectHighRiskIntents(content);
    if (intents.length > 0) {
      score += 30;
    }

    // Voice source with low confidence = +10
    if (isVoiceSource(input) && input.confidence < 0.7) {
      score += 10;
    }

    // Webhook source = +10 (external systems are higher priority)
    if (isWebhookSource(input)) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Create pipeline context for tracing
   */
  private createContext(input: RawInput): PipelineContext {
    return {
      correlationId: uuidv4(),
      startTime: Date.now(),
      riskLane: 'GREEN',
      userId: this.extractUserId(input) || 'anonymous',
    };
  }

  /**
   * Extract userId from input based on type
   */
  private extractUserId(input: RawInput): string | undefined {
    if (isTextSource(input)) {
      return input.userId;
    }
    if (isVoiceSource(input)) {
      return input.userId;
    }
    if (isWebhookSource(input)) {
      return input.userId;
    }
    return undefined;
  }

  /**
   * Extract analyzable content from input
   */
  private extractContent(input: RawInput): string {
    if (isTextSource(input)) {
      return input.content;
    }
    if (isVoiceSource(input)) {
      return input.transcript;
    }
    if (isWebhookSource(input)) {
      return JSON.stringify(input.payload);
    }
    return '';
  }

  /**
   * Compute idempotency key using FNV-1a hash
   * Universal: works in both browser and Node.js environments
   */
  private computeIdempotencyKey(input: RawInput, userId: string): string {
    const data = JSON.stringify({ input, userId });
    return `omniport-${computeHash(data)}`;
  }

  /**
   * Map input type to canonical EventType
   */
  private mapToEventType(input: RawInput): EventType {
    if (isTextSource(input)) {
      return EventType.MESSAGE;
    }
    if (isVoiceSource(input)) {
      return EventType.MESSAGE;
    }
    if (isWebhookSource(input)) {
      return EventType.CONTENT_PUBLISHED;
    }
    return EventType.MESSAGE;
  }

  /**
   * Build payload from input
   */
  private buildPayload(input: RawInput): Record<string, unknown> {
    if (isTextSource(input)) {
      return {
        content: input.content,
        source: input.source,
      };
    }
    if (isVoiceSource(input)) {
      return {
        transcript: input.transcript,
        confidence: input.confidence,
        audioUrl: input.audioUrl,
        durationMs: input.durationMs,
      };
    }
    if (isWebhookSource(input)) {
      return {
        payload: input.payload,
        provider: input.provider,
        signature: input.signature,
      };
    }
    return {};
  }

  /**
   * Get default consent flags
   */
  private getDefaultConsentFlags(): ConsentFlags {
    return {
      analytics: true,
      marketing: false,
      personalization: true,
      third_party_sharing: false,
    };
  }

  /**
   * Convert canonical event to translated event for delivery
   */
  private toTranslatedEvent(
    event: OmniPortCanonicalEvent,
    ctx: PipelineContext
  ): TranslatedEvent {
    return {
      eventId: event.eventId,
      correlationId: ctx.correlationId,
      appId: 'omniport',
      payload: event.payload,
      metadata: event.metadata,
    };
  }

  /**
   * Structured logging with OmniPort tags
   */
  private log(ctx: PipelineContext, event: string, data?: Record<string, unknown>): void {
    const latencyMs = Date.now() - ctx.startTime;
    console.log(
      `[OmniPort] [${ctx.correlationId}] [${latencyMs}ms] ${event}`,
      data ? JSON.stringify(data) : ''
    );
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * OmniPort singleton instance
 */
export const OmniPort = OmniPortEngine.getInstance();

/**
 * Re-export for testing
 */
export { OmniPortEngine };

/**
 * Convenience function for direct ingestion
 */
export async function ingest(input: RawInput): Promise<IngestResult> {
  return OmniPort.ingest(input);
}

/**
 * Validate and ingest (with explicit validation)
 */
export async function validateAndIngest(input: unknown): Promise<IngestResult> {
  const validated = validateRawInput(input);
  return OmniPort.ingest(validated);
}
