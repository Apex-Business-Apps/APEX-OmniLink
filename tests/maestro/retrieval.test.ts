/**
 * MAESTRO Retrieval Integration Tests
 *
 * Tests for semantic search, ranking, and locale handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  rankMemoryItems,
  computeRecencyScore,
  computeTierScore,
  computeProvenanceScore,
  deduplicateByContentHash,
  filterByRecency,
  groupByTier,
} from '@/integrations/maestro/retrieval/ranking';
import {
  isValidBcp47Locale,
  parseBcp47Locale,
  getLanguage,
  getRegion,
  sameLanguage,
  getLocaleFallbackChain,
  normalizeLocale,
  assertValidLocale,
} from '@/integrations/maestro/utils/locale';
import type { MemoryItem } from '@/integrations/maestro/types';

// Test fixtures
const createMemoryItem = (overrides?: Partial<MemoryItem>): MemoryItem => ({
  id: crypto.randomUUID(),
  tier: 'working',
  locale: 'en-US',
  content: 'Test content',
  content_hash: 'a'.repeat(64),
  provenance_refs: [],
  created_at: new Date().toISOString(),
  key_version: 1,
  ...overrides,
});

describe('MAESTRO Ranking', () => {
  describe('computeRecencyScore', () => {
    it('should give high score to recent items', () => {
      const now = new Date();
      const score = computeRecencyScore(now.toISOString(), 30);

      expect(score).toBeGreaterThan(0.9);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should give low score to old items', () => {
      const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
      const score = computeRecencyScore(oldDate.toISOString(), 30);

      expect(score).toBeLessThan(0.1);
      expect(score).toBeGreaterThan(0);
    });

    it('should decay exponentially', () => {
      const day1 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const day10 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const day30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const score1 = computeRecencyScore(day1.toISOString(), 30);
      const score10 = computeRecencyScore(day10.toISOString(), 30);
      const score30 = computeRecencyScore(day30.toISOString(), 30);

      expect(score1).toBeGreaterThan(score10);
      expect(score10).toBeGreaterThan(score30);
    });
  });

  describe('computeTierScore', () => {
    it('should rank core highest', () => {
      const coreScore = computeTierScore('core');
      const workingScore = computeTierScore('working');

      expect(coreScore).toBeGreaterThan(workingScore);
    });

    it('should rank semantic higher than episodic', () => {
      const semanticScore = computeTierScore('semantic');
      const episodicScore = computeTierScore('episodic');

      expect(semanticScore).toBeGreaterThan(episodicScore);
    });

    it('should return consistent scores', () => {
      expect(computeTierScore('core')).toBe(1.0);
      expect(computeTierScore('semantic')).toBe(0.9);
      expect(computeTierScore('procedural')).toBe(0.8);
      expect(computeTierScore('episodic')).toBe(0.7);
      expect(computeTierScore('working')).toBe(0.6);
    });
  });

  describe('computeProvenanceScore', () => {
    it('should give 0 for no provenance', () => {
      const score = computeProvenanceScore([], 10);
      expect(score).toBe(0);
    });

    it('should give 1 for max provenance', () => {
      const refs = Array.from({ length: 10 }, (_, i) => `ref-${i}`);
      const score = computeProvenanceScore(refs, 10);
      expect(score).toBe(1.0);
    });

    it('should scale linearly', () => {
      const score5 = computeProvenanceScore(['a', 'b', 'c', 'd', 'e'], 10);
      expect(score5).toBeCloseTo(0.5, 1);
    });

    it('should cap at 1.0', () => {
      const refs = Array.from({ length: 20 }, (_, i) => `ref-${i}`);
      const score = computeProvenanceScore(refs, 10);
      expect(score).toBe(1.0);
    });
  });

  describe('rankMemoryItems', () => {
    it('should rank recent core items highest', () => {
      const items: MemoryItem[] = [
        createMemoryItem({ id: '1', tier: 'working', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }),
        createMemoryItem({ id: '2', tier: 'core', created_at: new Date().toISOString() }),
        createMemoryItem({ id: '3', tier: 'episodic', created_at: new Date().toISOString() }),
      ];

      const ranked = rankMemoryItems(items);

      expect(ranked[0].item.id).toBe('2'); // Recent core item
      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });

    it('should respect custom weights', () => {
      const items: MemoryItem[] = [
        createMemoryItem({ id: '1', tier: 'core', created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() }),
        createMemoryItem({ id: '2', tier: 'working', created_at: new Date().toISOString() }),
      ];

      // Favor tier over recency
      const tierFocused = rankMemoryItems(items, {
        tierWeight: 0.9,
        recencyWeight: 0.1,
        provenanceWeight: 0,
      });

      expect(tierFocused[0].item.id).toBe('1'); // Core tier wins

      // Favor recency over tier
      const recencyFocused = rankMemoryItems(items, {
        tierWeight: 0.1,
        recencyWeight: 0.9,
        provenanceWeight: 0,
      });

      expect(recencyFocused[0].item.id).toBe('2'); // Recent item wins
    });

    it('should include all ranking factors', () => {
      const items: MemoryItem[] = [
        createMemoryItem({ provenance_refs: ['ref1', 'ref2', 'ref3'] }),
      ];

      const ranked = rankMemoryItems(items);

      expect(ranked[0].factors).toHaveProperty('recency');
      expect(ranked[0].factors).toHaveProperty('tier');
      expect(ranked[0].factors).toHaveProperty('provenance');
      expect(ranked[0].factors).toHaveProperty('total');
    });
  });

  describe('deduplicateByContentHash', () => {
    it('should remove duplicate content hashes', () => {
      const hash = 'a'.repeat(64);
      const items: MemoryItem[] = [
        createMemoryItem({ id: '1', content_hash: hash }),
        createMemoryItem({ id: '2', content_hash: hash }),
        createMemoryItem({ id: '3', content_hash: 'b'.repeat(64) }),
      ];

      const unique = deduplicateByContentHash(items);

      expect(unique.length).toBe(2);
      expect(new Set(unique.map((i) => i.content_hash)).size).toBe(2);
    });

    it('should keep newest duplicate', () => {
      const hash = 'a'.repeat(64);
      const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recent = new Date().toISOString();

      const items: MemoryItem[] = [
        createMemoryItem({ id: 'old', content_hash: hash, created_at: old }),
        createMemoryItem({ id: 'new', content_hash: hash, created_at: recent }),
      ];

      const unique = deduplicateByContentHash(items);

      expect(unique.length).toBe(1);
      expect(unique[0].id).toBe('new');
    });
  });

  describe('filterByRecency', () => {
    it('should filter out old items', () => {
      const recent = new Date().toISOString();
      const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

      const items: MemoryItem[] = [
        createMemoryItem({ id: 'recent', created_at: recent }),
        createMemoryItem({ id: 'old', created_at: old }),
      ];

      const filtered = filterByRecency(items, 30);

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('recent');
    });

    it('should keep all recent items', () => {
      const items: MemoryItem[] = [
        createMemoryItem({ created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }),
        createMemoryItem({ created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }),
        createMemoryItem({ created_at: new Date().toISOString() }),
      ];

      const filtered = filterByRecency(items, 30);

      expect(filtered.length).toBe(3);
    });
  });

  describe('groupByTier', () => {
    it('should group items by tier', () => {
      const items: MemoryItem[] = [
        createMemoryItem({ tier: 'core' }),
        createMemoryItem({ tier: 'core' }),
        createMemoryItem({ tier: 'working' }),
        createMemoryItem({ tier: 'semantic' }),
      ];

      const groups = groupByTier(items);

      expect(groups.core.length).toBe(2);
      expect(groups.working.length).toBe(1);
      expect(groups.semantic.length).toBe(1);
      expect(groups.episodic.length).toBe(0);
      expect(groups.procedural.length).toBe(0);
    });
  });
});

describe('MAESTRO Locale Handling', () => {
  describe('isValidBcp47Locale', () => {
    it('should validate simple language codes', () => {
      expect(isValidBcp47Locale('en')).toBe(true);
      expect(isValidBcp47Locale('fr')).toBe(true);
      expect(isValidBcp47Locale('zh')).toBe(true);
    });

    it('should validate language-region codes', () => {
      expect(isValidBcp47Locale('en-US')).toBe(true);
      expect(isValidBcp47Locale('fr-FR')).toBe(true);
      expect(isValidBcp47Locale('zh-CN')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidBcp47Locale('EN')).toBe(false); // Uppercase language
      expect(isValidBcp47Locale('en-us')).toBe(false); // Lowercase region
      expect(isValidBcp47Locale('invalid')).toBe(false); // Too long
      expect(isValidBcp47Locale('e')).toBe(false); // Too short
    });
  });

  describe('parseBcp47Locale', () => {
    it('should parse simple language codes', () => {
      const parsed = parseBcp47Locale('en');

      expect(parsed).toEqual({ language: 'en' });
    });

    it('should parse language-region codes', () => {
      const parsed = parseBcp47Locale('en-US');

      expect(parsed).toEqual({
        language: 'en',
        region: 'US',
      });
    });

    it('should return null for invalid locales', () => {
      expect(parseBcp47Locale('INVALID')).toBeNull();
      expect(parseBcp47Locale('en-us')).toBeNull(); // Lowercase region
    });
  });

  describe('getLanguage', () => {
    it('should extract language from locale', () => {
      expect(getLanguage('en-US')).toBe('en');
      expect(getLanguage('fr-FR')).toBe('fr');
      expect(getLanguage('zh-CN')).toBe('zh');
    });

    it('should handle simple language codes', () => {
      expect(getLanguage('en')).toBe('en');
    });
  });

  describe('getRegion', () => {
    it('should extract region from locale', () => {
      expect(getRegion('en-US')).toBe('US');
      expect(getRegion('fr-CA')).toBe('CA');
    });

    it('should return null for simple language codes', () => {
      expect(getRegion('en')).toBeNull();
    });
  });

  describe('sameLanguage', () => {
    it('should match same language with different regions', () => {
      expect(sameLanguage('en-US', 'en-GB')).toBe(true);
      expect(sameLanguage('fr-FR', 'fr-CA')).toBe(true);
    });

    it('should not match different languages', () => {
      expect(sameLanguage('en-US', 'fr-FR')).toBe(false);
      expect(sameLanguage('zh-CN', 'ja-JP')).toBe(false);
    });
  });

  describe('getLocaleFallbackChain', () => {
    it('should generate fallback chain', () => {
      const chain = getLocaleFallbackChain('en-US');

      expect(chain).toEqual(['en-US', 'en']);
    });

    it('should handle simple language codes', () => {
      const chain = getLocaleFallbackChain('en');

      expect(chain).toEqual(['en']);
    });
  });

  describe('normalizeLocale', () => {
    it('should normalize locale format', () => {
      expect(normalizeLocale('en-us')).toBe('en-US');
      expect(normalizeLocale('EN-US')).toBe('en-US');
      expect(normalizeLocale('En-Us')).toBe('en-US');
    });

    it('should handle simple language codes', () => {
      expect(normalizeLocale('EN')).toBe('en');
      expect(normalizeLocale('en')).toBe('en');
    });
  });

  describe('assertValidLocale', () => {
    it('should not throw for valid locales', () => {
      expect(() => assertValidLocale('en-US')).not.toThrow();
      expect(() => assertValidLocale('fr')).not.toThrow();
    });

    it('should throw for invalid locales', () => {
      expect(() => assertValidLocale('INVALID')).toThrow('Invalid BCP-47 locale');
      expect(() => assertValidLocale('en-us')).toThrow();
    });
  });
});
