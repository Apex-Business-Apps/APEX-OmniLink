/**
 * MAESTRO IndexedDB Tests
 *
 * Tests for tiered memory stores
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto'; // Polyfill IndexedDB for Node.js tests
import {
  initMaestroDb,
  storeMemoryItem,
  getMemoryItem,
  getAllMemoryItems,
  getMemoryItemsByLocale,
  deleteMemoryItem,
  clearMemoryTier,
  compactMemoryTier,
} from '@/integrations/maestro/stores/indexeddb';
import { MAESTRO_STORES } from '@/integrations/maestro/config';
import type { MemoryItem } from '@/integrations/maestro/types';

describe('MAESTRO IndexedDB', () => {
  beforeEach(async () => {
    // Initialize database
    await initMaestroDb();
  });

  afterEach(async () => {
    // Clean up all tiers
    for (const tier of Object.values(MAESTRO_STORES)) {
      await clearMemoryTier(tier);
    }
  });

  // Helper to create valid memory items for testing
  function createTestItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
    return {
      id: 'test-item-' + Date.now(),
      tier: 'core',
      locale: 'en-US',
      content: 'Test content',
      content_hash: 'hash-' + Date.now(),
      provenance_refs: [],
      created_at: new Date().toISOString(),
      key_version: 1,
      ...overrides,
    };
  }

  describe('storeMemoryItem', () => {
    it('should store a memory item in core tier', async () => {
      const item = createTestItem({
        id: 'test-1',
        content: 'Test content',
      });

      await storeMemoryItem('core', item);

      const retrieved = await getMemoryItem('core', 'test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Test content');
      expect(retrieved?.locale).toBe('en-US');
    });

    it('should add expires_at for working tier items', async () => {
      const item = createTestItem({
        id: 'test-working-1',
        tier: 'working',
        content: 'Temporary content',
      });

      await storeMemoryItem('working', item);

      const retrieved = await getMemoryItem('working', 'test-working-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.expires_at).toBeDefined();
    });
  });

  describe('getMemoryItemsByLocale', () => {
    it('should retrieve items by locale', async () => {
      const items: MemoryItem[] = [
        createTestItem({
          id: 'en-1',
          locale: 'en-US',
          content: 'English content',
        }),
        createTestItem({
          id: 'fr-1',
          locale: 'fr-FR',
          content: 'French content',
        }),
      ];

      for (const item of items) {
        await storeMemoryItem('core', item);
      }

      const enItems = await getMemoryItemsByLocale('core', 'en-US');
      expect(enItems.length).toBe(1);
      expect(enItems[0].locale).toBe('en-US');

      const frItems = await getMemoryItemsByLocale('core', 'fr-FR');
      expect(frItems.length).toBe(1);
      expect(frItems[0].locale).toBe('fr-FR');
    });
  });

  describe('compactMemoryTier', () => {
    it('should remove expired items from working tier', async () => {
      const expiredItem = createTestItem({
        id: 'expired-1',
        tier: 'working',
        expires_at: new Date(Date.now() - 1000).toISOString(), // Already expired
      });

      await storeMemoryItem('working', expiredItem);

      const deletedCount = await compactMemoryTier('working');
      expect(deletedCount).toBeGreaterThan(0);

      const retrieved = await getMemoryItem('working', 'expired-1');
      expect(retrieved).toBeNull();
    });
  });

  describe('deleteMemoryItem', () => {
    it('should delete a specific item', async () => {
      const item = createTestItem({
        id: 'delete-test-1',
        content: 'To be deleted',
      });

      await storeMemoryItem('core', item);

      let retrieved = await getMemoryItem('core', 'delete-test-1');
      expect(retrieved).toBeDefined();

      await deleteMemoryItem('core', 'delete-test-1');

      retrieved = await getMemoryItem('core', 'delete-test-1');
      expect(retrieved).toBeNull();
    });
  });

  describe('clearMemoryTier', () => {
    it('should clear all items from a tier', async () => {
      const items: MemoryItem[] = [
        createTestItem({ id: 'clear-1' }),
        createTestItem({ id: 'clear-2' }),
      ];

      for (const item of items) {
        await storeMemoryItem('core', item);
      }

      let allItems = await getAllMemoryItems('core');
      expect(allItems.length).toBeGreaterThanOrEqual(2);

      await clearMemoryTier('core');

      allItems = await getAllMemoryItems('core');
      expect(allItems.length).toBe(0);
    });
  });
});
