/**
 * MAESTRO Orchestrator Types
 *
 * Extended types for execution orchestration with translation,
 * confidence scoring, and locale support.
 */

/**
 * Extended ExecutionIntent with orchestration metadata
 */
export interface ExecutionIntent {
  tenant_id: string;
  subject_id: string;
  trace_id: string;
  created_at: string;
  locale: string;
  canonical_action_type: string;
  canonical_object_id: string;
  risk_lane: 'GREEN' | 'YELLOW' | 'RED' | 'BLOCKED';
  translation_status: 'OK' | 'FAILED' | 'PENDING';
  confidence: number;
  user_confirmed: boolean;
  idempotency_key: string;
  params: Record<string, unknown>;
}

/**
 * Execution result returned by adapter
 */
export interface ExecutionResult {
  success: boolean;
  receipt?: string;
  result?: unknown;
  error?: string;
}
