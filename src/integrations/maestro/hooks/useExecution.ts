/**
 * MAESTRO Execution Hook
 *
 * React hook for executing intents with full safety checks.
 * Integrates with MaestroProvider for enabled/initialized state.
 *
 * Phase 5: Execution & Safety - Full Implementation
 */

import { useCallback, useState } from 'react';
import { useMaestroContext } from '../providers/MaestroProvider';
import type { ExecutionIntent } from '../types';
import {
  executeIntent,
  executeBatch,
  validateIntent,
  isActionAllowlisted,
  type ExecutionResult,
} from '../execution/engine';

/**
 * Execution Hook Return Type
 */
export interface UseExecutionReturn {
  /**
   * Execute an intent with full safety checks
   */
  execute: (intent: ExecutionIntent) => Promise<ExecutionResult>;

  /**
   * Execute multiple intents in batch with idempotency
   */
  executeBatch: (intents: ExecutionIntent[]) => Promise<ExecutionResult[]>;

  /**
   * Validate intent without executing
   */
  validate: (
    intent: ExecutionIntent
  ) => Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    risk_lane: string;
  }>;

  /**
   * Check if action is allowlisted
   */
  isAllowlisted: (action: string) => boolean;

  /**
   * Execution state
   */
  isExecuting: boolean;
  lastResult: ExecutionResult | null;
  enabled: boolean;
  initialized: boolean;

  /**
   * Legacy alias for backwards compatibility
   */
  submitIntent: (intent: ExecutionIntent) => Promise<{ status: string; receipt_id?: string }>;
  isActionAllowed: (action: string) => boolean;
}

/**
 * Hook for MAESTRO execution operations
 */
export function useExecution(): UseExecutionReturn {
  const { enabled, initialized } = useMaestroContext();
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);

  const execute = useCallback(
    async (intent: ExecutionIntent): Promise<ExecutionResult> => {
      if (!enabled || !initialized) {
        return {
          success: false,
          intent_id: intent.intent_id,
          error: 'MAESTRO not enabled or not initialized',
          blocked: true,
        };
      }

      setIsExecuting(true);

      try {
        // Get auth token if available (would come from Supabase session in real app)
        const authToken = undefined; // TODO: Get from auth context

        const result = await executeIntent(intent, authToken);
        setLastResult(result);
        return result;
      } finally {
        setIsExecuting(false);
      }
    },
    [enabled, initialized]
  );

  const executeBatchCallback = useCallback(
    async (intents: ExecutionIntent[]): Promise<ExecutionResult[]> => {
      if (!enabled || !initialized) {
        return intents.map((intent) => ({
          success: false,
          intent_id: intent.intent_id,
          error: 'MAESTRO not enabled or not initialized',
          blocked: true,
        }));
      }

      setIsExecuting(true);

      try {
        const authToken = undefined; // TODO: Get from auth context
        const results = await executeBatch(intents, authToken);
        if (results.length > 0) {
          setLastResult(results[results.length - 1]);
        }
        return results;
      } finally {
        setIsExecuting(false);
      }
    },
    [enabled, initialized]
  );

  const validate = useCallback(
    async (intent: ExecutionIntent) => {
      if (!enabled || !initialized) {
        return {
          valid: false,
          errors: ['MAESTRO not enabled or not initialized'],
          warnings: [],
          risk_lane: 'RED',
        };
      }

      const authToken = undefined; // TODO: Get from auth context
      const validation = await validateIntent(intent, authToken);

      return {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        risk_lane: validation.risk_lane,
      };
    },
    [enabled, initialized]
  );

  const isAllowlisted = useCallback((action: string): boolean => {
    return isActionAllowlisted(action);
  }, []);

  // Legacy compatibility wrapper
  const submitIntent = useCallback(
    async (intent: ExecutionIntent) => {
      const result = await execute(intent);
      return {
        status: result.success ? 'completed' : 'blocked',
        receipt_id: result.success ? intent.intent_id : undefined,
      };
    },
    [execute]
  );

  return {
    execute,
    executeBatch: executeBatchCallback,
    validate,
    isAllowlisted,
    isExecuting,
    lastResult,
    enabled,
    initialized,
    // Legacy aliases
    submitIntent,
    isActionAllowed: isAllowlisted,
  };
}
