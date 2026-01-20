/**
 * MAESTRO Execution Engine
 *
 * Fail-closed execution with:
 * - Allowlisted actions only
 * - Prompt injection detection
 * - Translation verification
 * - Idempotency enforcement
 * - Risk event logging
 *
 * Phase 5: Execution & Safety
 */

import type { ExecutionIntent, RiskLane } from '../types';
import { validateExecutionIntent } from '../utils/validation';
import { checkInputSafety } from '../safety/injection-detection';
import {
  logInjectionAttempt,
  logExecutionBlocked,
  createRiskEvent,
  logRiskEventWithBuffer,
} from '../safety/risk-events';

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  intent_id: string;
  outcome?: unknown;
  error?: string;
  blocked?: boolean;
  risk_events?: string[]; // IDs of logged risk events
}

/**
 * Allowlisted action definition
 */
export interface AllowlistedAction {
  name: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high';
  requires_confirmation: boolean;
  parameters_schema: Record<string, unknown>; // JSON Schema
  executor: (params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Built-in allowlisted actions
 * In production, these would be loaded from configuration
 */
const ALLOWLISTED_ACTIONS: Map<string, AllowlistedAction> = new Map([
  [
    'log_message',
    {
      name: 'log_message',
      description: 'Log a message (safe, read-only)',
      risk_level: 'low',
      requires_confirmation: false,
      parameters_schema: {
        type: 'object',
        properties: {
          message: { type: 'string', maxLength: 1000 },
          level: { type: 'string', enum: ['info', 'warn', 'error'] },
        },
        required: ['message'],
      },
      executor: async (params) => {
        const level = (params.level as string) || 'info';
        // eslint-disable-next-line no-console
        console.log(`[MAESTRO] ${level.toUpperCase()}: ${params.message}`);
        return { logged: true, timestamp: new Date().toISOString() };
      },
    },
  ],
  [
    'store_memory',
    {
      name: 'store_memory',
      description: 'Store a memory item',
      risk_level: 'low',
      requires_confirmation: false,
      parameters_schema: {
        type: 'object',
        properties: {
          content: { type: 'string', maxLength: 10000 },
          tier: { type: 'string', enum: ['core', 'working', 'episodic', 'semantic', 'procedural'] },
          locale: { type: 'string', pattern: '^[a-z]{2,3}(-[A-Z]{2})?$' },
        },
        required: ['content', 'tier', 'locale'],
      },
      executor: async (_params) => {
        // This would call useMemory.storeWithEmbedding in real implementation
        // For now, just validate and return
        return {
          stored: true,
          content_hash: 'mock-hash',
          timestamp: new Date().toISOString(),
        };
      },
    },
  ],
]);

/**
 * Register a custom allowlisted action
 *
 * @param action - Action to register
 */
export function registerAction(action: AllowlistedAction): void {
  ALLOWLISTED_ACTIONS.set(action.name, action);
}

/**
 * Get allowlisted action by name
 *
 * @param name - Action name
 * @returns Action definition or undefined
 */
export function getAllowlistedAction(name: string): AllowlistedAction | undefined {
  return ALLOWLISTED_ACTIONS.get(name);
}

/**
 * Check if action is allowlisted
 *
 * @param name - Action name
 * @returns True if allowlisted
 */
export function isActionAllowlisted(name: string): boolean {
  return ALLOWLISTED_ACTIONS.has(name);
}

/**
 * Determine risk lane based on input safety checks
 *
 * @param injectionResult - Injection detection result
 * @param translationFailed - Whether translation verification failed
 * @param actionRiskLevel - Action's inherent risk level
 * @returns Risk lane classification
 */
function determineRiskLane(
  injectionResult: { detected: boolean; blocked: boolean; risk_score: number },
  translationFailed: boolean,
  actionRiskLevel: 'low' | 'medium' | 'high'
): RiskLane {
  // Injection detected and blocked → RED
  if (injectionResult.blocked) {
    return 'RED';
  }

  // Translation verification failed → RED
  if (translationFailed) {
    return 'RED';
  }

  // Injection detected but not blocked → YELLOW
  if (injectionResult.detected && injectionResult.risk_score >= 50) {
    return 'YELLOW';
  }

  // High-risk action → YELLOW
  if (actionRiskLevel === 'high') {
    return 'YELLOW';
  }

  // Medium-risk action → YELLOW
  if (actionRiskLevel === 'medium') {
    return 'YELLOW';
  }

  // Default → GREEN
  return 'GREEN';
}

/**
 * Validate execution intent against safety checks
 *
 * @param intent - Execution intent to validate
 * @param authToken - Optional auth token for logging
 * @returns Validation result with risk assessment
 */
export async function validateIntent(
  intent: ExecutionIntent,
  authToken?: string
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  risk_lane: RiskLane;
  risk_events: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const riskEvents: string[] = [];

  // 1. Schema validation
  const schemaValidation = validateExecutionIntent(intent);
  if (!schemaValidation.valid) {
    const validationErrors = schemaValidation.errors?.join(', ') || 'Unknown validation error';
    errors.push(`Schema validation failed: ${validationErrors}`);
  }

  // 2. Check if action is allowlisted
  const action = getAllowlistedAction(intent.canonical_action);
  if (!action) {
    errors.push(`Action '${intent.canonical_action}' is not allowlisted`);

    // Log blocked action
    const riskEvent = await logExecutionBlocked({
      tenant_id: intent.tenant_id,
      trace_id: intent.trace_id,
      action: intent.canonical_action,
      reason: 'Action not allowlisted',
      risk_lane: 'RED',
      authToken,
    });
    riskEvents.push(riskEvent.event_id);

    return {
      valid: false,
      errors,
      warnings,
      risk_lane: 'RED',
      risk_events: riskEvents,
    };
  }

  // 3. Check for prompt injection in parameters
  let injectionDetected = false;
  let injectionBlocked = false;
  let maxRiskScore = 0;
  const allPatternsMatched: string[] = [];

  for (const [key, value] of Object.entries(intent.parameters)) {
    if (typeof value === 'string') {
      const safetyCheck = checkInputSafety(value, {
        maxLength: 10000,
        injectionThreshold: 70,
      });

      if (safetyCheck.injection) {
        if (safetyCheck.injection.blocked) {
          injectionBlocked = true;
          injectionDetected = true;
          errors.push(`Prompt injection detected in parameter '${key}'`);
          allPatternsMatched.push(...safetyCheck.injection.patterns_matched);
          maxRiskScore = Math.max(maxRiskScore, safetyCheck.injection.risk_score);
        } else if (safetyCheck.injection.detected) {
          injectionDetected = true;
          warnings.push(`Suspicious patterns in parameter '${key}'`);
          allPatternsMatched.push(...safetyCheck.injection.patterns_matched);
          maxRiskScore = Math.max(maxRiskScore, safetyCheck.injection.risk_score);
        }
      }

      if (safetyCheck.errors.length > 0) {
        errors.push(...safetyCheck.errors);
      }
    }
  }

  // Log injection attempt if detected
  if (injectionDetected) {
    const riskEvent = await logInjectionAttempt({
      tenant_id: intent.tenant_id,
      trace_id: intent.trace_id,
      input: JSON.stringify(intent.parameters),
      patterns_matched: allPatternsMatched,
      risk_score: maxRiskScore,
      blocked: injectionBlocked,
      blocked_action: intent.canonical_action,
      authToken,
    });
    riskEvents.push(riskEvent.event_id);
  }

  // 4. Determine risk lane
  const riskLane = determineRiskLane(
    {
      detected: injectionDetected,
      blocked: injectionBlocked,
      risk_score: maxRiskScore,
    },
    false, // Translation verification would be checked here
    action.risk_level
  );

  // 5. Check if user confirmation is required for high-risk actions
  if (action.requires_confirmation && !intent.user_confirmed) {
    errors.push(`Action '${action.name}' requires user confirmation`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    risk_lane: riskLane,
    risk_events: riskEvents,
  };
}

/**
 * Execute an intent with full safety checks
 *
 * @param intent - Execution intent
 * @param authToken - Optional auth token for logging
 * @returns Execution result
 */
export async function executeIntent(
  intent: ExecutionIntent,
  authToken?: string
): Promise<ExecutionResult> {
  const riskEvents: string[] = [];

  try {
    // 1. Validate intent
    const validation = await validateIntent(intent, authToken);
    riskEvents.push(...validation.risk_events);

    if (!validation.valid) {
      return {
        success: false,
        intent_id: intent.intent_id,
        error: validation.errors.join('; '),
        blocked: true,
        risk_events: riskEvents,
      };
    }

    // 2. RED lane → quarantine (MAN mode)
    if (validation.risk_lane === 'RED') {
      const riskEvent = await logExecutionBlocked({
        tenant_id: intent.tenant_id,
        trace_id: intent.trace_id,
        action: intent.canonical_action,
        reason: 'RED lane quarantine - requires manual review',
        risk_lane: 'RED',
        details: {
          warnings: validation.warnings,
        },
        authToken,
      });
      riskEvents.push(riskEvent.event_id);

      return {
        success: false,
        intent_id: intent.intent_id,
        error: 'Execution blocked: RED lane quarantine (manual review required)',
        blocked: true,
        risk_events: riskEvents,
      };
    }

    // 3. Get action executor
    const action = getAllowlistedAction(intent.canonical_action)!;

    // 4. Execute action
    const outcome = await action.executor(intent.parameters);

    return {
      success: true,
      intent_id: intent.intent_id,
      outcome,
      risk_events: riskEvents,
    };
  } catch (error) {
    // Log execution error
    const riskEvent = createRiskEvent({
      tenant_id: intent.tenant_id,
      event_type: 'execution_blocked',
      risk_lane: 'YELLOW',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        action: intent.canonical_action,
      },
      trace_id: intent.trace_id,
    });

    await logRiskEventWithBuffer(riskEvent, authToken);
    riskEvents.push(riskEvent.event_id);

    return {
      success: false,
      intent_id: intent.intent_id,
      error: error instanceof Error ? error.message : 'Unknown error',
      blocked: true,
      risk_events: riskEvents,
    };
  }
}

/**
 * Batch execute multiple intents with idempotency
 *
 * @param intents - Array of execution intents
 * @param authToken - Optional auth token
 * @returns Array of execution results
 */
export async function executeBatch(
  intents: ExecutionIntent[],
  authToken?: string
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  const processedKeys = new Set<string>();

  for (const intent of intents) {
    // Check for duplicate idempotency keys
    if (processedKeys.has(intent.idempotency_key)) {
      results.push({
        success: false,
        intent_id: intent.intent_id,
        error: 'Duplicate idempotency key in batch',
        blocked: true,
      });
      continue;
    }

    processedKeys.add(intent.idempotency_key);

    // Execute intent
    const result = await executeIntent(intent, authToken);
    results.push(result);

    // Stop batch on RED lane
    if (result.blocked && result.error?.includes('RED lane')) {
      break;
    }
  }

  return results;
}
