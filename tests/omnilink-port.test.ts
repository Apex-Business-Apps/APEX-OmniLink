import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOmniLinkHealth, requestOmniLink } from '@/integrations/omnilink';

const originalEnv = { ...process.env };

describe('OmniLink port', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('reports disabled by default', async () => {
    delete process.env.VITE_OMNILINK_ENABLED;
    delete process.env.OMNILINK_ENABLED;
    delete process.env.VITE_OMNILINK_BASE_URL;
    delete process.env.OMNILINK_BASE_URL;

    const health = await getOmniLinkHealth();
    expect(health.status).toBe('disabled');
    expect(health.lastError).toContain('disabled');
  });

  it('dedupes idempotency keys and performs requests when enabled', async () => {
    process.env.VITE_OMNILINK_ENABLED = 'true';
    process.env.VITE_OMNILINK_BASE_URL = 'https://omnilink.example';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await requestOmniLink<{ ok: boolean }>({
      path: '/ping',
      method: 'POST',
      body: { hello: 'world' },
      idempotencyKey: 'dup-key',
    });
    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(
      requestOmniLink({
        path: '/ping',
        method: 'POST',
        body: { hello: 'world' },
        idempotencyKey: 'dup-key',
      })
    ).rejects.toThrow(/Duplicate OmniLink request/);
  });
});
