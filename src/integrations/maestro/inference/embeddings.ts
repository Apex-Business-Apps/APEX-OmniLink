/**
 * MAESTRO Embeddings Client
 *
 * Client for generating embeddings via Web Worker.
 * Enforces deterministic budgets and timeouts.
 */

import { createInferenceBudget, checkBudget, updateBudget } from './runtime';
import type { InferenceBudget } from './runtime';

/**
 * Embeddings Worker instance (singleton)
 */
let embeddingsWorker: Worker | null = null;

/**
 * Pending requests map
 */
const pendingRequests = new Map<
  string,
  {
    resolve: (value: number[][]) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();

/**
 * Initialize embeddings worker
 */
export function initEmbeddingsWorker(): Worker {
  if (embeddingsWorker) return embeddingsWorker;

  // Create worker from inline module
  const workerUrl = new URL(
    '../workers/embeddings.worker.ts',
    import.meta.url
  );
  embeddingsWorker = new Worker(workerUrl, { type: 'module' });

  // Handle worker messages
  embeddingsWorker.onmessage = (event) => {
    const response = event.data;

    if (response.type === 'ready') {
      console.log('[MAESTRO Embeddings] Worker ready');
      return;
    }

    const pending = pendingRequests.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    pendingRequests.delete(response.id);

    if (response.type === 'error') {
      pending.reject(new Error(response.error));
    } else if (response.type === 'embeddings') {
      pending.resolve(response.embeddings);
    }
  };

  // Handle worker errors
  embeddingsWorker.onerror = (error) => {
    console.error('[MAESTRO Embeddings] Worker error:', error);
    // Reject all pending requests
    pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Embeddings worker crashed'));
    });
    pendingRequests.clear();
  };

  return embeddingsWorker;
}

/**
 * Generate embeddings for texts
 * @param texts Texts to embed
 * @param budget Inference budget (enforces limits)
 * @param options Embedding options
 */
export async function generateEmbeddings(
  texts: string[],
  budget?: InferenceBudget,
  options?: {
    normalize?: boolean;
    pooling?: 'mean' | 'cls';
    timeout_ms?: number;
  }
): Promise<number[][]> {
  // Check budget
  const effectiveBudget = budget || createInferenceBudget();
  if (!checkBudget(effectiveBudget, 0, texts.length)) {
    throw new Error(
      `Budget exceeded: requested ${texts.length} embeddings, budget allows ${
        effectiveBudget.max_embeddings - effectiveBudget.used_embeddings
      }`
    );
  }

  // Initialize worker
  const worker = initEmbeddingsWorker();

  // Create request
  const requestId = crypto.randomUUID();
  const timeoutMs = options?.timeout_ms || effectiveBudget.timeout_ms;

  // Send request to worker
  return new Promise((resolve, reject) => {
    // Set timeout
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Embeddings generation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Store pending request
    pendingRequests.set(requestId, { resolve, reject, timeout });

    // Post message to worker
    worker.postMessage({
      type: 'embeddings',
      id: requestId,
      texts,
      options: {
        normalize: options?.normalize,
        pooling: options?.pooling,
      },
    });
  }).then((embeddings: number[][]) => {
    // Update budget
    updateBudget(effectiveBudget, 0, texts.length);
    return embeddings;
  });
}

/**
 * Compute cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find top-k most similar embeddings
 * @param query Query embedding
 * @param corpus Corpus embeddings
 * @param k Number of results to return
 * @returns Indices and scores of top-k results
 */
export function findTopKSimilar(
  query: number[],
  corpus: number[][],
  k: number = 10
): Array<{ index: number; score: number }> {
  // Compute similarities
  const similarities = corpus.map((embedding, index) => ({
    index,
    score: cosineSimilarity(query, embedding),
  }));

  // Sort by score descending
  similarities.sort((a, b) => b.score - a.score);

  // Return top-k
  return similarities.slice(0, k);
}

/**
 * Health check for embeddings worker
 */
export async function checkEmbeddingsHealth(): Promise<{
  status: 'ok' | 'error';
  model_loaded: boolean;
  error?: string;
}> {
  try {
    const worker = initEmbeddingsWorker();
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Health check timed out'));
      }, 5000);

      const handler = (event: MessageEvent) => {
        const response = event.data;
        if (response.id === requestId && response.type === 'health') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          resolve(response);
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'health', id: requestId });
    });
  } catch (error) {
    return {
      status: 'error',
      model_loaded: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Terminate embeddings worker
 */
export function terminateEmbeddingsWorker(): void {
  if (embeddingsWorker) {
    // Clear pending requests
    pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker terminated'));
    });
    pendingRequests.clear();

    // Terminate worker
    embeddingsWorker.terminate();
    embeddingsWorker = null;
  }
}
