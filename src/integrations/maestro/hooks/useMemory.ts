/**
 * Memory Hook
 *
 * Hook for storing and retrieving memory items across tiers.
 * Phase 3: Enhanced with automatic embedding generation and advanced retrieval
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
import { generateEmbeddings } from '../inference/embeddings';
import { computeContentHash } from '@/lib/security';
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
   * Store with automatic embedding generation (for semantic tier)
   */
  storeWithEmbedding: (tier: MemoryTier, item: Omit<MemoryItem, 'embedding'>) => Promise<void>;

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
   * Get items by content hash (deduplication)
   */
  getByContentHash: (tier: MemoryTier, contentHash: string) => Promise<MemoryItem | null>;

  /**
   * Get items with specific provenance references
   */
  getByProvenance: (tier: MemoryTier, provenanceRef: string) => Promise<MemoryItem[]>;

  /**
   * Get recent items (by created_at)
   */
  getRecent: (tier: MemoryTier, limit: number) => Promise<MemoryItem[]>;

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

  /**
   * Get tier statistics
   */
  getStats: (tier: MemoryTier) => Promise<{
    total_items: number;
    total_size_mb: number;
    oldest_item: string | null;
    newest_item: string | null;
  }>;
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

  const storeWithEmbedding = useCallback(
    async (tier: MemoryTier, item: Omit<MemoryItem, 'embedding'>) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      // Generate embedding for semantic tier
      if (tier === 'semantic') {
        const [embedding] = await generateEmbeddings([item.content]);
        const itemWithEmbedding: MemoryItem = {
          ...item,
          embedding,
        };
        return storeMemoryItem(tier, itemWithEmbedding);
      }

      // For other tiers, store without embedding
      return storeMemoryItem(tier, item as MemoryItem);
    },
    [enabled, initialized]
  );

  const getByContentHash = useCallback(
    async (tier: MemoryTier, contentHash: string) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      const allItems = await getAllMemoryItems(tier);
      return allItems.find((item) => item.content_hash === contentHash) || null;
    },
    [enabled, initialized]
  );

  const getByProvenance = useCallback(
    async (tier: MemoryTier, provenanceRef: string) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      const allItems = await getAllMemoryItems(tier);
      return allItems.filter((item) => item.provenance_refs.includes(provenanceRef));
    },
    [enabled, initialized]
  );

  const getRecent = useCallback(
    async (tier: MemoryTier, limit: number) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      const allItems = await getAllMemoryItems(tier);
      return allItems
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    },
    [enabled, initialized]
  );

  const getStats = useCallback(
    async (tier: MemoryTier) => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      const allItems = await getAllMemoryItems(tier);

      if (allItems.length === 0) {
        return {
          total_items: 0,
          total_size_mb: 0,
          oldest_item: null,
          newest_item: null,
        };
      }

      // Calculate total size (rough estimate: content length * 2 bytes for UTF-16)
      const totalBytes = allItems.reduce((sum, item) => {
        const contentSize = item.content.length * 2;
        const embeddingSize = item.embedding ? item.embedding.length * 8 : 0; // 8 bytes per float64
        return sum + contentSize + embeddingSize;
      }, 0);

      // Find oldest and newest items
      const sorted = [...allItems].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return {
        total_items: allItems.length,
        total_size_mb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
        oldest_item: sorted[0]?.created_at || null,
        newest_item: sorted[sorted.length - 1]?.created_at || null,
      };
    },
    [enabled, initialized]
  );

  return {
    store,
    storeWithEmbedding,
    get,
    getAll,
    getByLocale,
    getByContentHash,
    getByProvenance,
    getRecent,
    delete: deleteItem,
    clear,
    compact,
    getStats,
  };
}
