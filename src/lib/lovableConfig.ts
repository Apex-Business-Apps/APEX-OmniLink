/**
 * Lovable integration configuration and validation
 */

export interface LovableConfigStatus {
  configured: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate Lovable configuration and return status
 */
export function validateLovableConfig(): LovableConfigStatus {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Server-side env vars (for Supabase Edge Functions)
  const lovableApiBase = import.meta.env.VITE_LOVABLE_API_BASE || '';
  const lovableApiKey = import.meta.env.VITE_LOVABLE_API_KEY || '';

  // Check required vars
  if (!lovableApiBase) {
    missing.push('LOVABLE_API_BASE (or VITE_LOVABLE_API_BASE)');
  }
  if (!lovableApiKey) {
    missing.push('LOVABLE_API_KEY (or VITE_LOVABLE_API_KEY)');
  }

  // Check Supabase URL (required for Edge Functions)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) {
    warnings.push('VITE_SUPABASE_URL not set - Supabase Edge Functions will not work');
  }

  // Validate URL format if provided
  if (lovableApiBase) {
    try {
      new URL(lovableApiBase);
    } catch {
      warnings.push('LOVABLE_API_BASE is not a valid URL');
    }
  }

  return {
    configured: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Log configuration status (non-blocking)
 */
export function logLovableConfigStatus(): void {
  const status = validateLovableConfig();
  
  if (status.configured) {
    console.log('✅ Lovable integration configured');
  } else {
    console.warn('⚠️ Lovable integration not fully configured:');
    status.missing.forEach((varName) => {
      console.warn(`  - Missing: ${varName}`);
    });
  }
  
  if (status.warnings.length > 0) {
    status.warnings.forEach((warning) => {
      console.warn(`  - Warning: ${warning}`);
    });
  }
}

/**
 * Check if Lovable is enabled and configured
 */
export function isLovableEnabled(): boolean {
  const status = validateLovableConfig();
  return status.configured;
}



