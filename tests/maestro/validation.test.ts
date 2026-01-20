/**
 * MAESTRO Validation Tests
 *
 * Tests for schema validation and input sanitization.
 */

import { describe, it, expect } from 'vitest';
import { IDEMPOTENCY_KEY_PATTERN, BCP47_PATTERN } from '@/integrations/maestro/types';

describe('MAESTRO Validation Tests', () => {
  describe('Idempotency Key Validation', () => {
    it('should accept valid 64-char hex key', () => {
      const validKey = 'a'.repeat(64);
      expect(IDEMPOTENCY_KEY_PATTERN.test(validKey)).toBe(true);
    });

    it('should accept mixed hex characters', () => {
      const validKey = 'abcdef0123456789'.repeat(4);
      expect(IDEMPOTENCY_KEY_PATTERN.test(validKey)).toBe(true);
    });

    it('should reject too short key', () => {
      const shortKey = 'a'.repeat(63);
      expect(IDEMPOTENCY_KEY_PATTERN.test(shortKey)).toBe(false);
    });

    it('should reject too long key', () => {
      const longKey = 'a'.repeat(65);
      expect(IDEMPOTENCY_KEY_PATTERN.test(longKey)).toBe(false);
    });

    it('should reject uppercase hex', () => {
      const upperKey = 'A'.repeat(64);
      expect(IDEMPOTENCY_KEY_PATTERN.test(upperKey)).toBe(false);
    });

    it('should reject non-hex characters', () => {
      const invalidKey = 'g'.repeat(64);
      expect(IDEMPOTENCY_KEY_PATTERN.test(invalidKey)).toBe(false);
    });

    it('should reject key with spaces', () => {
      const spacedKey = 'a'.repeat(32) + ' ' + 'a'.repeat(31);
      expect(IDEMPOTENCY_KEY_PATTERN.test(spacedKey)).toBe(false);
    });
  });

  describe('BCP-47 Locale Validation', () => {
    it('should accept simple language code', () => {
      expect(BCP47_PATTERN.test('en')).toBe(true);
      expect(BCP47_PATTERN.test('es')).toBe(true);
      expect(BCP47_PATTERN.test('zh')).toBe(true);
    });

    it('should accept language-region format', () => {
      expect(BCP47_PATTERN.test('en-US')).toBe(true);
      expect(BCP47_PATTERN.test('en-GB')).toBe(true);
      expect(BCP47_PATTERN.test('pt-BR')).toBe(true);
    });

    it('should accept three-letter language codes', () => {
      expect(BCP47_PATTERN.test('yue')).toBe(true);
      expect(BCP47_PATTERN.test('cmn')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(BCP47_PATTERN.test('english')).toBe(false);
      expect(BCP47_PATTERN.test('en_US')).toBe(false);
      expect(BCP47_PATTERN.test('E')).toBe(false);
    });
  });
});
