import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/monitoring', () => ({
  logAnalyticsEvent: vi.fn(),
  logError: vi.fn(),
}));

const importAudit = async () => await import('../../src/security/auditLog');

describe('audit log queue', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    // Mock environment variables for graceful degradation testing
    vi.stubEnv('VITE_LOVABLE_AUDIT_PROXY', '/api/lovable/audit');
  });

  it('enqueues and flushes audit events', async () => {
    const { recordAuditEvent, getAuditQueueSnapshot, flushQueue } = await importAudit();
    (fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'ok' }),
    });

    const entry = recordAuditEvent({
      actorId: 'user-1',
      actionType: 'config_change',
      resourceType: 'config',
      resourceId: 'guardian',
      metadata: { value: 'enabled' },
    });

    await flushQueue(true);
    const queue = await getAuditQueueSnapshot();

    expect(queue.length).toBe(0);
    expect(entry.id).toBeDefined();
  });

  it.skip('keeps events queued when Lovable returns 500', { timeout: 10000 }, async () => {
    const { recordAuditEvent, getAuditQueueSnapshot, flushQueue } = await importAudit();
    let callCount = 0;
    (fetch as any).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          text: async () => 'server error',
          headers: new Headers(),
        };
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'ok' }),
      };
    });

    recordAuditEvent({
      actorId: 'user-2',
      actionType: 'login',
    });

    // First flush should fail and increment attempts
    await flushQueue(true);
    let queue = await getAuditQueueSnapshot();
    expect(queue.length).toBeGreaterThan(0);
    if (queue.length > 0) {
      expect(queue[0].attempts).toBeGreaterThanOrEqual(1);
      expect(queue[0].status).toBe('pending');
    }

    // Second flush should succeed
    await flushQueue(true);
    queue = await getAuditQueueSnapshot();
    // After successful retry, queue should be empty
    expect(queue.length).toBe(0);
  });
});

