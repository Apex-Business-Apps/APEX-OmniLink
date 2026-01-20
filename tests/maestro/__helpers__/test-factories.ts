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
 * Assertion helper for injection detected and blocked
 */
export function expectInjectionBlocked(
  result: { detected: boolean; blocked: boolean; patterns_matched?: string[]; risk_score?: number },
  expectedPattern?: string,
  minRiskScore?: number
) {
  expect(result.detected).toBe(true);
  expect(result.blocked).toBe(true);
  if (expectedPattern) {
    expect(result.patterns_matched).toContain(expectedPattern);
  }
  if (minRiskScore !== undefined) {
    expect(result.risk_score).toBeGreaterThan(minRiskScore);
  }
}

/**
 * Assertion helper for injection detected (may not be blocked)
 */
export function expectInjectionDetected(
  result: { detected: boolean; patterns_matched?: string[] },
  expectedPattern?: string
) {
  expect(result.detected).toBe(true);
  if (expectedPattern) {
    expect(result.patterns_matched).toContain(expectedPattern);
  }
}

/**
 * Assertion helper for safe input (no injection)
 */
export function expectSafeInput(
  result: { detected: boolean; blocked: boolean; risk_score: number }
) {
  expect(result.detected).toBe(false);
  expect(result.blocked).toBe(false);
  expect(result.risk_score).toBe(0);
}

/**
 * Assertion helper for checkInputSafety - safe result
 */
export function expectInputSafe(
  result: { safe: boolean; errors: string[] }
) {
  expect(result.safe).toBe(true);
  expect(result.errors).toHaveLength(0);
}

/**
 * Assertion helper for checkInputSafety - unsafe result
 */
export function expectInputUnsafe(
  result: { safe: boolean; errors: string[]; injection?: { blocked: boolean } }
) {
  expect(result.safe).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
}
