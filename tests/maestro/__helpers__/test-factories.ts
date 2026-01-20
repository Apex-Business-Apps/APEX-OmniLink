/**
 * Test factories for MAESTRO tests
 * Reduces code duplication across test files
 */

import type { MemoryItem } from '@/integrations/maestro/types';
import type { ExecutionIntent } from '@/integrations/maestro/types';

/**
 * Create a mock MemoryItem with default values
 */
export function createMockMemoryItem(
  overrides: Partial<MemoryItem> = {}
): MemoryItem {
  return {
    id: crypto.randomUUID(),
    tier: 'core',
    locale: 'en-US',
    content: 'Test content',
    content_hash: crypto.randomUUID(),
    provenance_refs: [],
    created_at: new Date().toISOString(),
    key_version: 1,
    ...overrides,
  };
}

/**
 * Create a mock ExecutionIntent with default values
 */
export function createMockExecutionIntent(
  overrides: Partial<ExecutionIntent> = {}
): ExecutionIntent {
  return {
    intent_id: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    idempotency_key: crypto.randomUUID().replace(/-/g, ''),
    canonical_action: 'log_message',
    canonical_object: 'log',
    parameters: {
      message: 'Test message',
      level: 'info',
    },
    risk_lane: 'GREEN',
    trace_id: crypto.randomUUID(),
    source_event_id: crypto.randomUUID(),
    user_confirmed: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Assertion helper for injection detection results
 */
export function assertInjectionDetected(
  result: { detected: boolean; blocked: boolean; patterns_matched?: string[] },
  expectedPattern?: string
) {
  expect(result.detected).toBe(true);
  expect(result.blocked).toBe(true);
  if (expectedPattern) {
    expect(result.patterns_matched).toContain(expectedPattern);
  }
}

/**
 * Assertion helper for safe input detection
 */
export function assertSafeInput(
  result: { detected: boolean; blocked: boolean; risk_score: number }
) {
  expect(result.detected).toBe(false);
  expect(result.blocked).toBe(false);
  expect(result.risk_score).toBe(0);
}
