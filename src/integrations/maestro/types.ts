/**
 * MAESTRO TypeScript Type Definitions
 *
 * Core types for browser-only compute memory system.
 */

import { MAESTRO_STORES, RISK_LANES } from './config';

/**
 * Memory tier types
 */
export type MemoryTier =
  | typeof MAESTRO_STORES.CORE
  | typeof MAESTRO_STORES.WORKING
  | typeof MAESTRO_STORES.EPISODIC
  | typeof MAESTRO_STORES.SEMANTIC
  | typeof MAESTRO_STORES.PROCEDURAL;

/**
 * Risk lane types
 */
export type RiskLane =
  | typeof RISK_LANES.GREEN
  | typeof RISK_LANES.YELLOW
  | typeof RISK_LANES.RED;

/**
 * BCP-47 locale string (e.g., "en-CA", "th-TH", "fr-FR")
 */
export type LocaleString = string;

/**
 * Canonical Event - stable envelope for all MAESTRO events
 */
export interface CanonicalEvent {
  tenant_id: string;
  subject_id: string;
  scope: string;
  locale: LocaleString;
  type: string;
  created_at: string; // ISO 8601
  trace_id: string;
  source: string;
  content_ciphertext?: string; // Client-only (never sent to server as plaintext)
  content_hash: string; // SHA-256 of ciphertext
  provenance_refs: string[];
  risk_lane: RiskLane;
  metadata?: Record<string, unknown>;
}

/**
 * Memory Item - stored in IndexedDB tiers
 */
export interface MemoryItem {
  id: string;
  tier: MemoryTier;
  locale: LocaleString;
  content: string; // Plaintext (local-only)
  content_hash: string; // SHA-256 of content
  embedding?: number[]; // For semantic tier
  provenance_refs: string[];
  created_at: string; // ISO 8601
  expires_at?: string; // ISO 8601 (for working tier)
  key_version: number;
  metadata?: Record<string, unknown>;
}

/**
 * Memory Delta - change to be applied to a tier
 */
export interface MemoryDelta {
  operation: 'insert' | 'update' | 'delete' | 'compact';
  tier: MemoryTier;
  item?: MemoryItem;
  item_id?: string;
  reason: string;
  trace_id: string;
}

/**
 * Grounding Result - memory retrieval result
 */
export interface GroundingResult {
  items: MemoryItem[];
  query: string;
  locale: LocaleString;
  similarity_scores?: number[];
  trace_id: string;
  retrieved_at: string; // ISO 8601
}

/**
 * MAESTRO Plan - proposed actions (not yet executed)
 */
export interface MaestroPlan {
  plan_id: string;
  steps: PlanStep[];
  risk_lane: RiskLane;
  requires_confirmation: boolean;
  trace_id: string;
  created_at: string; // ISO 8601
}

export interface PlanStep {
  step_id: string;
  action: string;
  parameters: Record<string, unknown>;
  risk_assessment: string;
  rollback_action?: string;
}

/**
 * Execution Intent - validated request to execute an action
 */
export interface ExecutionIntent {
  intent_id: string;
  tenant_id: string;
  idempotency_key: string;
  canonical_action: string;
  canonical_object: string;
  parameters: Record<string, unknown>;
  risk_lane: RiskLane;
  trace_id: string;
  source_event_id: string;
  recipe_version?: string;
  user_confirmed: boolean;
  created_at: string; // ISO 8601
}

/**
 * Risk Event - security/safety event
 */
export interface RiskEvent {
  event_id: string;
  tenant_id: string;
  event_type: 'injection_attempt' | 'translation_failed' | 'quota_exceeded' | 'suspicious_activity';
  risk_lane: RiskLane;
  details: Record<string, unknown>;
  blocked_action?: string;
  trace_id: string;
  created_at: string; // ISO 8601
}

/**
 * Translation Verification Result
 */
export interface TranslationVerification {
  original_text: string;
  original_locale: LocaleString;
  translated_text: string;
  target_locale: LocaleString;
  back_translated_text: string;
  similarity_score: number;
  threshold: number;
  passed: boolean;
  translation_status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

/**
 * Inference Budget - deterministic limits
 */
export interface InferenceBudget {
  max_tokens: number;
  max_embeddings: number;
  timeout_ms: number;
  used_tokens: number;
  used_embeddings: number;
  exceeded: boolean;
}

/**
 * Encryption Key Metadata
 */
export interface EncryptionKeyMetadata {
  key_version: number;
  algorithm: 'AES-GCM';
  key_derivation?: 'PBKDF2';
  passphrase_verifier?: string; // For cross-device decrypt
  created_at: string; // ISO 8601
}

/**
 * Sync Request - client → server (ciphertext only)
 */
export interface SyncRequest {
  tenant_id: string;
  trace_id: string;
  idempotency_key: string;
  event_type: 'memory_sync' | 'execution_request';
  content_ciphertext: string; // Base64-encoded ciphertext
  content_hash: string; // SHA-256 of ciphertext
  metadata: {
    locale: LocaleString;
    tier?: MemoryTier;
    key_version: number;
  };
}

/**
 * Sync Response - server → client
 */
export interface SyncResponse {
  status: 'ok' | 'duplicate' | 'error';
  receipt_id?: string;
  outcome_ref?: string; // If duplicate
  error?: string;
}

/**
 * MAESTRO Health Check Response
 */
export interface MaestroHealthResponse {
  enabled: boolean;
  status: 'healthy' | 'degraded' | 'offline';
  checks: {
    indexeddb: { status: 'ok' | 'error'; db_size_mb?: number; error?: string };
    webgpu: { status: 'ok' | 'unavailable' | 'error'; adapter?: string; error?: string };
    wasm: { status: 'ok' | 'error'; error?: string };
    service_worker: {
      status: 'ok' | 'error';
      cached_models?: number;
      error?: string;
    };
    sync: { status: 'ok' | 'error'; last_sync?: string; error?: string };
  };
  queue_depth: number;
  dlq_count: number;
}
