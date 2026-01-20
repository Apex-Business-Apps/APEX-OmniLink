/**
 * MAESTRO Inference Integration Tests
 *
 * Tests for browser-only inference (embeddings, translation, summarization).
 * Tests run in Node.js environment, so they mock Worker APIs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  detectInferenceCapabilities,
  createInferenceBudget,
  checkBudget,
  updateBudget,
  isModelAllowlisted,
  getModelConfig,
  ALLOWLISTED_MODELS,
} from '@/integrations/maestro/inference/runtime';
import { cosineSimilarity, findTopKSimilar } from '@/integrations/maestro/inference/embeddings';

describe('MAESTRO Inference Runtime', () => {
  describe('detectInferenceCapabilities', () => {
    it('should detect WASM support', async () => {
      const capabilities = await detectInferenceCapabilities();

      // WASM should always be available
      expect(capabilities.wasm).toBe(true);

      // Preferred backend should be set
      expect(capabilities.preferredBackend).toBeDefined();
      expect(['webgpu', 'wasm', 'none']).toContain(capabilities.preferredBackend);
    });

    it('should return valid capabilities structure', async () => {
      const capabilities = await detectInferenceCapabilities();

      expect(capabilities).toHaveProperty('webgpu');
      expect(capabilities).toHaveProperty('wasm');
      expect(capabilities).toHaveProperty('preferredBackend');
      expect(typeof capabilities.webgpu).toBe('boolean');
      expect(typeof capabilities.wasm).toBe('boolean');
    });
  });

  describe('InferenceBudget', () => {
    it('should create budget with default values', () => {
      const budget = createInferenceBudget();

      expect(budget.max_tokens).toBeGreaterThan(0);
      expect(budget.max_embeddings).toBeGreaterThan(0);
      expect(budget.timeout_ms).toBeGreaterThan(0);
      expect(budget.used_tokens).toBe(0);
      expect(budget.used_embeddings).toBe(0);
      expect(budget.exceeded).toBe(false);
    });

    it('should check budget correctly', () => {
      const budget = createInferenceBudget();

      // Should allow operation within budget
      expect(checkBudget(budget, 10, 5)).toBe(true);

      // Should deny operation exceeding budget
      expect(checkBudget(budget, budget.max_tokens + 1, 0)).toBe(false);
      expect(checkBudget(budget, 0, budget.max_embeddings + 1)).toBe(false);
    });

    it('should update budget correctly', () => {
      const budget = createInferenceBudget();

      updateBudget(budget, 100, 10);

      expect(budget.used_tokens).toBe(100);
      expect(budget.used_embeddings).toBe(10);
      expect(budget.exceeded).toBe(false);

      // Exceed budget
      updateBudget(budget, budget.max_tokens, 0);
      expect(budget.exceeded).toBe(true);
    });

    it('should prevent operations after budget exceeded', () => {
      const budget = createInferenceBudget();
      updateBudget(budget, budget.max_tokens + 1, 0);

      expect(budget.exceeded).toBe(true);
      expect(checkBudget(budget, 1, 0)).toBe(false);
    });
  });

  describe('Model Allowlist', () => {
    it('should have allowlisted models defined', () => {
      expect(ALLOWLISTED_MODELS).toBeDefined();
      expect(ALLOWLISTED_MODELS.length).toBeGreaterThan(0);
    });

    it('should recognize allowlisted models', () => {
      expect(isModelAllowlisted('embeddings')).toBe(true);
      expect(isModelAllowlisted('translation-en-to-multi')).toBe(true);
      expect(isModelAllowlisted('summarization')).toBe(true);
    });

    it('should reject non-allowlisted models', () => {
      expect(isModelAllowlisted('malicious-model')).toBe(false);
      expect(isModelAllowlisted('random-model')).toBe(false);
    });

    it('should get model config by name', () => {
      const config = getModelConfig('embeddings');

      expect(config).toBeDefined();
      expect(config?.name).toBe('embeddings');
      expect(config?.modelId).toBeDefined();
      expect(config?.description).toBeDefined();
    });
  });
});

describe('MAESTRO Embeddings', () => {
  describe('cosineSimilarity', () => {
    it('should compute similarity between identical vectors', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should compute similarity between orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should compute similarity between opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should compute similarity between arbitrary vectors', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should throw error for vectors with different dimensions', () => {
      const a = [1, 0];
      const b = [1, 0, 0];

      expect(() => cosineSimilarity(a, b)).toThrow();
    });
  });

  describe('findTopKSimilar', () => {
    it('should find top-k similar vectors', () => {
      const query = [1, 0, 0];
      const corpus = [
        [1, 0, 0],    // similarity = 1.0
        [0.9, 0.1, 0], // similarity ~ 0.995
        [0, 1, 0],    // similarity = 0
        [0.5, 0.5, 0], // similarity ~ 0.707
      ];

      const results = findTopKSimilar(query, corpus, 2);

      expect(results.length).toBe(2);
      expect(results[0].index).toBe(0); // Most similar
      expect(results[0].score).toBeCloseTo(1.0, 2);
      expect(results[1].index).toBe(1); // Second most similar
    });

    it('should return all results if k > corpus size', () => {
      const query = [1, 0, 0];
      const corpus = [
        [1, 0, 0],
        [0, 1, 0],
      ];

      const results = findTopKSimilar(query, corpus, 10);

      expect(results.length).toBe(2);
    });

    it('should sort results by descending similarity', () => {
      const query = [1, 0, 0];
      const corpus = [
        [0, 1, 0],    // Low similarity
        [1, 0, 0],    // High similarity
        [0.5, 0.5, 0], // Medium similarity
      ];

      const results = findTopKSimilar(query, corpus, 3);

      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[1].score).toBeGreaterThan(results[2].score);
    });
  });
});

describe('MAESTRO Budget Enforcement', () => {
  it('should enforce token limits', () => {
    const budget = createInferenceBudget();
    const initialMax = budget.max_tokens;

    // Use tokens within budget
    for (let i = 0; i < initialMax / 10; i++) {
      if (checkBudget(budget, 10)) {
        updateBudget(budget, 10);
      }
    }

    expect(budget.used_tokens).toBeLessThanOrEqual(budget.max_tokens);

    // Try to exceed budget
    const canExceed = checkBudget(budget, budget.max_tokens);
    expect(canExceed).toBe(false);
  });

  it('should enforce embedding limits', () => {
    const budget = createInferenceBudget();

    // Use embeddings within budget
    const embeddingsToUse = Math.floor(budget.max_embeddings / 2);
    updateBudget(budget, 0, embeddingsToUse);

    expect(budget.used_embeddings).toBe(embeddingsToUse);
    expect(budget.exceeded).toBe(false);

    // Exceed embedding budget
    updateBudget(budget, 0, budget.max_embeddings);
    expect(budget.exceeded).toBe(true);
  });

  it('should prevent all operations after budget exceeded', () => {
    const budget = createInferenceBudget();

    // Exceed budget
    updateBudget(budget, budget.max_tokens + 1, 0);

    // All subsequent checks should fail
    expect(checkBudget(budget, 1, 0)).toBe(false);
    expect(checkBudget(budget, 0, 1)).toBe(false);
    expect(checkBudget(budget, 1, 1)).toBe(false);
  });
});
