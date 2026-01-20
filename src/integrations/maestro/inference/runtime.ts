/**
 * MAESTRO Inference Runtime
 *
 * Wrapper for transformers.js providing browser-only AI compute.
 * Uses WebGPU (primary) or WASM (fallback) in Web Workers only.
 *
 * CONSTRAINTS:
 * - Allowlisted models only (no arbitrary downloads)
 * - Integrity checks on model assets
 * - Deterministic budgets (MAX_TOKENS, timeout)
 * - Workers-only (no UI thread inference)
 */

import { getMaestroConfig } from '../config';

/**
 * Allowlisted models with integrity hashes
 * Format: { name, url, sha256 }
 */
export const ALLOWLISTED_MODELS = [
  {
    name: 'embeddings',
    modelId: 'Xenova/all-MiniLM-L6-v2',
    description: 'Sentence embeddings (384-dim)',
    sha256: '', // TODO: Add after initial model download
  },
  {
    name: 'translation-en-to-multi',
    modelId: 'Xenova/nllb-200-distilled-600M',
    description: 'Multilingual translation (200 languages)',
    sha256: '', // TODO: Add after initial model download
  },
  {
    name: 'summarization',
    modelId: 'Xenova/distilbart-cnn-6-6',
    description: 'Text summarization',
    sha256: '', // TODO: Add after initial model download
  },
] as const;

/**
 * Model type union
 */
export type AllowlistedModelName = (typeof ALLOWLISTED_MODELS)[number]['name'];

/**
 * Inference backend type
 */
export type InferenceBackend = 'webgpu' | 'wasm' | 'none';

/**
 * Inference capabilities
 */
export interface InferenceCapabilities {
  webgpu: boolean;
  wasm: boolean;
  preferredBackend: InferenceBackend;
  gpu?: {
    vendor?: string;
    renderer?: string;
  };
}

/**
 * Detect inference capabilities
 */
export async function detectInferenceCapabilities(): Promise<InferenceCapabilities> {
  const capabilities: InferenceCapabilities = {
    webgpu: false,
    wasm: false,
    preferredBackend: 'none',
  };

  // Check WebGPU support
  if ('gpu' in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        capabilities.webgpu = true;
        capabilities.preferredBackend = 'webgpu';

        // Get GPU info
        const adapterInfo = adapter.info || {};
        capabilities.gpu = {
          vendor: adapterInfo.vendor || 'unknown',
          renderer: adapterInfo.device || 'unknown',
        };
      }
    } catch (error) {
      console.warn('[MAESTRO Inference] WebGPU not available:', error);
    }
  }

  // Check WASM support (always available in modern browsers)
  if (typeof WebAssembly !== 'undefined') {
    capabilities.wasm = true;
    if (capabilities.preferredBackend === 'none') {
      capabilities.preferredBackend = 'wasm';
    }
  }

  return capabilities;
}

/**
 * Inference request
 */
export interface InferenceRequest {
  modelName: AllowlistedModelName;
  input: string | string[];
  options?: {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
  };
}

/**
 * Inference response
 */
export interface InferenceResponse {
  output: any;
  tokens_used: number;
  duration_ms: number;
  backend: InferenceBackend;
}

/**
 * Inference budget
 */
export interface InferenceBudget {
  max_tokens: number;
  max_embeddings: number;
  timeout_ms: number;
  used_tokens: number;
  used_embeddings: number;
  exceeded: boolean;
}

/**
 * Create inference budget from config
 */
export function createInferenceBudget(): InferenceBudget {
  const config = getMaestroConfig();
  return {
    max_tokens: config.maxTokens,
    max_embeddings: config.maxEmbeddingsPerQuery,
    timeout_ms: config.inferenceTimeoutMs,
    used_tokens: 0,
    used_embeddings: 0,
    exceeded: false,
  };
}

/**
 * Check if budget allows operation
 */
export function checkBudget(
  budget: InferenceBudget,
  tokens: number,
  embeddings: number = 0
): boolean {
  if (budget.exceeded) return false;

  const wouldExceedTokens = budget.used_tokens + tokens > budget.max_tokens;
  const wouldExceedEmbeddings =
    budget.used_embeddings + embeddings > budget.max_embeddings;

  return !wouldExceedTokens && !wouldExceedEmbeddings;
}

/**
 * Update budget after operation
 */
export function updateBudget(
  budget: InferenceBudget,
  tokens: number,
  embeddings: number = 0
): void {
  budget.used_tokens += tokens;
  budget.used_embeddings += embeddings;

  if (
    budget.used_tokens > budget.max_tokens ||
    budget.used_embeddings > budget.max_embeddings
  ) {
    budget.exceeded = true;
  }
}

/**
 * Model verification result
 */
export interface ModelVerificationResult {
  verified: boolean;
  modelName: AllowlistedModelName;
  expectedHash?: string;
  actualHash?: string;
  error?: string;
}

/**
 * Verify model integrity (placeholder for Phase 2 completion)
 * TODO: Implement SHA-256 verification of downloaded model files
 */
export async function verifyModelIntegrity(
  modelName: AllowlistedModelName
): Promise<ModelVerificationResult> {
  const model = ALLOWLISTED_MODELS.find((m) => m.name === modelName);

  if (!model) {
    return {
      verified: false,
      modelName,
      error: `Model ${modelName} not in allowlist`,
    };
  }

  // Phase 2: Stub implementation
  // TODO: Download model, compute SHA-256, compare with expected hash
  // For now, return verified=true (allowlist check only)
  return {
    verified: true,
    modelName,
    expectedHash: model.sha256 || 'pending',
  };
}

/**
 * Check if a model is allowlisted
 */
export function isModelAllowlisted(modelName: string): boolean {
  return ALLOWLISTED_MODELS.some((m) => m.name === modelName);
}

/**
 * Get model config by name
 */
export function getModelConfig(modelName: AllowlistedModelName) {
  return ALLOWLISTED_MODELS.find((m) => m.name === modelName);
}

/**
 * Health check for inference runtime
 */
export async function checkInferenceHealth(): Promise<{
  status: 'ok' | 'degraded' | 'error';
  capabilities: InferenceCapabilities;
  error?: string;
}> {
  try {
    const capabilities = await detectInferenceCapabilities();

    if (capabilities.preferredBackend === 'none') {
      return {
        status: 'error',
        capabilities,
        error: 'No inference backend available (WebGPU or WASM required)',
      };
    }

    if (!capabilities.webgpu && capabilities.wasm) {
      return {
        status: 'degraded',
        capabilities,
        error: 'WebGPU unavailable, using WASM fallback',
      };
    }

    return {
      status: 'ok',
      capabilities,
    };
  } catch (error) {
    return {
      status: 'error',
      capabilities: {
        webgpu: false,
        wasm: false,
        preferredBackend: 'none',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
