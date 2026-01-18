import { assertGuardRails, checkGuardRailsFromEnv } from '../../../../sim/guard-rails';

export function enforceSandboxGuardrails(omnilinkPortUrl?: string): void {
  assertGuardRails({
    simMode: process.env.SIM_MODE,
    sandboxTenant: process.env.SANDBOX_TENANT,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    urls: omnilinkPortUrl ? [omnilinkPortUrl] : [],
  });
}

export function checkGuardrailsWarnings(omnilinkPortUrl?: string): void {
  const result = checkGuardRailsFromEnv(omnilinkPortUrl ? [omnilinkPortUrl] : []);
  if (!result.safe) {
    return;
  }
}
