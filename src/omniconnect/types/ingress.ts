/**
 * OmniPort Ingress Type Definitions
 * =============================================================================
 * Strict runtime validation schemas for all ingress sources.
 * Uses Zod for type-safe validation at the defensive perimeter.
 * =============================================================================
 */

import { z } from 'zod';

// =============================================================================
// BASE SCHEMAS
// =============================================================================

/**
 * UUID validation schema
 */
const UUIDSchema = z.string().uuid('Invalid UUID format');

/**
 * URL validation schema
 */
const URLSchema = z.string().url('Invalid URL format');

// =============================================================================
// INPUT SOURCE SCHEMAS
// =============================================================================

/**
 * TextSource - Web and SMS text inputs
 * @example { type: 'text', content: 'Hello world', source: 'web', userId: 'uuid' }
 */
export const TextSourceSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1, 'Content cannot be empty'),
  source: z.enum(['web', 'sms'], {
    errorMap: () => ({ message: "Source must be 'web' or 'sms'" }),
  }),
  userId: UUIDSchema,
});

export type TextSource = z.infer<typeof TextSourceSchema>;

/**
 * VoiceSource - Voice transcription inputs
 * @example { type: 'voice', transcript: 'Hello', confidence: 0.95, audioUrl: 'https://...', durationMs: 1500 }
 */
export const VoiceSourceSchema = z.object({
  type: z.literal('voice'),
  transcript: z.string().min(1, 'Transcript cannot be empty'),
  confidence: z
    .number()
    .min(0, 'Confidence must be >= 0')
    .max(1, 'Confidence must be <= 1'),
  audioUrl: URLSchema,
  durationMs: z.number().int().positive('Duration must be positive'),
  userId: UUIDSchema.optional(),
});

export type VoiceSource = z.infer<typeof VoiceSourceSchema>;

/**
 * WebhookSource - External webhook payloads
 * @example { type: 'webhook', payload: {...}, provider: 'stripe', signature: 'sha256=...' }
 */
export const WebhookSourceSchema = z.object({
  type: z.literal('webhook'),
  payload: z.record(z.unknown()),
  provider: z.string().min(1, 'Provider cannot be empty'),
  signature: z.string().min(1, 'Signature cannot be empty'),
  userId: UUIDSchema.optional(),
});

export type WebhookSource = z.infer<typeof WebhookSourceSchema>;

/**
 * RawInput - Discriminated union of all input sources
 * Validates at runtime to ensure type-safe processing
 */
export const RawInputSchema = z.discriminatedUnion('type', [
  TextSourceSchema,
  VoiceSourceSchema,
  WebhookSourceSchema,
]);

export type RawInput = z.infer<typeof RawInputSchema>;

// =============================================================================
// RESULT SCHEMAS
// =============================================================================

/**
 * Risk lane classification for governance routing
 * - GREEN: Standard processing, no elevated risk
 * - RED: Elevated risk, may require MAN Mode approval
 */
export const RiskLaneSchema = z.enum(['GREEN', 'RED']);
export type RiskLane = z.infer<typeof RiskLaneSchema>;

/**
 * Ingestion status indicating processing outcome
 * - accepted: Successfully processed and delivered
 * - blocked: Rejected by security gate (Zero-Trust)
 * - buffered: Delivery failed, queued in DLQ for retry
 */
export const IngestStatusSchema = z.enum(['accepted', 'blocked', 'buffered']);
export type IngestStatus = z.infer<typeof IngestStatusSchema>;

/**
 * IngestResult - The outcome of an ingestion attempt
 */
export const IngestResultSchema = z.object({
  correlationId: z.string().min(1),
  status: IngestStatusSchema,
  latencyMs: z.number().int().nonnegative(),
  riskLane: RiskLaneSchema,
});

export type IngestResult = z.infer<typeof IngestResultSchema>;

// =============================================================================
// DLQ SCHEMAS (for database operations)
// =============================================================================

/**
 * DLQ Entry status
 */
export const DLQStatusSchema = z.enum(['pending', 'replaying', 'failed']);
export type DLQStatus = z.infer<typeof DLQStatusSchema>;

/**
 * DLQ Entry - Dead Letter Queue record
 */
export const DLQEntrySchema = z.object({
  id: UUIDSchema,
  correlationId: z.string(),
  rawInput: RawInputSchema,
  errorReason: z.string(),
  status: DLQStatusSchema,
  riskScore: z.number().int().min(0).max(100),
  createdAt: z.date(),
  retryCount: z.number().int().nonnegative().default(0),
  lastRetryAt: z.date().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  userId: UUIDSchema.nullable().optional(),
});

export type DLQEntry = z.infer<typeof DLQEntrySchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates raw input and returns parsed result or throws
 * @param input Unknown input to validate
 * @returns Validated RawInput
 * @throws z.ZodError if validation fails
 */
export function validateRawInput(input: unknown): RawInput {
  return RawInputSchema.parse(input);
}

/**
 * Safe validation that returns result with error info
 * @param input Unknown input to validate
 * @returns SafeParseResult with success flag and data/error
 */
export function safeValidateRawInput(input: unknown): z.SafeParseReturnType<unknown, RawInput> {
  return RawInputSchema.safeParse(input);
}

/**
 * Type guard to check if input is TextSource
 */
export function isTextSource(input: RawInput): input is TextSource {
  return input.type === 'text';
}

/**
 * Type guard to check if input is VoiceSource
 */
export function isVoiceSource(input: RawInput): input is VoiceSource {
  return input.type === 'voice';
}

/**
 * Type guard to check if input is WebhookSource
 */
export function isWebhookSource(input: RawInput): input is WebhookSource {
  return input.type === 'webhook';
}

// =============================================================================
// HIGH-RISK INTENT KEYWORDS (MAN Mode Triggers)
// =============================================================================

/**
 * Keywords that trigger MAN Mode (Manual Approval Node)
 * These intents require human oversight before execution
 */
export const HIGH_RISK_INTENTS = ['delete', 'transfer', 'grant_access'] as const;

export type HighRiskIntent = (typeof HIGH_RISK_INTENTS)[number];

/**
 * Check if content contains high-risk intents
 * @param content The content to analyze
 * @returns Array of detected high-risk intents
 */
export function detectHighRiskIntents(content: string): HighRiskIntent[] {
  const lowerContent = content.toLowerCase();
  return HIGH_RISK_INTENTS.filter((intent) => lowerContent.includes(intent));
}

// =============================================================================
// SECURITY ERROR
// =============================================================================

/**
 * Custom error for security-related rejections
 */
export class SecurityError extends Error {
  public readonly code: string;
  public readonly deviceId?: string;
  public readonly userId?: string;

  constructor(
    message: string,
    code: string = 'SECURITY_BLOCKED',
    deviceId?: string,
    userId?: string
  ) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.deviceId = deviceId;
    this.userId = userId;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SecurityError);
    }
  }
}
