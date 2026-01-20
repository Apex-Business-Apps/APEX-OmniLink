/**
 * MAESTRO Memory Ranking
 *
 * Algorithms for ranking and scoring memory items.
 * Considers recency, relevance, provenance, and tier priority.
 */

import type { MemoryItem, MemoryTier } from '../types';

/**
 * Tier priority weights (higher = more important)
 */
const TIER_WEIGHTS: Record<MemoryTier, number> = {
  core: 1, // Highest priority (stable facts)
  semantic: 0.9, // High priority (derived knowledge)
  procedural: 0.8, // Medium-high (versioned recipes)
  episodic: 0.7, // Medium (event history)
  working: 0.6, // Lower priority (temporary context)
};

/**
 * Ranking options
 */
export interface RankingOptions {
  /**
   * Weight for recency (0-1)
   * Higher = prefer recent items
   */
  recencyWeight?: number;

  /**
   * Weight for tier priority (0-1)
   * Higher = prefer core/semantic tiers
   */
  tierWeight?: number;

  /**
   * Weight for provenance count (0-1)
   * Higher = prefer items with more references
   */
  provenanceWeight?: number;

  /**
   * Time decay factor (days)
   * Items lose recency score exponentially
   */
  timeDecayDays?: number;
}

/**
 * Ranking score result
 */
export interface RankingScore {
  item: MemoryItem;
  score: number;
  factors: {
    recency: number;
    tier: number;
    provenance: number;
    total: number;
  };
}

/**
 * Compute recency score (exponential decay)
 * @param createdAt ISO timestamp
 * @param decayDays Time decay factor in days
 */
export function computeRecencyScore(createdAt: string, decayDays: number = 30): number {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const ageMs = now - created;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Exponential decay: score = e^(-age/decay)
  return Math.exp(-ageDays / decayDays);
}

/**
 * Compute tier score
 */
export function computeTierScore(tier: MemoryTier): number {
  return TIER_WEIGHTS[tier] || 0.5;
}

/**
 * Compute provenance score (normalized by max)
 */
export function computeProvenanceScore(
  provenanceRefs: string[],
  maxProvenance: number = 10
): number {
  return Math.min(provenanceRefs.length / maxProvenance, 1);
}

/**
 * Rank memory items by composite score
 * @param items Memory items to rank
 * @param options Ranking options
 */
export function rankMemoryItems(
  items: MemoryItem[],
  options?: RankingOptions
): RankingScore[] {
  const {
    recencyWeight = 0.4,
    tierWeight = 0.3,
    provenanceWeight = 0.3,
    timeDecayDays = 30,
  } = options || {};

  // Normalize weights
  const totalWeight = recencyWeight + tierWeight + provenanceWeight;
  const normRecency = recencyWeight / totalWeight;
  const normTier = tierWeight / totalWeight;
  const normProvenance = provenanceWeight / totalWeight;

  // Find max provenance for normalization
  const maxProvenance = Math.max(
    ...items.map((item) => item.provenance_refs.length),
    1
  );

  // Compute scores for each item
  const scores: RankingScore[] = items.map((item) => {
    const recencyScore = computeRecencyScore(item.created_at, timeDecayDays);
    const tierScore = computeTierScore(item.tier);
    const provenanceScore = computeProvenanceScore(item.provenance_refs, maxProvenance);

    const totalScore =
      recencyScore * normRecency +
      tierScore * normTier +
      provenanceScore * normProvenance;

    return {
      item,
      score: totalScore,
      factors: {
        recency: recencyScore,
        tier: tierScore,
        provenance: provenanceScore,
        total: totalScore,
      },
    };
  });

  // Sort by score descending
  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Deduplicate items by content hash
 * Keeps highest-ranked item for each unique content_hash
 */
export function deduplicateByContentHash(items: MemoryItem[]): MemoryItem[] {
  const seen = new Set<string>();
  const unique: MemoryItem[] = [];

  // Sort by created_at descending (prefer newer duplicates)
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  for (const item of sorted) {
    if (!seen.has(item.content_hash)) {
      seen.add(item.content_hash);
      unique.push(item);
    }
  }

  return unique;
}

/**
 * Filter items by recency threshold
 * @param items Memory items
 * @param maxAgeDays Maximum age in days
 */
export function filterByRecency(items: MemoryItem[], maxAgeDays: number): MemoryItem[] {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.created_at).getTime() >= cutoff);
}

/**
 * Group items by tier
 */
export function groupByTier(items: MemoryItem[]): Record<MemoryTier, MemoryItem[]> {
  const groups: Record<MemoryTier, MemoryItem[]> = {
    core: [],
    working: [],
    episodic: [],
    semantic: [],
    procedural: [],
  };

  for (const item of items) {
    groups[item.tier].push(item);
  }

  return groups;
}

/**
 * Combine and re-rank results from multiple sources
 * Useful for merging semantic + keyword search results
 */
export function mergeAndRerank(
  results: Array<{ items: MemoryItem[]; scores?: number[] }>,
  options?: RankingOptions
): RankingScore[] {
  // Collect all unique items
  const allItems = new Map<string, MemoryItem>();

  for (const result of results) {
    for (const item of result.items) {
      allItems.set(item.id, item);
    }
  }

  // Rank combined items
  return rankMemoryItems(Array.from(allItems.values()), options);
}

/**
 * Apply diversity filter (avoid too many similar items)
 * Ensures maximum N items per tier
 */
export function applyDiversityFilter(
  items: MemoryItem[],
  maxPerTier: number = 3
): MemoryItem[] {
  const tierCounts: Record<string, number> = {};
  const diverse: MemoryItem[] = [];

  for (const item of items) {
    const count = tierCounts[item.tier] || 0;
    if (count < maxPerTier) {
      diverse.push(item);
      tierCounts[item.tier] = count + 1;
    }
  }

  return diverse;
}
