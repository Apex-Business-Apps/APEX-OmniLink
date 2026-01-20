/**
 * MAESTRO Summarization Client
 *
 * Text summarization and memory compaction.
 * Uses transformers.js DistilBART model in Web Worker.
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
 * Summarization Worker instance (singleton)
 */
let summarizationWorker: Worker | null = null;

/**
 * Pending requests map
 */
const pendingRequests = new Map<string, PendingRequest<string>>();

/**
 * Initialize summarization worker
 */
export function initSummarizationWorker(): Worker {
  if (summarizationWorker) return summarizationWorker;

  // Phase 2: Inline stub worker (full implementation in next iteration)
  const workerCode = `
    import { pipeline, env } from '@xenova/transformers';

    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.allowRemoteModels = true;

    let summarizationPipeline = null;

    async function initPipeline() {
      if (summarizationPipeline) return summarizationPipeline;
      try {
        summarizationPipeline = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', { device: 'webgpu' });
      } catch {
        summarizationPipeline = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', { device: 'wasm' });
      }
      return summarizationPipeline;
    }

    self.onmessage = async (event) => {
      const { type, id, text, options } = event.data;
      const startTime = performance.now();

      try {
        if (type === 'summarize') {
          const pipe = await initPipeline();
          const output = await pipe(text, {
            max_length: options?.max_length || 150,
            min_length: options?.min_length || 50,
          });

          self.postMessage({
            type: 'summarize',
            id,
            summary: output[0].summary_text,
            duration_ms: Math.round(performance.now() - startTime),
          });
        } else if (type === 'health') {
          self.postMessage({
            type: 'health',
            id,
            status: 'ok',
            model_loaded: summarizationPipeline !== null,
          });
        }
      } catch (error) {
        self.postMessage({
          type: 'error',
          id,
          error: error.message,
        });
      }
    };

    self.postMessage({ type: 'ready' });
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  summarizationWorker = new Worker(workerUrl, { type: 'module' });

  // Handle worker messages
  summarizationWorker.onmessage = (event) => {
    const response = event.data;

    if (response.type === 'ready') {
      // eslint-disable-next-line no-console
      console.log('[MAESTRO Summarization] Worker ready');
      return;
    }

    if (response.type === 'error') {
      handleWorkerResponse(pendingRequests, response.id, null, response.error);
    } else if (response.type === 'summarize') {
      handleWorkerResponse(pendingRequests, response.id, response.summary);
    }
  };

  // Handle worker errors
  summarizationWorker.onerror = (error) => {
    console.error('[MAESTRO Summarization] Worker error:', error);
    clearPendingRequests(pendingRequests, 'Summarization worker crashed');
  };

  return summarizationWorker;
}

/**
 * Summarize text
 */
export async function summarizeText(
  text: string,
  budget?: InferenceBudget,
  options?: {
    max_length?: number;
    min_length?: number;
    timeout_ms?: number;
  }
): Promise<string> {
  // Check budget (estimate ~100 tokens for summarization)
  const effectiveBudget = budget || createInferenceBudget();
  const estimatedTokens = 100;
  if (!checkBudget(effectiveBudget, estimatedTokens)) {
    throw new Error('Budget exceeded for summarization');
  }

  // Initialize worker
  const worker = initSummarizationWorker();

  // Create request
  const requestId = crypto.randomUUID();
  const timeoutMs = options?.timeout_ms || effectiveBudget.timeout_ms;

  // Post message to worker
  worker.postMessage({
    type: 'summarize',
    id: requestId,
    text,
    options: {
      max_length: options?.max_length,
      min_length: options?.min_length,
    },
  });

  // Wait for response
  const summary = await createWorkerRequest(
    pendingRequests,
    requestId,
    timeoutMs,
    `Summarization timed out after ${timeoutMs}ms`
  );

  // Update budget
  updateBudget(effectiveBudget, estimatedTokens);
  return summary;
}

/**
 * Compact memory tier by summarizing old items
 */
export async function compactMemory(
  items: Array<{ content: string; created_at: string }>,
  budget?: InferenceBudget
): Promise<string> {
  // Sort by age (oldest first)
  const sorted = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Concatenate content
  const combined = sorted.map((item) => item.content).join('\n\n');

  // Summarize
  return summarizeText(combined, budget, {
    max_length: 200,
    min_length: 50,
  });
}

/**
 * Health check for summarization worker
 */
export async function checkSummarizationHealth(): Promise<HealthCheckResponse> {
  return performHealthCheck(initSummarizationWorker, 'Summarization Worker');
}

/**
 * Terminate summarization worker
 */
export function terminateSummarizationWorker(): void {
  if (summarizationWorker) {
    clearPendingRequests(pendingRequests, 'Worker terminated');
    summarizationWorker.terminate();
    summarizationWorker = null;
  }
}
