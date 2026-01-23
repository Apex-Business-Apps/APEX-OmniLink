/**
 * Production configuration and environment management
 */

import { createDebugLogger } from './debug-logger';

export type Environment = 'development' | 'staging' | 'production';

/**
 * Detect current environment
 */
export function getEnvironment(): Environment {
  const hostname = globalThis.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }

  if (hostname.includes('staging') || hostname.includes('preview')) {
    return 'staging';
  }

  return 'production';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}


/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Feature flags configuration
 */
interface FeatureFlags {
  enableAnalytics: boolean;
  enableOfflineMode: boolean;
  enableAdvancedMonitoring: boolean;
  enableBetaFeatures: boolean;
  enableDebugMode: boolean;
  maxFileUploadSizeMB: number;
  rateLimitEnabled: boolean;
}

const productionFlags: FeatureFlags = {
  enableAnalytics: true,
  enableOfflineMode: true,
  enableAdvancedMonitoring: true,
  enableBetaFeatures: false,
  enableDebugMode: false,
  maxFileUploadSizeMB: 10,
  rateLimitEnabled: true,
};

const developmentFlags: FeatureFlags = {
  enableAnalytics: false,
  enableOfflineMode: true,
  enableAdvancedMonitoring: false,
  enableBetaFeatures: true,
  enableDebugMode: true,
  maxFileUploadSizeMB: 50,
  rateLimitEnabled: false,
};

const stagingFlags: FeatureFlags = {
  ...productionFlags,
  enableBetaFeatures: true,
  enableDebugMode: true,
};

/**
 * Get feature flags for current environment
 */
export function getFeatureFlags(): FeatureFlags {
  const env = getEnvironment();

  switch (env) {
    case 'production':
      return productionFlags;
    case 'staging':
      return stagingFlags;
    case 'development':
      return developmentFlags;
    default:
      return productionFlags;
  }
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature] as boolean;
}

/**
 * Get configuration value
 */
export function getConfigValue<K extends keyof FeatureFlags>(
  key: K
): FeatureFlags[K] {
  const flags = getFeatureFlags();
  return flags[key];
}

/**
 * Application configuration
 */
export const appConfig = {
  name: 'APEX OmniHub',
  version: '1.0.0',
  apiTimeout: 30000, // 30 seconds
  maxRetries: 3,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  rateLimitWindow: 60 * 1000, // 1 minute
  rateLimitMaxRequests: 60,
} as const;

/**
 * Validate critical environment variables
 */
export function validateEnvironment(): { valid: boolean; missing: string[]; warnings: string[] } {
  const log = createDebugLogger('config.ts', 'E');
  const missing: string[] = [];
  const warnings: string[] = [];

  // #region agent log
  log('Environment validation entry');
  // #endregion

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // #region agent log
  log('Environment variables check', {
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseKey: !!supabaseKey,
  });
  // #endregion

  if (!supabaseUrl) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!supabaseKey) {
    missing.push('VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  // #region agent log
  log('Environment validation result', {
    valid: missing.length === 0,
    missingCount: missing.length,
    warningsCount: warnings.length,
  });
  // #endregion

  return { valid: missing.length === 0, missing, warnings };
}

/**
 * Log current configuration (development only)
 */
export function logConfiguration(): void {
  const log = createDebugLogger('config.ts', 'A');

  // #region agent log
  log('logConfiguration entry');
  // #endregion

  const env = getEnvironment();
  if (import.meta.env.DEV) {
    console.log(`🌍 Environment: ${env}`);
  }

  // Validate environment
  const validation = validateEnvironment();
  if (!validation.valid && import.meta.env.DEV) {
    console.warn('⚠️ Missing environment variables:', validation.missing);
  }

  if (isDevelopment()) {
    console.log('📋 Configuration:', {
      environment: env,
      features: getFeatureFlags(),
      app: appConfig,
      validation,
    });
  }

  // Lovable config logging removed - app now uses Supabase directly

  // #region agent log
  log('logConfiguration complete');
  // #endregion
}
