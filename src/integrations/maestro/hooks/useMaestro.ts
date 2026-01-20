/**
 * MAESTRO Hook - Primary API
 *
 * Main hook for interacting with MAESTRO browser-only compute system.
 * Provides memory, grounding, and execution capabilities.
 */

import { useMaestroContext } from '../providers/MaestroProvider';
import { useMemory } from './useMemory';
import { useGrounding } from './useGrounding';
import { useExecution } from './useExecution';
import type { MaestroHealthResponse } from '../types';

/**
 * MAESTRO Hook Return Type
 */
export interface UseMaestroReturn {
  /**
   * Whether MAESTRO is enabled
   */
  enabled: boolean;

  /**
   * Whether MAESTRO is initialized
   */
  initialized: boolean;

  /**
   * MAESTRO health status
   */
  health: MaestroHealthResponse | null;

  /**
   * Initialization error (if any)
   */
  error: Error | null;

  /**
   * Memory operations (store, retrieve, delete)
   */
  memory: ReturnType<typeof useMemory>;

  /**
   * Grounding operations (semantic search, retrieval)
   */
  grounding: ReturnType<typeof useGrounding>;

  /**
   * Execution operations (intents, plans)
   */
  execution: ReturnType<typeof useExecution>;
}

/**
 * Primary MAESTRO hook
 *
 * Usage:
 * ```tsx
 * const { enabled, memory, grounding, execute } = useMaestro();
 *
 * if (!enabled) {
 *   // MAESTRO disabled, use prior behavior
 *   return <PriorBehavior />;
 * }
 *
 * // Store memory
 * await memory.store('core', { ... });
 *
 * // Search memory
 * const results = await grounding.search('query', 'en-US');
 *
 * // Execute intent
 * const outcome = await execute.submitIntent({ ... });
 * ```
 */
export function useMaestro(): UseMaestroReturn {
  const context = useMaestroContext();
  const memory = useMemory();
  const grounding = useGrounding();
  const execution = useExecution();

  return {
    enabled: context.enabled,
    initialized: context.initialized,
    health: context.health,
    error: context.error,
    memory,
    grounding,
    execution,
  };
}
