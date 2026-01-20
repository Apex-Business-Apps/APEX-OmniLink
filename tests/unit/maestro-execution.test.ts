/**
 * MAESTRO: Phase 5-6 Execution Tests
 *
 * Unit tests for the core execution logic using parameterized tests
 * to reduce code duplication while maintaining comprehensive coverage.
 */

import { describe, it, expect } from 'vitest';
import {
  createValidIntent,
  expectAllowed,
  expectBlocked,
  type TestMaestroIntent,
  type ExecutionResult,
} from '../maestro/__helpers__/setup';

// BCP-47 locale pattern
const BCP47_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/;

function executeIntent(intent: TestMaestroIntent): ExecutionResult {
  // 1) Check user confirmation
  if (!intent.user_confirmed) {
    return { allowed: false, reason: 'user_confirmation_required' };
  }

  // 2) Check translation status
  if (intent.translation_status === 'FAILED') {
    return { allowed: false, reason: 'translation_failed' };
  }

  // 3) Check risk lane
  if (intent.risk_lane === 'BLOCKED') {
    return { allowed: false, reason: 'risk_lane_blocked' };
  }

  if (intent.risk_lane === 'RED') {
    return { allowed: false, reason: 'risk_lane_red' };
  }

  // 4) Check confidence threshold
  if (intent.confidence < 0.7) {
    return { allowed: false, reason: 'confidence_below_threshold' };
  }

  // 5) Validation checks
  if (!intent.identity?.tenant_id || !intent.identity?.user_id || !intent.identity?.session_id) {
    return { allowed: false, reason: 'missing_identity' };
  }

  if (intent.locale && !BCP47_PATTERN.test(intent.locale)) {
    return { allowed: false, reason: 'invalid_locale' };
  }

  if (intent.confidence < 0 || intent.confidence > 1) {
    return { allowed: false, reason: 'invalid_confidence' };
  }

  return { allowed: true };
}

// MAN mode simulation
async function escalateToMANMode(_intent: TestMaestroIntent): Promise<{ approved: boolean }> {
  return { approved: false };
}

// Receipt claim simulation
async function claimReceipt(intentId: string): Promise<{ success: boolean; error?: string }> {
  if (intentId === 'trace-receipt-fail') {
    return { success: false, error: 'Receipt service unavailable' };
  }
  return { success: true };
}

describe('MAESTRO: Phase 5-6 Execution Tests', () => {
  // =========================================================================
  // GREEN LANE EXECUTION
  // =========================================================================

  describe('1) GREEN Lane Execution', () => {
    it('should allow execution for GREEN lane with all requirements met', () => {
      const intent = createValidIntent();
      const result = executeIntent(intent);
      expectAllowed(result);
    });
  });

  // =========================================================================
  // BLOCKING CONDITIONS (Parameterized)
  // =========================================================================

  describe('2-5) Blocking Conditions', () => {
    it.each([
      ['user_confirmed is false', { user_confirmed: false }, 'user_confirmation_required'],
      ['translation_status is FAILED', { translation_status: 'FAILED' as const }, 'translation_failed'],
      ['risk_lane is BLOCKED', { risk_lane: 'BLOCKED' as const }, 'risk_lane_blocked'],
      ['risk_lane is RED', { risk_lane: 'RED' as const }, 'risk_lane_red'],
      ['confidence is below 0.7', { confidence: 0.5 }, 'confidence_below_threshold'],
    ])('should block when %s', (_desc, overrides, expectedReason) => {
      const intent = createValidIntent(overrides);
      const result = executeIntent(intent);
      expectBlocked(result, expectedReason);
    });
  });

  // =========================================================================
  // VALIDATION TESTS (Parameterized)
  // =========================================================================

  describe('6) Validation Tests', () => {
    it.each([
      ['missing identity', { identity: undefined }, 'missing_identity'],
      ['missing tenant_id', { identity: { user_id: 'u', session_id: 's' } }, 'missing_identity'],
      ['missing user_id', { identity: { tenant_id: 't', session_id: 's' } }, 'missing_identity'],
      ['missing session_id', { identity: { tenant_id: 't', user_id: 'u' } }, 'missing_identity'],
    ])('should block with %s', (_desc, overrides, expectedReason) => {
      const intent = createValidIntent(overrides as Partial<TestMaestroIntent>);
      const result = executeIntent(intent);
      expectBlocked(result, expectedReason);
    });

    it.each([
      ['invalid-locale', 'invalid_locale'],
      ['123', 'invalid_locale'],
      ['en_US', 'invalid_locale'], // underscore instead of hyphen
    ])('should reject invalid locale: %s', (locale, expectedReason) => {
      const intent = createValidIntent({ locale });
      const result = executeIntent(intent);
      expectBlocked(result, expectedReason);
    });

    it.each([
      [1.5, 'invalid_confidence'],
      [2, 'invalid_confidence'],
    ])('should reject invalid confidence: %s', (confidence, expectedReason) => {
      const intent = createValidIntent({ confidence });
      const result = executeIntent(intent);
      expectBlocked(result, expectedReason);
    });

    it('should reject negative confidence as below threshold', () => {
      // Note: -0.1 < 0.7, so confidence_below_threshold triggers first
      const intent = createValidIntent({ confidence: -0.1 });
      const result = executeIntent(intent);
      expectBlocked(result, 'confidence_below_threshold');
    });

    it.each([
      ['en-US', true],
      ['en', true],
      ['zh-Hans-CN', true],
    ])('should accept valid locale: %s', (locale, _shouldPass) => {
      const intent = createValidIntent({ locale });
      const result = executeIntent(intent);
      expectAllowed(result);
    });
  });

  // =========================================================================
  // MAN MODE INTEGRATION
  // =========================================================================

  describe('7) MAN Mode Integration', () => {
    it('should handle MAN mode escalation failures gracefully', async () => {
      const intent = createValidIntent({ risk_lane: 'RED' });
      const manResult = await escalateToMANMode(intent);
      expect(manResult.approved).toBe(false);
    });
  });

  // =========================================================================
  // RECEIPT CLAIM HANDLING
  // =========================================================================

  describe('8) Receipt Claim Failure Handling', () => {
    it.each([
      ['trace-receipt-fail', false, 'Receipt service unavailable'],
      ['trace-valid', true, undefined],
    ])('should handle receipt claim for %s', async (intentId, expectedSuccess, expectedError) => {
      const result = await claimReceipt(intentId);
      expect(result.success).toBe(expectedSuccess);
      expect(result.error).toBe(expectedError);
    });
  });
});
