/**
 * Idempotency Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  withIdempotency,
  clearAllReceipts,
  hasIdempotencyKey,
  getReceipt,
  getStats,
} from '../idempotency';

describe('Idempotency Engine', () => {
  beforeEach(() => {
    clearAllReceipts();
  });

  describe('withIdempotency', () => {
    it('should execute operation on first call', async () => {
      let callCount = 0;

      const result = await withIdempotency(
        'test-key-1',
        'corr-1',
        'test-event',
        async () => {
          callCount++;
          return { value: 42 };
        }
      );

      expect(result.result).toEqual({ value: 42 });
      expect(result.wasCached).toBe(false);
      expect(result.attemptCount).toBe(1);
      expect(callCount).toBe(1);
    });

    it('should return cached result on duplicate', async () => {
      let callCount = 0;

      // First call
      await withIdempotency('test-key-2', 'corr-2', 'test-event', async () => {
        callCount++;
        return { value: 100 };
      });

      // Duplicate call
      const result = await withIdempotency('test-key-2', 'corr-2', 'test-event', async () => {
        callCount++;
        return { value: 999 }; // Different value
      });

      expect(result.result).toEqual({ value: 100 }); // Original value
      expect(result.wasCached).toBe(true);
      expect(result.attemptCount).toBe(2);
      expect(callCount).toBe(1); // Only executed once
    });

    it('should increment attempt count on duplicates', async () => {
      const key = 'test-key-3';

      await withIdempotency(key, 'corr-3', 'test-event', async () => 'first');

      const result2 = await withIdempotency(key, 'corr-3', 'test-event', async () => 'second');
      expect(result2.attemptCount).toBe(2);

      const result3 = await withIdempotency(key, 'corr-3', 'test-event', async () => 'third');
      expect(result3.attemptCount).toBe(3);
    });
  });

  describe('hasIdempotencyKey', () => {
    it('should return false for non-existent key', () => {
      expect(hasIdempotencyKey('nonexistent')).toBe(false);
    });

    it('should return true for existing key', async () => {
      await withIdempotency('exists-key', 'corr', 'event', async () => 'data');

      expect(hasIdempotencyKey('exists-key')).toBe(true);
    });
  });

  describe('getReceipt', () => {
    it('should return null for non-existent receipt', () => {
      expect(getReceipt('nonexistent')).toBeNull();
    });

    it('should return receipt for existing key', async () => {
      await withIdempotency('receipt-key', 'corr-123', 'event-type', async () => ({
        data: 'test',
      }));

      const receipt = getReceipt('receipt-key');

      expect(receipt).not.toBeNull();
      expect(receipt!.idempotencyKey).toBe('receipt-key');
      expect(receipt!.correlationId).toBe('corr-123');
      expect(receipt!.eventType).toBe('event-type');
      expect(receipt!.response).toEqual({ data: 'test' });
    });
  });

  describe('getStats', () => {
    it('should track hits and misses', async () => {
      clearAllReceipts();

      // Miss
      await withIdempotency('key-1', 'corr-1', 'event', async () => 'data');

      // Hit
      await withIdempotency('key-1', 'corr-1', 'event', async () => 'data');

      // Hit
      await withIdempotency('key-1', 'corr-1', 'event', async () => 'data');

      const stats = getStats();

      expect(stats.dedupeMisses).toBe(1);
      expect(stats.dedupeHits).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.67, 2);
    });
  });
});
