/**
 * MAESTRO Embeddings Client
 *
 * Client for generating embeddings via Web Worker.
 * Enforces deterministic budgets and timeouts.
 */

import { createInferenceBudget, checkBudget, updateBudget } from './runtime';
import type { InferenceBudget } from './runtime';
import {
  type PendingRequest,
  type HealthCheckResponse,
  performHealthCheck,
  createWorkerRequest,
  handleWorkerResponse,
  clearPendingRequests
} from './client-base';

/**
 * Embeddings Worker instance (singleton)
 */
let embeddingsWorker: Worker | null = null;

/**
 * Pending requests map
 */
const pendingRequests = new Map<string, PendingRequest<number[][]>>();

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
      // eslint-disable-next-line no-console
      console.log('[MAESTRO Embeddings] Worker ready');
      return;
    }

    if (response.type === 'error') {
      handleWorkerResponse(pendingRequests, response.id, null, response.error);
    } else if (response.type === 'embeddings') {
      handleWorkerResponse(pendingRequests, response.id, response.embeddings);
    }
  };

  // Handle worker errors
  embeddingsWorker.onerror = (error) => {
    console.error('[MAESTRO Embeddings] Worker error:', error);
    clearPendingRequests(pendingRequests, 'Embeddings worker crashed');
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
      `Budget exceeded: requested ${texts.length} embeddings, budget allows ${effectiveBudget.max_embeddings - effectiveBudget.used_embeddings
      }`
    );
  }

  // Initialize worker
  const worker = initEmbeddingsWorker();

  // Create request
  const requestId = crypto.randomUUID();
  const timeoutMs = options?.timeout_ms || effectiveBudget.timeout_ms;

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

  // Wait for response
  const embeddings = await createWorkerRequest(
    pendingRequests,
    requestId,
    timeoutMs,
    `Embeddings generation timed out after ${timeoutMs}ms`
  );

  // Update budget
  updateBudget(effectiveBudget, 0, texts.length);
  return embeddings;
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
export async function checkEmbeddingsHealth(): Promise<HealthCheckResponse> {
  return performHealthCheck(initEmbeddingsWorker, 'Embeddings Worker');
}

/**
 * Terminate embeddings worker
 */
export function terminateEmbeddingsWorker(): void {
  if (embeddingsWorker) {
    clearPendingRequests(pendingRequests, 'Worker terminated');
    embeddingsWorker.terminate();
    embeddingsWorker = null;
  }
}
