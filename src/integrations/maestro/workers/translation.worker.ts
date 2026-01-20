/**
 * MAESTRO Translation Worker
 *
 * Performs multilingual translation using transformers.js in a Web Worker.
 * Supports forward + back-translation for verification.
 *
 * Uses: Xenova/nllb-200-distilled-600M (200 languages)
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js for browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;
env.allowRemoteModels = true;

/**
 * Worker message types
 */
type TranslateRequest = {
  type: 'translate';
  id: string;
  text: string;
  src_lang: string;
  tgt_lang: string;
  options?: {
    max_length?: number;
  };
};

type HealthCheckRequest = {
  type: 'health';
  id: string;
};

type WorkerRequest = TranslateRequest | HealthCheckRequest;

type TranslateResponse = {
  type: 'translate';
  id: string;
  translation: string;
  duration_ms: number;
  model: string;
  src_lang: string;
  tgt_lang: string;
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

type WorkerResponse = TranslateResponse | HealthCheckResponse | ErrorResponse;

/**
 * Translation pipeline (lazy-loaded)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let translationPipeline: any = null;

/**
 * Initialize translation pipeline
 */
async function initPipeline() {
  if (translationPipeline) return translationPipeline;

  try {
    translationPipeline = await pipeline(
      'translation',
      'Xenova/nllb-200-distilled-600M',
      {
        device: 'webgpu',
      }
    );
    return translationPipeline;
  } catch (error) {
    console.warn('[Translation Worker] WebGPU failed, falling back to WASM');
    translationPipeline = await pipeline(
      'translation',
      'Xenova/nllb-200-distilled-600M',
      {
        device: 'wasm',
      }
    );
    return translationPipeline;
  }
}

/**
 * Translate text
 */
async function translate(
  text: string,
  src_lang: string,
  tgt_lang: string,
  options?: { max_length?: number }
): Promise<string> {
  const pipe = await initPipeline();

  // Translate
  const output = await pipe(text, {
    src_lang,
    tgt_lang,
    max_length: options?.max_length || 512,
  });

  return output[0].translation_text;
}

/**
 * Handle worker messages
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  const startTime = performance.now();

  try {
    switch (request.type) {
      case 'translate': {
        const translation = await translate(
          request.text,
          request.src_lang,
          request.tgt_lang,
          request.options
        );
        const duration_ms = Math.round(performance.now() - startTime);

        const response: TranslateResponse = {
          type: 'translate',
          id: request.id,
          translation,
          duration_ms,
          model: 'Xenova/nllb-200-distilled-600M',
          src_lang: request.src_lang,
          tgt_lang: request.tgt_lang,
        };

        globalThis.postMessage(response);
        break;
      }

      case 'health': {
        try {
          const modelLoaded = translationPipeline !== null;
          const response: HealthCheckResponse = {
            type: 'health',
            id: request.id,
            status: 'ok',
            model_loaded: modelLoaded,
          };
          globalThis.postMessage(response);
        } catch (error) {
          const response: HealthCheckResponse = {
            type: 'health',
            id: request.id,
            status: 'error',
            model_loaded: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          globalThis.postMessage(response);
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
    globalThis.postMessage(errorResponse);
  }
};

// Signal worker is ready
globalThis.postMessage({ type: 'ready' });
