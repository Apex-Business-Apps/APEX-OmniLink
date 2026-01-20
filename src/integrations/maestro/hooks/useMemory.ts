/**
 * Memory Hook
 *
 * Hook for storing and retrieving memory items across tiers.
 */

import { useCallback } from 'react';
import { useMaestroContext } from '../providers/MaestroProvider';
import {
  storeMemoryItem,
  getMemoryItem,
  getAllMemoryItems,
  getMemoryItemsByLocale,
  deleteMemoryItem,
  clearMemoryTier,
  compactMemoryTier,
} from '../stores/indexeddb';
import type { MemoryItem, MemoryTier, LocaleString } from '../types';

/**
 * Memory Hook Return Type
 */
export interface UseMemoryReturn {
  /**
   * Store a memory item in a specific tier
   */
  store: (tier: MemoryTier, item: MemoryItem) => Promise<void>;

  /**
   * Get a memory item by ID
   */
  get: (tier: MemoryTier, id: string) => Promise<MemoryItem | null>;

  /**
   * Get all items from a tier
   */
  getAll: (tier: MemoryTier) => Promise<MemoryItem[]>;

  /**
   * Get items by locale
   */
  getByLocale: (tier: MemoryTier, locale: LocaleString) => Promise<MemoryItem[]>;

  /**
   * Delete a memory item
   */
  delete: (tier: MemoryTier, id: string) => Promise<void>;

  /**
   * Clear all items from a tier
   */
  clear: (tier: MemoryTier) => Promise<void>;

  /**
   * Compact a tier (remove expired items)
   */
  compact: (tier: MemoryTier) => Promise<number>;
}

/**
 * Hook for memory operations
 */
export function useMemory(): UseMemoryReturn {
  const { enabled, initialized } = useMaestroContext();

  const store = useCallback(
    async (tier: MemoryTier, item: MemoryItem) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }
      return storeMemoryItem(tier, item);
    },
    [enabled, initialized]
  );

  const get = useCallback(
    async (tier: MemoryTier, id: string) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }
      return getMemoryItem(tier, id);
    },
    [enabled, initialized]
  );

  const getAll = useCallback(
    async (tier: MemoryTier) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }
      return getAllMemoryItems(tier);
    },
    [enabled, initialized]
  );

  const getByLocale = useCallback(
    async (tier: MemoryTier, locale: LocaleString) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }
      return getMemoryItemsByLocale(tier, locale);
    },
    [enabled, initialized]
  );

  const deleteItem = useCallback(
    async (tier: MemoryTier, id: string) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }
      return deleteMemoryItem(tier, id);
    },
    [enabled, initialized]
  );

  const clear = useCallback(
    async (tier: MemoryTier) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }
      return clearMemoryTier(tier);
    },
    [enabled, initialized]
  );

  const compact = useCallback(
    async (tier: MemoryTier) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }
      return compactMemoryTier(tier);
    },
    [enabled, initialized]
  );

  return {
    store,
    get,
    getAll,
    getByLocale,
    delete: deleteItem,
    clear,
    compact,
  };
}
