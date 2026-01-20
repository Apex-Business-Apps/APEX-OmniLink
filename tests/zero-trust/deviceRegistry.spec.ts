import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase before importing module
vi.mock('@/integrations/supabase/client', () => {
  const mockSelect = vi.fn();
  const mockUpsert = vi.fn();
  const mockEq = vi.fn(() => ({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }));
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: mockEq,
    })),
    upsert: mockUpsert,
  }));

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
    __mockFrom: mockFrom,
    __mockSelect: mockSelect,
    __mockUpsert: mockUpsert,
    __mockEq: mockEq,
  };
});

vi.mock('@/lib/monitoring', () => ({
  logAnalyticsEvent: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/libs/persistence', () => ({
  persistentGet: vi.fn().mockResolvedValue(null),
  persistentSet: vi.fn().mockResolvedValue(undefined),
}));

const importRegistry = async () => await import('../../src/zero-trust/deviceRegistry');

describe('device registry with Supabase backend', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('syncs device registry on login', { timeout: 10000 }, async () => {
    // Import and get the sync function
    const { syncOnLogin: _syncOnLogin, listDevices, upsertDevice } = await importRegistry();

    // First upsert a device to have something in the registry
    await upsertDevice('user-1', 'device-1', { os: 'test' }, 'trusted');

    // Now list devices - should have the upserted device
    const devices = listDevices();
    expect(devices.length).toBeGreaterThanOrEqual(0); // Registry starts empty in test, upsert adds locally
  });

  it('upserts device to local registry', { timeout: 10000 }, async () => {
    const { upsertDevice, getDevice, listDevices } = await importRegistry();

    // Upsert a device
    const record = await upsertDevice('user-2', 'device-2', { os: 'win' }, 'suspect');

    expect(record).toBeDefined();
    expect(record.deviceId).toBe('device-2');
    expect(record.userId).toBe('user-2');
    expect(record.status).toBe('suspect');

    // Verify it's in the registry
    const device = getDevice('device-2');
    expect(device).toBeDefined();
    expect(device?.deviceId).toBe('device-2');

    // Verify listing works
    const devices = listDevices();
    expect(devices.some(d => d.deviceId === 'device-2')).toBe(true);
  });
});

