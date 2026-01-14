import type { GuardRailConfig } from '../../guard-rails';

type GuardRailOverrides = Partial<GuardRailConfig>;

export function buildGuardRailConfig(overrides: GuardRailOverrides = {}): GuardRailConfig {
  return {
    simMode: 'true',
    sandboxTenant: 'test-tenant',
    supabaseUrl: 'http://localhost:54321',
    ...overrides,
  };
}
