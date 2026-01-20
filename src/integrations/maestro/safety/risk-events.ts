/**
 * MAESTRO Risk Event Logging
 *
 * Logs security and safety events to maestro_audit table.
 * Fail-closed: errors in logging do not block execution, but are reported.
 *
 * Phase 5: Execution & Safety
 */

import type { RiskEvent, RiskLane } from '../types';
import { createClient } from '@supabase/supabase-js';

/**
 * Risk event types
 */
export type RiskEventType =
  | 'injection_attempt'
  | 'translation_failed'
  | 'quota_exceeded'
  | 'suspicious_activity'
  | 'execution_blocked'
  | 'validation_failed'
  | 'rate_limit_exceeded'
  | 'unauthorized_action';

/**
 * Create a risk event
 *
 * @param params - Risk event parameters
 * @returns Created risk event
 */
export function createRiskEvent(params: {
  tenant_id: string;
  event_type: RiskEventType;
  risk_lane: RiskLane;
  details: Record<string, unknown>;
  blocked_action?: string;
  trace_id: string;
}): RiskEvent {
  return {
    event_id: crypto.randomUUID(),
    tenant_id: params.tenant_id,
    event_type: params.event_type,
    risk_lane: params.risk_lane,
    details: params.details,
    blocked_action: params.blocked_action,
    trace_id: params.trace_id,
    created_at: new Date().toISOString(),
  };
}

/**
 * Log risk event to maestro_audit table
 *
 * @param event - Risk event to log
 * @param authToken - Optional auth token for authenticated logging
 * @returns Success status
 */
export async function logRiskEvent(
  event: RiskEvent,
  authToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[MAESTRO] Supabase not configured, risk event not logged:', event);
      return { success: false, error: 'Supabase not configured' };
    }

    const headers: Record<string, string> = {
      apikey: supabaseAnonKey,
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers },
    });

    const { error } = await supabase.from('maestro_audit').insert({
      tenant_id: event.tenant_id,
      trace_id: event.trace_id,
      event_type: event.event_type,
      risk_lane: event.risk_lane,
      content_hash: null, // Risk events don't have content hash
      metadata: {
        event_id: event.event_id,
        blocked_action: event.blocked_action,
        details: event.details,
        created_at: event.created_at,
      },
    });

    if (error) {
      console.error('[MAESTRO] Failed to log risk event:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[MAESTRO] Exception logging risk event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * In-memory risk event buffer for offline scenarios
 * Events are stored locally and synced when connection is restored
 */
class RiskEventBuffer {
  private buffer: RiskEvent[] = [];
  private readonly maxSize = 100;

  add(event: RiskEvent): void {
    this.buffer.push(event);

    // Enforce max size (FIFO)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    // Persist to localStorage
    this.persist();
  }

  getAll(): RiskEvent[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem('maestro_risk_events', JSON.stringify(this.buffer));
    } catch (error) {
      console.warn('[MAESTRO] Failed to persist risk events to localStorage:', error);
    }
  }

  load(): void {
    try {
      const stored = localStorage.getItem('maestro_risk_events');
      if (stored) {
        this.buffer = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[MAESTRO] Failed to load risk events from localStorage:', error);
    }
  }

  async sync(authToken?: string): Promise<{ synced: number; failed: number }> {
    const events = this.getAll();
    let synced = 0;
    let failed = 0;

    for (const event of events) {
      const result = await logRiskEvent(event, authToken);
      if (result.success) {
        synced++;
      } else {
        failed++;
      }
    }

    // Clear successfully synced events
    if (synced > 0 && failed === 0) {
      this.clear();
    }

    return { synced, failed };
  }
}

// Singleton instance
export const riskEventBuffer = new RiskEventBuffer();

// Load buffered events on initialization
if (typeof window !== 'undefined') {
  riskEventBuffer.load();
}

/**
 * Log risk event with automatic buffering for offline scenarios
 *
 * @param event - Risk event to log
 * @param authToken - Optional auth token
 * @returns Success status
 */
export async function logRiskEventWithBuffer(
  event: RiskEvent,
  authToken?: string
): Promise<{ success: boolean; buffered: boolean; error?: string }> {
  // Try to log immediately
  const result = await logRiskEvent(event, authToken);

  if (result.success) {
    return { success: true, buffered: false };
  }

  // If logging failed, buffer the event
  riskEventBuffer.add(event);

  return {
    success: false,
    buffered: true,
    error: result.error,
  };
}

/**
 * Create and log an injection attempt risk event
 *
 * @param params - Injection attempt parameters
 * @param authToken - Optional auth token
 * @returns Risk event
 */
export async function logInjectionAttempt(params: {
  tenant_id: string;
  trace_id: string;
  input: string;
  patterns_matched: string[];
  risk_score: number;
  blocked: boolean;
  blocked_action?: string;
  authToken?: string;
}): Promise<RiskEvent> {
  const event = createRiskEvent({
    tenant_id: params.tenant_id,
    event_type: 'injection_attempt',
    risk_lane: params.blocked ? 'RED' : 'YELLOW',
    details: {
      input_preview: params.input.substring(0, 200), // Store preview only
      patterns_matched: params.patterns_matched,
      risk_score: params.risk_score,
      blocked: params.blocked,
    },
    blocked_action: params.blocked_action,
    trace_id: params.trace_id,
  });

  await logRiskEventWithBuffer(event, params.authToken);

  return event;
}

/**
 * Create and log a translation failure risk event
 *
 * @param params - Translation failure parameters
 * @param authToken - Optional auth token
 * @returns Risk event
 */
export async function logTranslationFailure(params: {
  tenant_id: string;
  trace_id: string;
  source_text: string;
  source_lang: string;
  target_lang: string;
  similarity_score: number;
  threshold: number;
  authToken?: string;
}): Promise<RiskEvent> {
  const event = createRiskEvent({
    tenant_id: params.tenant_id,
    event_type: 'translation_failed',
    risk_lane: 'YELLOW',
    details: {
      source_preview: params.source_text.substring(0, 200),
      source_lang: params.source_lang,
      target_lang: params.target_lang,
      similarity_score: params.similarity_score,
      threshold: params.threshold,
    },
    trace_id: params.trace_id,
  });

  await logRiskEventWithBuffer(event, params.authToken);

  return event;
}

/**
 * Create and log an execution blocked risk event
 *
 * @param params - Execution blocked parameters
 * @param authToken - Optional auth token
 * @returns Risk event
 */
export async function logExecutionBlocked(params: {
  tenant_id: string;
  trace_id: string;
  action: string;
  reason: string;
  risk_lane: RiskLane;
  details?: Record<string, unknown>;
  authToken?: string;
}): Promise<RiskEvent> {
  const event = createRiskEvent({
    tenant_id: params.tenant_id,
    event_type: 'execution_blocked',
    risk_lane: params.risk_lane,
    details: {
      reason: params.reason,
      ...params.details,
    },
    blocked_action: params.action,
    trace_id: params.trace_id,
  });

  await logRiskEventWithBuffer(event, params.authToken);

  return event;
}
