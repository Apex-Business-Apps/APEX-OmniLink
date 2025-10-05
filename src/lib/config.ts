/**
 * Production configuration and environment management
 */

export type Environment = 'development' | 'staging' | 'production';

/**
 * Detect current environment
 */
export function getEnvironment(): Environment {
  const hostname = window.location.hostname;
  
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
  name: 'APEX Business Systems',
  version: '1.0.0',
  apiTimeout: 30000, // 30 seconds
  maxRetries: 3,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  rateLimitWindow: 60 * 1000, // 1 minute
  rateLimitMaxRequests: 60,
} as const;

/**
 * Log current configuration (development only)
 */
export function logConfiguration(): void {
  if (isDevelopment()) {
    console.log('📋 Configuration:', {
      environment: getEnvironment(),
      features: getFeatureFlags(),
      app: appConfig,
    });
  }
}
