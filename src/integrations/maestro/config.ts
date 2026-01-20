/**
 * MAESTRO Configuration
 *
 * Feature flags and configuration for browser-only compute system.
 * Default: MAESTRO_ENABLED=false (optional-by-default invariant)
 */

/**
 * Check if MAESTRO is enabled via environment variable
 * Default: false (system works without MAESTRO)
 */
export function isMaestroEnabled(): boolean {
  return import.meta.env.VITE_MAESTRO_ENABLED === 'true';
}

/**
 * Check if MAESTRO debug logging is enabled
 */
export function isMaestroDebugEnabled(): boolean {
  return import.meta.env.VITE_MAESTRO_DEBUG === 'true';
}

/**
 * Get MAESTRO configuration from environment variables
 */
export interface MaestroConfig {
  enabled: boolean;
  debug: boolean;
  modelsPath: string;
  maxTokens: number;
  maxEmbeddingsPerQuery: number;
  inferenceTimeoutMs: number;
}

export function getMaestroConfig(): MaestroConfig {
  return {
    enabled: isMaestroEnabled(),
    debug: isMaestroDebugEnabled(),
    modelsPath: import.meta.env.VITE_MAESTRO_MODELS_PATH || '/models',
    maxTokens: parseInt(import.meta.env.VITE_MAESTRO_MAX_TOKENS || '512', 10),
    maxEmbeddingsPerQuery: parseInt(
      import.meta.env.VITE_MAESTRO_MAX_EMBEDDINGS_PER_QUERY || '100',
      10
    ),
    inferenceTimeoutMs: parseInt(
      import.meta.env.VITE_MAESTRO_INFERENCE_TIMEOUT_MS || '10000',
      10
    ),
  };
}

/**
 * MAESTRO IndexedDB database name
 */
export const MAESTRO_DB_NAME = 'maestro-memory';

/**
 * MAESTRO IndexedDB version
 */
export const MAESTRO_DB_VERSION = 1;

/**
 * MAESTRO store names (memory tiers)
 */
export const MAESTRO_STORES = {
  CORE: 'core', // T1: Stable facts
  WORKING: 'working', // T2: TTL + bounded
  EPISODIC: 'episodic', // T3: Append-only events
  SEMANTIC: 'semantic', // T4: Embeddings + derived facts
  PROCEDURAL: 'procedural', // T5: Versioned recipes
} as const;

/**
 * Allowlisted model identifiers (no arbitrary downloads)
 */
export const ALLOWLISTED_MODELS = {
  EMBEDDINGS: 'Xenova/all-MiniLM-L6-v2', // Sentence embeddings (22MB)
  TRANSLATION: 'Xenova/mbart-large-50-many-to-many-mmt', // Translation (optional, 600MB)
  SUMMARIZATION: 'Xenova/distilbart-cnn-6-6', // Summarization (optional, 250MB)
} as const;

/**
 * Model integrity hashes (SHA-256)
 * TODO: Update with actual hashes after model download
 */
export const MODEL_INTEGRITY_HASHES: Record<string, string> = {
  // Format: 'model-id': 'sha256-hash'
  // These will be verified during Service Worker caching
};

/**
 * Risk lanes for execution intents
 */
export const RISK_LANES = {
  GREEN: 'GREEN', // Safe, auto-execute
  YELLOW: 'YELLOW', // Review recommended
  RED: 'RED', // MAN Mode required
} as const;

/**
 * Memory tier TTLs (milliseconds)
 */
export const TIER_TTLS = {
  CORE: null, // No expiry (write only via confirmation)
  WORKING: 24 * 60 * 60 * 1000, // 24 hours
  EPISODIC: 30 * 24 * 60 * 60 * 1000, // 30 days
  SEMANTIC: 90 * 24 * 60 * 60 * 1000, // 90 days
  PROCEDURAL: null, // No expiry (versioned)
} as const;
