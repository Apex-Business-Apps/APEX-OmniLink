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
import { createMockMemoryItem } from './__helpers__/test-factories';

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

  describe('storeMemoryItem', () => {
    it('should store a memory item in core tier', async () => {
      const item = createMockMemoryItem({
        id: 'test-1',
        content: 'Test content',
        content_hash: 'abc123',
      });

      await storeMemoryItem('core', item);

      const retrieved = await getMemoryItem('core', 'test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Test content');
      expect(retrieved?.locale).toBe('en-US');
    });

    it('should add expires_at for working tier items', async () => {
      const item = createMockMemoryItem({
        id: 'test-working-1',
        tier: 'working',
        content: 'Temporary content',
        content_hash: 'def456',
      });

      await storeMemoryItem('working', item);

      const retrieved = await getMemoryItem('working', 'test-working-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.expires_at).toBeDefined();
    });
  });

  describe('getMemoryItemsByLocale', () => {
    it('should retrieve items by locale', async () => {
      const items = [
        createMockMemoryItem({ id: 'en-1', locale: 'en-US', content: 'English content', content_hash: 'hash1' }),
        createMockMemoryItem({ id: 'fr-1', locale: 'fr-FR', content: 'French content', content_hash: 'hash2' }),
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
      const expiredItem = createMockMemoryItem({
        id: 'expired-1',
        tier: 'working',
        content: 'Expired content',
        content_hash: 'expired-hash',
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
      const item = createMockMemoryItem({
        id: 'delete-test-1',
        content: 'To be deleted',
        content_hash: 'delete-hash',
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
      const items = [
        createMockMemoryItem({ id: 'clear-1', content: 'Content 1', content_hash: 'hash1' }),
        createMockMemoryItem({ id: 'clear-2', content: 'Content 2', content_hash: 'hash2' }),
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
