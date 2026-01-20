import { configureTransformersEnv, initPipelineWithFallback, HealthCheckRequest, HealthCheckResponse, ErrorResponse } from './shared';

// Configure transformers.js for browser environment
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
  options?: {
    max_length?: number;
  };
};

type _WorkerResponse = TranslateResponse | HealthCheckResponse | ErrorResponse;

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

  translationPipeline = await initPipelineWithFallback(
    'translation',
    'Xenova/nllb-200-distilled-600M',
    'Translation Worker'
  );
  return translationPipeline;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any = await pipe(text, {
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

        self.postMessage(response);
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
