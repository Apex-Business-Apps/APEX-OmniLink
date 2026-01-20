/**
 * MAESTRO Semantic Search
 *
 * Local-only semantic retrieval using embeddings + cosine similarity.
 * Supports cross-lingual search.
 */

import { generateEmbeddings, findTopKSimilar } from '../inference/embeddings';
import { getAllMemoryItems } from '../stores/indexeddb';
import { createInferenceBudget } from '../inference/runtime';
import type { MemoryItem, MemoryTier, LocaleString, GroundingResult } from '../types';
import type { InferenceBudget } from '../inference/runtime';

/**
 * Search options
 */
export interface SearchOptions {
  tiers?: MemoryTier[];
  topK?: number;
  minSimilarity?: number;
  budget?: InferenceBudget;
}

/**
 * Semantic search across memory tiers
 *
 * Process:
 * 1. Generate embedding for query
 * 2. Retrieve all items from specified tiers
 * 3. Filter items with embeddings
 * 4. Compute similarity scores
 * 5. Return top-k results
 */
export async function semanticSearch(
  query: string,
  locale: LocaleString,
  options?: SearchOptions
): Promise<GroundingResult> {
  const {
    tiers = ['core', 'working', 'episodic', 'semantic', 'procedural'],
    topK = 10,
    minSimilarity = 0.5,
    budget = createInferenceBudget(),
  } = options || {};

  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Step 1: Generate query embedding
    const [queryEmbedding] = await generateEmbeddings([query], budget);

    // Step 2: Retrieve all items from tiers
    const allItems: MemoryItem[] = [];
    for (const tier of tiers) {
      const items = await getAllMemoryItems(tier);
      allItems.push(...items);
    }

    // Step 3: Filter items with embeddings (semantic tier only has embeddings)
    const itemsWithEmbeddings = allItems.filter(
      (item) => item.embedding && item.embedding.length > 0
    );

    if (itemsWithEmbeddings.length === 0) {
      // No items with embeddings, return empty result
      return {
        items: [],
        query,
        locale,
        similarity_scores: [],
        trace_id: traceId,
        retrieved_at: new Date().toISOString(),
      };
    }

    // Step 4: Compute similarity scores
    const embeddings = itemsWithEmbeddings.map((item) => item.embedding!);
    const results = findTopKSimilar(queryEmbedding, embeddings, topK);

    // Step 5: Filter by minimum similarity threshold
    const filtered = results.filter((result) => result.score >= minSimilarity);

    // Step 6: Map to memory items
    const items = filtered.map((result) => itemsWithEmbeddings[result.index]);
    const scores = filtered.map((result) => result.score);

    return {
      items,
      query,
      locale,
      similarity_scores: scores,
      trace_id: traceId,
      retrieved_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[MAESTRO Semantic Search] Error:', error);
    // Fail-open for read-only operations
    return {
      items: [],
      query,
      locale,
      similarity_scores: [],
      trace_id: traceId,
      retrieved_at: new Date().toISOString(),
    };
  }
}

/**
 * Cross-lingual semantic search
 *
 * Searches across multiple locales using multilingual embeddings.
 * The embedding model (all-MiniLM-L6-v2) supports multiple languages.
 */
export async function crossLingualSearch(
  query: string,
  locales: LocaleString[],
  options?: SearchOptions
): Promise<GroundingResult> {
  const {
    tiers = ['core', 'working', 'episodic', 'semantic', 'procedural'],
    topK = 10,
    minSimilarity = 0.5,
    budget = createInferenceBudget(),
  } = options || {};

  const traceId = crypto.randomUUID();

  try {
    // Step 1: Generate query embedding (multilingual model)
    const [queryEmbedding] = await generateEmbeddings([query], budget);

    // Step 2: Retrieve items from all specified locales
    const allItems: MemoryItem[] = [];
    for (const tier of tiers) {
      const tierItems = await getAllMemoryItems(tier);
      // Filter by locales
      const localeItems = tierItems.filter((item) => locales.includes(item.locale));
      allItems.push(...localeItems);
    }

    // Step 3: Filter items with embeddings
    const itemsWithEmbeddings = allItems.filter(
      (item) => item.embedding && item.embedding.length > 0
    );

    if (itemsWithEmbeddings.length === 0) {
      return {
        items: [],
        query,
        locale: locales[0] || 'en',
        similarity_scores: [],
        trace_id: traceId,
        retrieved_at: new Date().toISOString(),
      };
    }

    // Step 4: Compute similarity scores
    const embeddings = itemsWithEmbeddings.map((item) => item.embedding!);
    const results = findTopKSimilar(queryEmbedding, embeddings, topK);

    // Step 5: Filter by minimum similarity threshold
    const filtered = results.filter((result) => result.score >= minSimilarity);

    // Step 6: Map to memory items
    const items = filtered.map((result) => itemsWithEmbeddings[result.index]);
    const scores = filtered.map((result) => result.score);

    return {
      items,
      query,
      locale: locales[0] || 'en',
      similarity_scores: scores,
      trace_id: traceId,
      retrieved_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[MAESTRO Cross-Lingual Search] Error:', error);
    // Fail-open for read-only operations
    return {
      items: [],
      query,
      locale: locales[0] || 'en',
      similarity_scores: [],
      trace_id: traceId,
      retrieved_at: new Date().toISOString(),
    };
  }
}

/**
 * Hybrid search (keyword + semantic)
 *
 * Combines keyword matching with semantic similarity.
 */
export async function hybridSearch(
  query: string,
  locale: LocaleString,
  options?: SearchOptions & {
    keywordWeight?: number; // 0-1, weight for keyword matching
    semanticWeight?: number; // 0-1, weight for semantic similarity
  }
): Promise<GroundingResult> {
  const {
    keywordWeight = 0.3,
    semanticWeight = 0.7,
    ...searchOptions
  } = options || {};

  // Step 1: Get semantic search results
  const semanticResults = await semanticSearch(query, locale, searchOptions);

  // Step 2: Perform keyword matching (simple text search)
  const allItems: MemoryItem[] = [];
  const tiers = searchOptions.tiers || [
    'core',
    'working',
    'episodic',
    'semantic',
    'procedural',
  ];
  for (const tier of tiers) {
    const items = await getAllMemoryItems(tier);
    allItems.push(...items);
  }

  const queryLower = query.toLowerCase();
  const keywordMatches = allItems.filter((item) =>
    item.content.toLowerCase().includes(queryLower)
  );

  // Step 3: Combine results with weighted scoring
  const combinedScores = new Map<string, { item: MemoryItem; score: number }>();

  // Add semantic scores
  semanticResults.items.forEach((item, index) => {
    const semanticScore = semanticResults.similarity_scores?.[index] || 0;
    combinedScores.set(item.id, {
      item,
      score: semanticScore * semanticWeight,
    });
  });

  // Add keyword scores
  keywordMatches.forEach((item) => {
    const existing = combinedScores.get(item.id);
    const keywordScore = 1.0; // Binary: match or no match
    const weighted = keywordScore * keywordWeight;

    if (existing) {
      existing.score += weighted;
    } else {
      combinedScores.set(item.id, { item, score: weighted });
    }
  });

  // Step 4: Sort and return top-k
  const sorted = Array.from(combinedScores.values()).sort(
    (a, b) => b.score - a.score
  );
  const topK = searchOptions.topK || 10;
  const topResults = sorted.slice(0, topK);

  return {
    items: topResults.map((r) => r.item),
    query,
    locale,
    similarity_scores: topResults.map((r) => r.score),
    trace_id: crypto.randomUUID(),
    retrieved_at: new Date().toISOString(),
  };
}
