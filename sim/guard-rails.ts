/**
 * GUARD RAILS - Safety System for Chaos Simulation
 *
 * CRITICAL: This module prevents the simulation from running against production.
 *
 * NON-NEGOTIABLES:
 * - MUST check SIM_MODE=true
 * - MUST check SANDBOX_TENANT is set
 * - MUST detect and block production URLs
 * - MUST hard-fail (not warn) on violations
 */

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

export interface GuardRailConfig {
  /** Required: SIM_MODE must be 'true' */
  simMode: string | undefined;

  /** Required: SANDBOX_TENANT must be set */
  sandboxTenant: string | undefined;

  /** Optional: SUPABASE_URL (checked for production patterns) */
  supabaseUrl: string | undefined;

  /** Optional: Any URLs to validate */
  urls?: string[];
}

export interface GuardRailResult {
  safe: boolean;
  errors: string[];
  warnings: string[];
  config: GuardRailConfig;
}

// ============================================================================
// PRODUCTION URL PATTERNS (BLOCKLIST)
// ============================================================================

const PRODUCTION_URL_PATTERNS = [
  /\.apex.*\.com/i,
  /prod|production/i,
  /api\.apex/i,
  /www\.apex/i,
  /app\.apex/i,
  // Supabase production indicators
  /\.supabase\.co(?!.*sandbox)/i, // Allow if 'sandbox' in path
  /\.supabase\.red/i,
  // Generic production indicators
  /live\./i,
  /main\./i,
];

const ALLOWED_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/i,
  /\.test/i,
  /\.local/i,
  /sandbox/i,
  /staging/i,
  /dev/i,
  /development/i,
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if URL is a production URL
 */
export function isProductionUrl(url: string): boolean {
  // First check if it's explicitly allowed
  if (ALLOWED_PATTERNS.some(pattern => pattern.test(url))) {
    return false;
  }

  // Then check if it matches production patterns
  return PRODUCTION_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Validate SIM_MODE is enabled
 */
function validateSimMode(simMode: string | undefined): string[] {
  const errors: string[] = [];

  if (!simMode) {
    errors.push('SIM_MODE environment variable is not set');
  } else if (simMode.toLowerCase() !== 'true') {
    errors.push(`SIM_MODE must be 'true', got: '${simMode}'`);
  }

  return errors;
}

/**
 * Validate SANDBOX_TENANT is set
 */
function validateSandboxTenant(tenant: string | undefined): string[] {
  const errors: string[] = [];

  if (!tenant) {
    errors.push('SANDBOX_TENANT environment variable is not set');
  } else if (tenant.trim().length === 0) {
    errors.push('SANDBOX_TENANT cannot be empty');
  } else if (tenant.toLowerCase().includes('prod')) {
    errors.push(`SANDBOX_TENANT contains 'prod': '${tenant}' - this is not allowed`);
  }

  return errors;
}

/**
 * Validate URLs don't point to production
 */
function validateUrls(urls: string[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const url of urls) {
    if (!url) continue;

    if (isProductionUrl(url)) {
      errors.push(`Production URL detected: ${url}`);
    }

    // Warning for missing localhost/test indicators
    if (!ALLOWED_PATTERNS.some(pattern => pattern.test(url))) {
      warnings.push(`URL does not contain sandbox/test indicators: ${url}`);
    }
  }

  return { errors, warnings };
}

// ============================================================================
// MAIN GUARD RAIL CHECK
// ============================================================================

/**
 * Validate all guard rails
 *
 * @returns GuardRailResult with safe=true if all checks pass
 * @throws Never throws - always returns result (caller decides to throw)
 */
export function checkGuardRails(config: GuardRailConfig): GuardRailResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check SIM_MODE
  errors.push(...validateSimMode(config.simMode));

  // 2. Check SANDBOX_TENANT
  errors.push(...validateSandboxTenant(config.sandboxTenant));

  // 3. Check Supabase URL
  if (config.supabaseUrl) {
    const urlCheck = validateUrls([config.supabaseUrl]);
    errors.push(...urlCheck.errors);
    warnings.push(...urlCheck.warnings);
  }

  // 4. Check additional URLs
  if (config.urls && config.urls.length > 0) {
    const urlCheck = validateUrls(config.urls);
    errors.push(...urlCheck.errors);
    warnings.push(...urlCheck.warnings);
  }

  return {
    safe: errors.length === 0,
    errors,
    warnings,
    config,
  };
}

/**
 * Check guard rails from environment variables
 */
export function checkGuardRailsFromEnv(additionalUrls?: string[]): GuardRailResult {
  return checkGuardRails({
    simMode: process.env.SIM_MODE,
    sandboxTenant: process.env.SANDBOX_TENANT,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    urls: additionalUrls,
  });
}

/**
 * Assert guard rails pass - throws on failure
 *
 * Use this at the start of simulation entry points
 */
export function assertGuardRails(config?: GuardRailConfig): void {
  const result = config ? checkGuardRails(config) : checkGuardRailsFromEnv();

  if (!result.safe) {
    const errorMessage = [
      '',
      '╔════════════════════════════════════════════════════════════════╗',
      '║                   GUARD RAIL VIOLATION                         ║',
      '║          SIMULATION BLOCKED FOR SAFETY                         ║',
      '╚════════════════════════════════════════════════════════════════╝',
      '',
      '❌ The chaos simulation cannot run due to safety violations:',
      '',
      ...result.errors.map(e => `   • ${e}`),
      '',
      '🛡️  Required environment variables:',
      '   export SIM_MODE=true',
      '   export SANDBOX_TENANT=sim-test-tenant',
      '',
      '🔒 Detected configuration:',
      `   SIM_MODE: ${result.config.simMode || '(not set)'}`,
      `   SANDBOX_TENANT: ${result.config.sandboxTenant || '(not set)'}`,
      `   SUPABASE_URL: ${result.config.supabaseUrl || '(not set)'}`,
      '',
      '📖 See docs/sim/RUNBOOK.md for setup instructions.',
      '',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Log warnings if present
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Guard Rail Warnings:');
    result.warnings.forEach(w => console.warn(`   • ${w}`));
    console.warn('');
  }
}

// ============================================================================
// HELPER: GENERATE SAFE SANDBOX CONFIG
// ============================================================================

// Counter for unique tenant generation
let tenantCounter = 0;

/**
 * Generate a safe sandbox configuration for testing
 */
export function generateSandboxConfig(tenantId?: string): Record<string, string> {
  const tenant = tenantId || `sandbox-${Date.now()}-${tenantCounter++}`;

  return {
    SIM_MODE: 'true',
    SANDBOX_TENANT: tenant,
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'sandbox-key-not-real',
    SUPABASE_ANON_KEY: 'sandbox-anon-key-not-real',
    // Override any production vars
    NODE_ENV: 'test',
    VITE_SUPABASE_URL: 'http://localhost:54321',
  };
}

// ============================================================================
// TELEMETRY
// ============================================================================

export interface GuardRailTelemetry {
  timestamp: string;
  result: GuardRailResult;
  caller: string;
}

const telemetry: GuardRailTelemetry[] = [];

/**
 * Record guard rail check for audit
 */
export function recordGuardRailCheck(result: GuardRailResult, caller: string): void {
  telemetry.push({
    timestamp: new Date().toISOString(),
    result,
    caller,
  });

  // Keep last 100 checks
  if (telemetry.length > 100) {
    telemetry.shift();
  }
}

/**
 * Get guard rail telemetry
 */
export function getGuardRailTelemetry(): GuardRailTelemetry[] {
  return [...telemetry];
}

/**
 * Clear telemetry (for testing)
 */
export function clearGuardRailTelemetry(): void {
  telemetry.length = 0;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  check: checkGuardRails,
  checkFromEnv: checkGuardRailsFromEnv,
  assert: assertGuardRails,
  isProductionUrl,
  generateSandboxConfig,
  getTelemetry: getGuardRailTelemetry,
  clearTelemetry: clearGuardRailTelemetry,
};
