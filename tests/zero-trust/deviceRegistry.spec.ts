import { beforeEach, describe, expect, it, vi } from 'vitest';

const importRegistry = async () => await import('../../src/zero-trust/deviceRegistry');

describe('device registry with Lovable backend', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    // Mock environment variables for graceful degradation testing
    vi.stubEnv('VITE_LOVABLE_DEVICE_PROXY', '/api/lovable/device');
  });

  it('merges remote registry preferring latest lastSeen', async () => {
    const local = [
      {
        deviceId: 'device-1',
        userId: 'user-1',
        lastSeen: '2024-01-01T00:00:00.000Z',
        deviceInfo: {},
        status: 'suspect' as const,
      },
    ];
    localStorage.setItem('lovable_device_registry_v1', JSON.stringify(local));

    (fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        devices: [
          {
            device_id: 'device-1',
            user_id: 'user-1',
            last_seen: '2024-02-01T00:00:00.000Z',
            device_info: { status: 'trusted' },
          },
        ],
      }),
    });

    const { syncOnLogin, listDevices } = await importRegistry();
    await syncOnLogin('user-1');
    const devices = listDevices();
    expect(devices.length).toBeGreaterThan(0);
    const device = devices.find(d => d.deviceId === 'device-1');
    expect(device).toBeDefined();
    if (device) {
      // Remote has later timestamp, so it should win (idempotent merge)
      expect(device.lastSeen).toBe('2024-02-01T00:00:00.000Z');
      expect(device.status).toBe('trusted');
    }
  }, { timeout: 10000 });

  it('retries upsert with backoff on failure', async () => {
    let callCount = 0;
    (fetch as any).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          headers: new Headers(),
          text: async () => 'server error',
        };
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'ok' }),
      };
    });

    const { upsertDevice, getUpsertQueueSnapshot, flushDeviceUpserts } = await importRegistry();
    await upsertDevice('user-2', 'device-2', { os: 'win' });

    // First flush should fail and increment attempts (idempotent retry)
    await flushDeviceUpserts(true);
    let queue = await getUpsertQueueSnapshot();
    expect(queue.length).toBeGreaterThan(0);
    if (queue.length > 0) {
      expect(queue[0].attempts).toBeGreaterThanOrEqual(1);
      expect(queue[0].status).toBe('pending');
    }

    // Second flush should succeed (idempotent operation)
    await flushDeviceUpserts(true);
    queue = await getUpsertQueueSnapshot();
    // After successful retry, queue should be empty
    expect(queue.length).toBe(0);
  }, { timeout: 10000 });
});

