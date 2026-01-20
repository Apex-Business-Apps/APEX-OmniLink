/**
 * MAESTRO Embeddings Worker
 *
 * Generates sentence embeddings using transformers.js in a Web Worker.
 * Runs off the UI thread for non-blocking inference.
 *
 * Uses: Xenova/all-MiniLM-L6-v2 (384-dimensional embeddings)
 */

import { pipeline } from '@xenova/transformers';
import {
  configureTransformersEnv,
  handleHealthCheck,
  createErrorResponse,
  signalWorkerReady,
  type HealthCheckRequest,
  type ErrorResponse,
} from './worker-utils';

configureTransformersEnv();

/**
 * Worker message types
 */
type EmbeddingsRequest = {
  type: 'embeddings';
  id: string;
  texts: string[];
  options?: {
    normalize?: boolean;
    pooling?: 'mean' | 'cls';
  };
};

type WorkerRequest = EmbeddingsRequest | HealthCheckRequest;

type EmbeddingsResponse = {
  type: 'embeddings';
  id: string;
  embeddings: number[][];
  duration_ms: number;
  model: string;
  dimensions: number;
};

/**
 * Embeddings pipeline (lazy-loaded)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingsPipeline: any = null;

/**
 * Initialize embeddings pipeline
 */
async function initPipeline() {
  if (embeddingsPipeline) return embeddingsPipeline;

  try {
    embeddingsPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      device: 'webgpu',
    });
    return embeddingsPipeline;
  } catch (error) {
    console.warn('[Embeddings Worker] WebGPU failed, falling back to WASM');
    embeddingsPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      device: 'wasm',
    });
    return embeddingsPipeline;
  }
}

/**
 * Generate embeddings for texts
 */
async function generateEmbeddings(
  texts: string[],
  options?: { normalize?: boolean; pooling?: 'mean' | 'cls' }
): Promise<number[][]> {
  const pipe = await initPipeline();

  const output = await pipe(texts, {
    pooling: options?.pooling || 'mean',
    normalize: options?.normalize !== false,
  });

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    embeddings.push(Array.from(output[i].data));
  }

  return embeddings;
}

/**
 * Handle worker messages
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  const startTime = performance.now();

  try {
    if (request.type === 'health') {
      globalThis.postMessage(handleHealthCheck(request, embeddingsPipeline !== null));
      return;
    }

    if (request.type === 'embeddings') {
      const embeddings = await generateEmbeddings(request.texts, request.options);
      const response: EmbeddingsResponse = {
        type: 'embeddings',
        id: request.id,
        embeddings,
        duration_ms: Math.round(performance.now() - startTime),
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: embeddings[0]?.length || 384,
      };
      globalThis.postMessage(response);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(`Unknown request type: ${(request as any).type}`);
  } catch (error) {
    globalThis.postMessage(createErrorResponse(request.id, error));
  }
};

signalWorkerReady();
