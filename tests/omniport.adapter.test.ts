import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordAuditEvent = vi.fn();

vi.mock('@/security/auditLog', () => ({
  recordAuditEvent,
}));

vi.mock('@/lib/backoff', () => ({
  calculateBackoffDelay: vi.fn(() => 0),
}));

const originalEnv = { ...process.env };

async function loadOmniPort() {
  return import('@/integrations/omniport');
}

describe('OmniPort universal adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    recordAuditEvent.mockReset();
    process.env = {
      ...originalEnv,
      VITE_OMNILINK_ENABLED: 'true',
      OMNILINK_BASE_URL: 'https://omniport.test',
      VITE_OMNILINK_BASE_URL: 'https://omniport.test',
    };
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('normalizes voice, text, and API inputs to canonical envelopes with approvals/notifications', async () => {
    const { normalizeOmniPortIntent } = await loadOmniPort();

    const voice = normalizeOmniPortIntent({
      channel: 'voice',
      transcript: '   Approve invoice #123   ',
      userId: 'u-voice',
      requiresApproval: true,
      notify: true,
      traceId: 'trace-voice',
    });
    expect(voice).toMatchObject({
      channel: 'voice',
      type: 'voice.intent',
      payload: {
        message: 'Approve invoice #123',
        modality: 'voice',
        language: 'en',
      },
      requiresApproval: true,
      notify: true,
      traceId: 'trace-voice',
      userId: 'u-voice',
    });

    const text = normalizeOmniPortIntent({
      channel: 'text',
      message: ' sync pipeline   ',
      locale: 'en-US',
      traceId: 'trace-text',
    });
    expect(text.payload.message).toBe('sync pipeline');
    expect(text.type).toBe('text.intent');
    expect(text.traceId).toBe('trace-text');

    const api = normalizeOmniPortIntent({
      channel: 'api',
      payload: { type: 'workflow.run.requested', workflow: { name: 'sync' } },
      requiresApproval: false,
      notify: true,
    });
    expect(api.type).toBe('workflow.run.requested');
    expect(api.payload.workflow).toEqual({ name: 'sync' });
    expect(api.notify).toBe(true);
  });

  it('shares inflight requests and blocks completed duplicates for idempotency', async () => {
    const { requestOmniLink } = await loadOmniPort();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      path: '/ingest',
      method: 'POST' as const,
      body: { foo: 'bar' },
      idempotencyKey: 'id-123',
    };

    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(fetchPromise);

    const first = requestOmniLink(payload);
    const second = requestOmniLink(payload);

    resolveFetch!(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const [res1, res2] = await Promise.all([first, second]);
    expect(res1).toEqual({ ok: true });
    expect(res2).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(requestOmniLink(payload)).rejects.toThrow(/Duplicate OmniLink request/);
  });

  it('emits audit events for success and failure and keeps last error for observability', async () => {
    const { requestOmniLink, getOmniLinkLastError } = await loadOmniPort();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await requestOmniLink({ path: '/ok', method: 'POST', body: { run: true } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'omnilink.port.request',
        metadata: expect.objectContaining({ path: '/ok', method: 'POST' }),
      }),
    );

    await expect(requestOmniLink({ path: '/err', method: 'POST', body: {} })).rejects.toThrow();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'omnilink.port.failure',
        metadata: expect.objectContaining({ reason: expect.any(String) }),
      }),
    );
    expect(getOmniLinkLastError()).toBeTruthy();
  });

  it('attaches trace headers to support OmniDash run and step linking', async () => {
    const { requestOmniLink } = await loadOmniPort();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestOmniLink({
      path: '/omnidash/events',
      method: 'POST',
      body: { event: 'ingest' },
      idempotencyKey: 'trace-test',
    });

    const [, options] = fetchMock.mock.calls[0];
    expect((options?.headers as Record<string, string>)['X-OmniLink-Trace-Id']).toBeDefined();
    expect((options?.headers as Record<string, string>)['X-Idempotency-Key']).toBe('trace-test');
  });

  it('retries transient failures and trips the circuit breaker on repeated failures', async () => {
    const { requestOmniLink } = await loadOmniPort();

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient-1'))
      .mockRejectedValueOnce(new Error('transient-2'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestOmniLink({ path: '/flaky', method: 'POST' });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const failMock = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', failMock);

    await expect(
      requestOmniLink({ path: '/fail', method: 'POST', idempotencyKey: 'fail-1' }),
    ).rejects.toThrow();
    await expect(
      requestOmniLink({ path: '/fail', method: 'POST', idempotencyKey: 'fail-2' }),
    ).rejects.toThrow();
    await expect(
      requestOmniLink({ path: '/fail', method: 'POST', idempotencyKey: 'fail-3' }),
    ).rejects.toThrow();
    await expect(
      requestOmniLink({ path: '/fail', method: 'POST', idempotencyKey: 'fail-4' }),
    ).rejects.toThrow(/circuit breaker open/i);
  });

  it('stays under sub-second latency budget under load with guardrails intact', async () => {
    const { requestOmniLink } = await loadOmniPort();

    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const tasks = Array.from({ length: 20 }, (_, i) =>
      requestOmniLink({
        path: `/bulk-${i}`,
        method: 'POST',
        body: { i },
        idempotencyKey: `bulk-${i}`,
        timeoutMs: 900,
      }),
    );

    const start = performance.now();
    await Promise.all(tasks);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  it('respects dedupe TTL to allow safe retries after rollback windows', async () => {
    const { requestOmniLink } = await loadOmniPort();

    const fetchMock = vi.fn().mockImplementation(
      () => new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const key = 'ttl-key';
    await requestOmniLink({
      path: '/dedupe',
      method: 'POST',
      idempotencyKey: key,
      dedupeTtlMs: 10,
    });
    await expect(
      requestOmniLink({ path: '/dedupe', method: 'POST', idempotencyKey: key, dedupeTtlMs: 10 }),
    ).rejects.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 15));
    await requestOmniLink({
      path: '/dedupe',
      method: 'POST',
      idempotencyKey: key,
      dedupeTtlMs: 10,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports disabled health when OmniPort is rolled back/disabled', async () => {
    process.env.VITE_OMNILINK_ENABLED = 'false';
    process.env.OMNILINK_BASE_URL = '';
    process.env.VITE_OMNILINK_BASE_URL = '';
    vi.resetModules();

    const { getOmniLinkHealth } = await loadOmniPort();
    const health = await getOmniLinkHealth();

    expect(health.status).toBe('disabled');
    expect(health.lastError).toContain('disabled');
  });
});
