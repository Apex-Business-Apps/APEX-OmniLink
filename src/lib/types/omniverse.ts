/**
 * OmniVerse Types - Single Source of Truth
 *
 * Defines the strict data contract for the APEX OmniHub event-driven
 * architecture. These types are shared between frontend and edge functions.
 *
 * Author: APEX CTO
 * Date: 2026-01-25
 * Architecture: Event Sourcing + Saga Pattern
 */

/**
 * Represents a discrete event in the agent execution lifecycle.
 * Used for real-time streaming and audit trails.
 */
export interface AgentEvent {
  /** Unique identifier for this event (UUID v4) */
  id: string;
  /** Event type categorizing the agent action */
  type:
    | 'goal_received'
    | 'plan_generated'
    | 'tool_executed'
    | 'risk_assessment'
    | 'completion';
  /** Event-specific payload (varies by type) */
  payload: Record<string, unknown>;
  /** ISO 8601 timestamp of event creation */
  timestamp: string;
  /** Session identifier for grouping related events */
  session_id: string;
  /** Monotonically increasing sequence for ordering */
  sequence_id: number;
  /** Optional user ID for RLS filtering */
  user_id?: string;
}

/**
 * Request payload for triggering a workflow via the Edge Gateway.
 * Enforces idempotency and provides conversation context.
 */
export interface WorkflowRequest {
  /** The user's query or instruction */
  query: string;
  /** Conversation history for context */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Session identifier for event correlation */
  session_id: string;
  /** Idempotency key to prevent double-billing (UUID v4) */
  idempotency_key: string;
}

/**
 * Response from the Edge Gateway after workflow initiation.
 * Provides cryptographic proof of request acceptance.
 */
export interface WorkflowResponse {
  /** Workflow identifier for tracking (correlates to Temporal workflow ID) */
  workflow_id: string;
  /** Current workflow status */
  status: 'queued' | 'active';
  /** SHA-256 hash of request for integrity verification */
  request_hash: string;
}

/**
 * Message structure for conversation threads.
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  structured?: ApexStructuredResponse;
  timestamp?: string;
}

/**
 * Structured response format from APEX agent.
 */
export interface ApexStructuredResponse {
  summary: string[];
  details: Array<{
    n: number;
    finding: string;
    source_url: string;
  }>;
  next_actions: string[];
  sources_used: string[];
  notes?: string;
}

/**
 * Type guard to check if a value is an AgentEvent
 */
export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.session_id === 'string' &&
    typeof obj.sequence_id === 'number'
  );
}

/**
 * Type guard to check if a value is an ApexStructuredResponse
 */
export function isApexStructuredResponse(
  value: unknown
): value is ApexStructuredResponse {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.summary) &&
    Array.isArray(obj.details) &&
    Array.isArray(obj.next_actions) &&
    Array.isArray(obj.sources_used)
  );
}
