import { describe, expect, it } from 'vitest';
import {
  allowAdapter,
  allowWorkflow,
  enforceEnvAllowlist,
  enforcePermission,
  matchPermission,
} from '../supabase/functions/_shared/omnilinkScopes.ts';

describe('OmniLink scope helpers', () => {
  it('matches permissions with wildcards', () => {
    expect(matchPermission(['events:write'], 'events:write')).toBe(true);
    expect(matchPermission(['events:*'], 'events:write')).toBe(true);
    expect(matchPermission(['*'], 'commands.calendar.create')).toBe(true);
    expect(matchPermission(['events:write'], 'commands.calendar.create')).toBe(false);
  });

  it('enforces permission lists', () => {
    expect(enforcePermission({ permissions: ['orchestrations:request'] }, 'orchestrations:request')).toBe(true);
    expect(enforcePermission({ permissions: [] }, 'events:write')).toBe(false);
  });

  it('validates env allowlists', () => {
    expect(enforceEnvAllowlist('app://vendor/app/prod', ['prod'])).toBe(true);
    expect(enforceEnvAllowlist('app://vendor/app/staging', ['prod'])).toBe(false);
    expect(enforceEnvAllowlist('app://vendor/app/dev', [])).toBe(true);
  });

  it('checks adapter and workflow allowlists', () => {
    expect(allowAdapter({ system: 'webhook' }, ['webhook'])).toBe(true);
    expect(allowAdapter({ system: 'calendar' }, ['webhook'])).toBe(false);

    expect(allowWorkflow({ name: 'sync', version: '1.0.0' }, [{ name: 'sync' }])).toBe(true);
    expect(allowWorkflow({ name: 'sync', version: '1.0.0' }, [{ name: 'sync', version: '2.0.0' }])).toBe(false);
  });
});
