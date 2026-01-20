/**
 * MAESTRO Translation Client
 *
 * Client for multilingual translation via Web Worker.
 * Includes back-translation verification (fail-closed).
 */

import { createInferenceBudget, checkBudget, updateBudget } from './runtime';
import { generateEmbeddings, cosineSimilarity } from './embeddings';
import type { InferenceBudget } from './runtime';
import type { TranslationVerification } from '../types';

/**
 * Translation Worker instance (singleton)
 */
let translationWorker: Worker | null = null;

/**
 * Pending requests map
 */
const pendingRequests = new Map<
  string,
  {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();

/**
 * Similarity threshold for back-translation verification
 * If similarity < threshold, translation is considered FAILED
 */
const BACK_TRANSLATION_THRESHOLD = 0.75;

/**
 * Initialize translation worker
 */
export function initTranslationWorker(): Worker {
  if (translationWorker) return translationWorker;

  const workerUrl = new URL(
    '../workers/translation.worker.ts',
    import.meta.url
  );
  translationWorker = new Worker(workerUrl, { type: 'module' });

  // Handle worker messages
  translationWorker.onmessage = (event) => {
    const response = event.data;

    if (response.type === 'ready') {
      // eslint-disable-next-line no-console
      console.log('[MAESTRO Translation] Worker ready');
      return;
    }

    const pending = pendingRequests.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    pendingRequests.delete(response.id);

    if (response.type === 'error') {
      pending.reject(new Error(response.error));
    } else if (response.type === 'translate') {
      pending.resolve(response.translation);
    }
  };

  // Handle worker errors
  translationWorker.onerror = (error) => {
    console.error('[MAESTRO Translation] Worker error:', error);
    pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Translation worker crashed'));
    });
    pendingRequests.clear();
  };

  return translationWorker;
}

/**
 * Translate text
 * @param text Text to translate
 * @param src_lang Source language (BCP-47)
 * @param tgt_lang Target language (BCP-47)
 * @param budget Inference budget
 */
export async function translateText(
  text: string,
  src_lang: string,
  tgt_lang: string,
  budget?: InferenceBudget,
  options?: {
    max_length?: number;
    timeout_ms?: number;
  }
): Promise<string> {
  // Check budget (estimate ~50 tokens for translation)
  const effectiveBudget = budget || createInferenceBudget();
  const estimatedTokens = 50;
  if (!checkBudget(effectiveBudget, estimatedTokens)) {
    throw new Error('Budget exceeded for translation');
  }

  // Initialize worker
  const worker = initTranslationWorker();

  // Create request
  const requestId = crypto.randomUUID();
  const timeoutMs = options?.timeout_ms || effectiveBudget.timeout_ms;

  // Send request to worker
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Translation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    worker.postMessage({
      type: 'translate',
      id: requestId,
      text,
      src_lang,
      tgt_lang,
      options: {
        max_length: options?.max_length,
      },
    });
  }).then((translation: string) => {
    updateBudget(effectiveBudget, estimatedTokens);
    return translation;
  });
}

/**
 * Translate with back-translation verification (FAIL-CLOSED)
 *
 * Process:
 * 1. Translate: src_lang → tgt_lang
 * 2. Back-translate: tgt_lang → src_lang
 * 3. Compute similarity: original vs back-translated
 * 4. If similarity < threshold: FAIL (return verification result)
 * 5. If similarity >= threshold: PASS (return translation)
 */
export async function translateWithVerification(
  text: string,
  src_lang: string,
  tgt_lang: string,
  budget?: InferenceBudget,
  options?: {
    max_length?: number;
    timeout_ms?: number;
    threshold?: number;
  }
): Promise<TranslationVerification> {
  const threshold = options?.threshold || BACK_TRANSLATION_THRESHOLD;
  const effectiveBudget = budget || createInferenceBudget();

  try {
    // Step 1: Forward translation (src → tgt)
    const translated = await translateText(
      text,
      src_lang,
      tgt_lang,
      effectiveBudget,
      options
    );

    // Step 2: Back-translation (tgt → src)
    const backTranslated = await translateText(
      translated,
      tgt_lang,
      src_lang,
      effectiveBudget,
      options
    );

    // Step 3: Compute similarity using embeddings
    const [originalEmbedding, backEmbedding] = await generateEmbeddings(
      [text, backTranslated],
      effectiveBudget
    );

    const similarity = cosineSimilarity(originalEmbedding, backEmbedding);

    // Step 4: Check if similarity meets threshold
    const passed = similarity >= threshold;

    return {
      original_text: text,
      original_locale: src_lang,
      translated_text: translated,
      target_locale: tgt_lang,
      back_translated_text: backTranslated,
      similarity_score: similarity,
      threshold,
      passed,
      translation_status: passed ? 'SUCCESS' : 'FAILED',
    };
  } catch (error) {
    // Translation failed (timeout, error, etc.)
    return {
      original_text: text,
      original_locale: src_lang,
      translated_text: '',
      target_locale: tgt_lang,
      back_translated_text: '',
      similarity_score: 0,
      threshold,
      passed: false,
      translation_status: 'FAILED',
    };
  }
}

/**
 * Batch translate multiple texts
 */
export async function batchTranslate(
  texts: string[],
  src_lang: string,
  tgt_lang: string,
  budget?: InferenceBudget,
  options?: {
    max_length?: number;
    timeout_ms?: number;
  }
): Promise<string[]> {
  const translations: string[] = [];

  for (const text of texts) {
    const translation = await translateText(text, src_lang, tgt_lang, budget, options);
    translations.push(translation);
  }

  return translations;
}

/**
 * Health check for translation worker
 */
export async function checkTranslationHealth(): Promise<{
  status: 'ok' | 'error';
  model_loaded: boolean;
  error?: string;
}> {
  try {
    const worker = initTranslationWorker();
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
 * Terminate translation worker
 */
export function terminateTranslationWorker(): void {
  if (translationWorker) {
    pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker terminated'));
    });
    pendingRequests.clear();

    translationWorker.terminate();
    translationWorker = null;
  }
}
