/**
 * MAESTRO Shared Worker Utilities
 * 
 * Shared types and helper functions for Web Workers using Transformers.js
 */

import { pipeline, env } from '@xenova/transformers';

/**
 * Configure transformers.js environment for browser usage
 */
export function configureTransformersEnv(): void {
    env.allowLocalModels = false; // Only use remote models (CDN)
    env.useBrowserCache = true;   // Cache models in browser
    env.allowRemoteModels = true;
}

/**
 * Initialize a Hugging Face pipeline with automatic WebGPU -> WASM fallback
 * 
 * @param task The task name (e.g., 'feature-extraction', 'translation')
 * @param model The model ID (e.g., 'Xenova/all-MiniLM-L6-v2')
 * @param workerName Name of the worker for logging (optional)
 * @returns The initialized pipeline
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initPipelineWithFallback(task: string, model: string, workerName = 'Worker'): Promise<any> {
    try {
        return await pipeline(task, model, {
            device: 'webgpu',
        });
    } catch (error) {
        console.warn(`[${workerName}] WebGPU failed, falling back to WASM`);
        return await pipeline(task, model, {
            device: 'wasm',
        });
    }
}

/**
 * Shared Worker Message Types
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
