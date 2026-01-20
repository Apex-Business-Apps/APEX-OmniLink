/**
 * MAESTRO Types - Multi-Agent Execution with Safe Translation and Risk Orchestration
 */

export type RiskLane = 'GREEN' | 'YELLOW' | 'RED' | 'BLOCKED';

export type TranslationStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface MaestroIdentity {
  tenant_id: string;
  user_id: string;
  session_id: string;
  locale: string;
}

export interface MaestroIntent {
  intent_id: string;
  idempotency_key: string;
  action: string;
  parameters: Record<string, unknown>;
  identity: MaestroIdentity;
  translation_status: TranslationStatus;
  confidence: number;
  user_confirmed: boolean;
  risk_lane?: RiskLane;
  created_at?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  risk_lane: RiskLane;
}

export interface ExecutionResult {
  success: boolean;
  intent_id: string;
  outcome?: Record<string, unknown>;
  error?: string;
  blocked?: boolean;
  risk_lane?: RiskLane;
}

export interface InjectionDetectionResult {
  detected: boolean;
  blocked: boolean;
  patterns_matched: string[];
  risk_score: number;
  warnings: string[];
}

export interface RiskEvent {
  event_id: string;
  tenant_id: string;
  event_type: string;
  risk_lane: RiskLane;
  details: Record<string, unknown>;
  blocked_action?: string;
  trace_id: string;
  created_at: string;
}

export interface MANModeRequest {
  intent: MaestroIntent;
  reason: string;
  escalation_time: string;
}

export interface MANModeResponse {
  approved: boolean;
  approver_id?: string;
  notes?: string;
}

// Allowlisted actions that are considered safe
export const ALLOWLISTED_ACTIONS = [
  'log_message',
  'get_status',
  'list_items',
  'read_data',
  'fetch_config',
  'health_check',
  'validate_input',
  'compute_hash',
  'format_output',
] as const;

export type AllowlistedAction = (typeof ALLOWLISTED_ACTIONS)[number];

// BCP-47 locale pattern
export const BCP47_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/;

// Idempotency key pattern - 64 hex characters (SHA-256 hash)
export const IDEMPOTENCY_KEY_PATTERN = /^[a-f0-9]{64}$/;
