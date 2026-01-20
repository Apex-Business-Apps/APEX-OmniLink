/**
 * Shared utilities for MAESTRO web workers
 */

import { env } from '@xenova/transformers';

/**
 * Configure transformers.js for browser environment
 * Call this at the start of every worker
 */
export function configureTransformersEnv(): void {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.allowRemoteModels = true;
}

/**
 * Common worker request/response types
 */
export type HealthCheckRequest = {
  type: 'health';
  id: string;
};

export type HealthCheckResponse = {
  type: 'health';
  id: string;
  status: 'ok' | 'error';
  model_loaded: boolean;
  error?: string;
};

export type ErrorResponse = {
  type: 'error';
  id: string;
  error: string;
};

/**
 * Handle health check requests
 */
export function handleHealthCheck(
  request: HealthCheckRequest,
  pipelineLoaded: boolean
): HealthCheckResponse {
  try {
    return {
      type: 'health',
      id: request.id,
      status: 'ok',
      model_loaded: pipelineLoaded,
    };
  } catch (error) {
    return {
      type: 'health',
      id: request.id,
      status: 'error',
      model_loaded: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create error response
 */
export function createErrorResponse(id: string, error: unknown): ErrorResponse {
  return {
    type: 'error',
    id,
    error: error instanceof Error ? error.message : 'Unknown error',
  };
}

/**
 * Signal worker is ready
 */
export function signalWorkerReady(): void {
  globalThis.postMessage({ type: 'ready' });
}
