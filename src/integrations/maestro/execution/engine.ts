/**
 * MAESTRO Execution Engine
 * Validates and executes intents with risk-based routing
 */

import type {
  MaestroIntent,
  ValidationResult,
  ExecutionResult,
  RiskLane,
  MANModeRequest,
  MANModeResponse,
} from '../types';
import {
  ALLOWLISTED_ACTIONS,
  BCP47_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
} from '../types';
import { detectInjection } from '../safety/injection-detection';
import { logRiskEvent } from '../safety/risk-events';

// Custom action registry
const customActions = new Set<string>();

/**
 * Check if an action is allowlisted
 */
export function isActionAllowlisted(action: string): boolean {
  return (
    (ALLOWLISTED_ACTIONS as readonly string[]).includes(action) ||
    customActions.has(action)
  );
}

/**
 * Register a custom action as allowlisted
 */
export function registerCustomAction(action: string): void {
  customActions.add(action);
}

/**
 * Clear custom actions (for testing)
 */
export function clearCustomActions(): void {
  customActions.clear();
}

/**
 * Validate an intent for execution
 */
export async function validateIntent(
  intent: MaestroIntent
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let riskLane: RiskLane = 'GREEN';

  // Schema validation - idempotency_key format
  if (!intent.idempotency_key || !IDEMPOTENCY_KEY_PATTERN.test(intent.idempotency_key)) {
    errors.push('Schema validation failed: /idempotency_key must match pattern "^[a-f0-9]{64}$"');
    riskLane = 'RED';
  }

  // Validate identity fields
  if (!intent.identity?.tenant_id || !intent.identity?.user_id || !intent.identity?.session_id) {
    errors.push('Missing required identity fields');
    riskLane = 'RED';
  }

  // Validate locale format (BCP-47)
  if (intent.identity?.locale && !BCP47_PATTERN.test(intent.identity.locale)) {
    errors.push('Invalid locale format - must be BCP-47 compliant');
    riskLane = 'RED';
  }

  // Validate confidence range
  if (intent.confidence < 0 || intent.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
    riskLane = 'RED';
  }

  // Check action allowlist
  if (!isActionAllowlisted(intent.action)) {
    errors.push(`Action '${intent.action}' is not allowlisted`);
    riskLane = 'RED';

    await logRiskEvent({
      event_type: 'execution_blocked',
      risk_lane: 'RED',
      tenant_id: intent.identity?.tenant_id || 'unknown',
      details: { reason: 'Action not allowlisted' },
      blocked_action: intent.action,
      trace_id: intent.intent_id,
    });
  }

  // Check for injection in parameters
  const paramString = JSON.stringify(intent.parameters);
  const injectionResult = detectInjection(paramString);

  if (injectionResult.blocked) {
    errors.push('Potential injection detected in parameters');
    riskLane = 'RED';

    await logRiskEvent({
      event_type: 'injection_attempt',
      risk_lane: 'RED',
      tenant_id: intent.identity?.tenant_id || 'unknown',
      details: {
        input_preview: paramString.slice(0, 100),
        patterns_matched: injectionResult.patterns_matched,
        risk_score: injectionResult.risk_score,
        blocked: true,
      },
      blocked_action: intent.action,
      trace_id: intent.intent_id,
    });
  } else if (injectionResult.detected) {
    warnings.push(...injectionResult.warnings);
    if (riskLane === 'GREEN') {
      riskLane = 'YELLOW';
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    risk_lane: riskLane,
  };
}

/**
 * Execute a validated intent
 */
export async function executeIntent(
  intent: MaestroIntent
): Promise<ExecutionResult> {
  // First validate the intent
  const validation = await validateIntent(intent);

  if (!validation.valid) {
    return {
      success: false,
      intent_id: intent.intent_id,
      error: validation.errors.join('; '),
      blocked: validation.risk_lane === 'RED',
      risk_lane: validation.risk_lane,
    };
  }

  // Check translation status
  if (intent.translation_status === 'FAILED') {
    return {
      success: false,
      intent_id: intent.intent_id,
      error: 'Translation failed',
      blocked: true,
      risk_lane: 'RED',
    };
  }

  // Check user confirmation for high-risk actions
  if (!intent.user_confirmed && validation.risk_lane === 'YELLOW') {
    return {
      success: false,
      intent_id: intent.intent_id,
      error: 'User confirmation required for this action',
      blocked: false,
      risk_lane: 'YELLOW',
    };
  }

  // Check confidence threshold
  if (intent.confidence < 0.7) {
    return {
      success: false,
      intent_id: intent.intent_id,
      error: 'Confidence below threshold',
      blocked: true,
      risk_lane: 'RED',
    };
  }

  // Execute the action (mock execution for now)
  try {
    const outcome = await performAction(intent);
    return {
      success: true,
      intent_id: intent.intent_id,
      outcome,
      risk_lane: validation.risk_lane,
    };
  } catch (error) {
    return {
      success: false,
      intent_id: intent.intent_id,
      error: error instanceof Error ? error.message : 'Unknown error',
      risk_lane: validation.risk_lane,
    };
  }
}

/**
 * Execute a batch of intents, stopping on RED lane detection
 */
export async function executeBatch(
  intents: MaestroIntent[]
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  // Check for duplicate idempotency keys
  const keys = new Set<string>();
  for (const intent of intents) {
    if (keys.has(intent.idempotency_key)) {
      throw new Error(`Duplicate idempotency key: ${intent.idempotency_key}`);
    }
    keys.add(intent.idempotency_key);
  }

  for (const intent of intents) {
    const result = await executeIntent(intent);
    results.push(result);

    // Stop batch on RED lane
    if (result.risk_lane === 'RED' && result.blocked) {
      break;
    }
  }

  return results;
}

/**
 * Request MAN (Manual Approval Needed) mode escalation
 */
export async function requestMANMode(
  request: MANModeRequest
): Promise<MANModeResponse> {
  console.warn('[MAESTRO] Escalating to MAN mode:', request.reason, {
    intent: request.intent.intent_id,
  });

  // In a real implementation, this would notify human operators
  // For now, we simulate a rejection for testing
  return {
    approved: false,
    notes: 'MAN mode escalation simulated - requires human approval',
  };
}

/**
 * Perform the actual action (mock implementation)
 */
async function performAction(
  intent: MaestroIntent
): Promise<Record<string, unknown>> {
  // Mock implementations for allowlisted actions
  switch (intent.action) {
    case 'log_message':
      // eslint-disable-next-line no-console -- intentional logging action
      console.info('[MAESTRO] INFO:', intent.parameters.message);
      return { logged: true, timestamp: new Date().toISOString() };

    case 'get_status':
      return { status: 'healthy', timestamp: new Date().toISOString() };

    case 'list_items':
      return { items: [], count: 0 };

    case 'read_data':
      return { data: null, found: false };

    case 'fetch_config':
      return { config: {}, version: '1.0.0' };

    case 'health_check':
      return { healthy: true, checks: [] };

    case 'validate_input':
      return { valid: true, errors: [] };

    case 'compute_hash':
      return { hash: 'mock-hash', algorithm: 'sha256' };

    case 'format_output':
      return { formatted: intent.parameters.input || '', format: 'text' };

    default:
      throw new Error(`Unknown action: ${intent.action}`);
  }
}
