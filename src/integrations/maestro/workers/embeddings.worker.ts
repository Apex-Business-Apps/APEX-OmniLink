/**
 * MAESTRO Embeddings Worker
 *
 * Generates sentence embeddings using transformers.js in a Web Worker.
 * Runs off the UI thread for non-blocking inference.
 *
 * Uses: Xenova/all-MiniLM-L6-v2 (384-dimensional embeddings)
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js for browser environment
env.allowLocalModels = false; // Only use remote models (CDN)
env.useBrowserCache = true; // Cache models in browser
env.allowRemoteModels = true;

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

type HealthCheckRequest = {
  type: 'health';
  id: string;
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

type HealthCheckResponse = {
  type: 'health';
  id: string;
  status: 'ok' | 'error';
  model_loaded: boolean;
  error?: string;
};

type ErrorResponse = {
  type: 'error';
  id: string;
  error: string;
};

type WorkerResponse = EmbeddingsResponse | HealthCheckResponse | ErrorResponse;

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
    embeddingsPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        // Use WebGPU if available, fallback to WASM
        device: 'webgpu',
      }
    );
    return embeddingsPipeline;
  } catch (error) {
    // Fallback to WASM if WebGPU fails
    console.warn('[Embeddings Worker] WebGPU failed, falling back to WASM');
    embeddingsPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        device: 'wasm',
      }
    );
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

  // Generate embeddings
  const output = await pipe(texts, {
    pooling: options?.pooling || 'mean',
    normalize: options?.normalize !== false, // Default: normalize
  });

  // Convert to array format
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const embedding = Array.from(output[i].data);
    embeddings.push(embedding);
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
    switch (request.type) {
      case 'embeddings': {
        const embeddings = await generateEmbeddings(request.texts, request.options);
        const duration_ms = Math.round(performance.now() - startTime);

        const response: EmbeddingsResponse = {
          type: 'embeddings',
          id: request.id,
          embeddings,
          duration_ms,
          model: 'Xenova/all-MiniLM-L6-v2',
          dimensions: embeddings[0]?.length || 384,
        };

        self.postMessage(response);
        break;
      }

      case 'health': {
        try {
          const modelLoaded = embeddingsPipeline !== null;
          const response: HealthCheckResponse = {
            type: 'health',
            id: request.id,
            status: 'ok',
            model_loaded: modelLoaded,
          };
          self.postMessage(response);
        } catch (error) {
          const response: HealthCheckResponse = {
            type: 'health',
            id: request.id,
            status: 'error',
            model_loaded: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          self.postMessage(response);
        }
        break;
      }

      default:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error(`Unknown request type: ${(request as any).type}`);
    }
  } catch (error) {
    const errorResponse: ErrorResponse = {
      type: 'error',
      id: request.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(errorResponse);
  }
};

// Signal worker is ready
self.postMessage({ type: 'ready' });
