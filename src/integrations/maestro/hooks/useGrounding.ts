/**
 * Grounding Hook
 *
 * Hook for semantic search and memory retrieval.
 * Phase 3: Full implementation with semantic-search.ts integration
 */

import { useCallback } from 'react';
import { useMaestroContext } from '../providers/MaestroProvider';
import {
  semanticSearch,
  crossLingualSearch,
  hybridSearch,
  type SearchOptions,
} from '../retrieval/semantic-search';
import type { GroundingResult, LocaleString, MemoryTier } from '../types';

/**
 * Grounding Hook Return Type
 */
export interface UseGroundingReturn {
  /**
   * Search memory items by query (semantic search)
   * Uses embeddings + cosine similarity for local-only retrieval
   */
  search: (
    query: string,
    locale: LocaleString,
    options?: SearchOptions
  ) => Promise<GroundingResult>;

  /**
   * Search across multiple locales (cross-lingual retrieval)
   * Uses multilingual embeddings for language-agnostic search
   */
  searchCrossLingual: (
    query: string,
    locales: LocaleString[],
    options?: SearchOptions
  ) => Promise<GroundingResult>;

  /**
   * Hybrid search (keyword + semantic)
   * Combines text matching with semantic similarity
   */
  searchHybrid: (
    query: string,
    locale: LocaleString,
    options?: SearchOptions & {
      keywordWeight?: number;
      semanticWeight?: number;
    }
  ) => Promise<GroundingResult>;

  /**
   * Search specific memory tiers only
   */
  searchTiers: (
    query: string,
    locale: LocaleString,
    tiers: MemoryTier[],
    options?: SearchOptions
  ) => Promise<GroundingResult>;
}

/**
 * Hook for grounding operations
 */
export function useGrounding(): UseGroundingReturn {
  const { enabled, initialized } = useMaestroContext();

  const search = useCallback(
    async (
      query: string,
      locale: LocaleString,
      options?: SearchOptions
    ): Promise<GroundingResult> => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      // Use semantic search with all tiers by default
      return semanticSearch(query, locale, options);
    },
    [enabled, initialized]
  );

  const searchCrossLingual = useCallback(
    async (
      query: string,
      locales: LocaleString[],
      options?: SearchOptions
    ): Promise<GroundingResult> => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      // Use cross-lingual search
      return crossLingualSearch(query, locales, options);
    },
    [enabled, initialized]
  );

  const searchHybrid = useCallback(
    async (
      query: string,
      locale: LocaleString,
      options?: SearchOptions & {
        keywordWeight?: number;
        semanticWeight?: number;
      }
    ): Promise<GroundingResult> => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      // Use hybrid search (keyword + semantic)
      return hybridSearch(query, locale, options);
    },
    [enabled, initialized]
  );

  const searchTiers = useCallback(
    async (
      query: string,
      locale: LocaleString,
      tiers: MemoryTier[],
      options?: SearchOptions
    ): Promise<GroundingResult> => {
      if (!enabled || !initialized) {
        throw new Error('MAESTRO not enabled or not initialized');
      }

      // Use semantic search with specific tiers
      return semanticSearch(query, locale, {
        ...options,
        tiers,
      });
    },
    [enabled, initialized]
  );

  return {
    search,
    searchCrossLingual,
    searchHybrid,
    searchTiers,
  };
}
