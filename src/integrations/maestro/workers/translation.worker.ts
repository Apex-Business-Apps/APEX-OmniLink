/**
 * MAESTRO Translation Worker
 *
 * Performs multilingual translation using transformers.js in a Web Worker.
 * Supports forward + back-translation for verification.
 *
 * Uses: Xenova/nllb-200-distilled-600M (200 languages)
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
    translationPipeline = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
      device: 'webgpu',
    });
    return translationPipeline;
  } catch (error) {
    console.warn('[Translation Worker] WebGPU failed, falling back to WASM');
    translationPipeline = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
      device: 'wasm',
    });
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
    if (request.type === 'health') {
      globalThis.postMessage(handleHealthCheck(request, translationPipeline !== null));
      return;
    }

    if (request.type === 'translate') {
      const translation = await translate(
        request.text,
        request.src_lang,
        request.tgt_lang,
        request.options
      );
      const response: TranslateResponse = {
        type: 'translate',
        id: request.id,
        translation,
        duration_ms: Math.round(performance.now() - startTime),
        model: 'Xenova/nllb-200-distilled-600M',
        src_lang: request.src_lang,
        tgt_lang: request.tgt_lang,
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
