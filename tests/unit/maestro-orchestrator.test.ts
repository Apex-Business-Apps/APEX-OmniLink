import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaestroOrchestrator } from '../../src/integrations/maestro/orchestrator';
import { WebCryptoProvider } from '../../src/integrations/maestro/crypto';

describe('MAESTRO: Orchestrator', () => {
    let orchestrator: MaestroOrchestrator;
    let crypto: WebCryptoProvider;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fetchMock: any;

    beforeEach(async () => {
        crypto = new WebCryptoProvider();
        // Skip crypto real init if unsupported env (Node without polyfill), but usually Vitest crypto is ok.
        // We'll mock the encrypt method to speed up and avoid key gen.
        crypto.encrypt = vi.fn().mockResolvedValue({ iv: new Uint8Array(), data: new Uint8Array() });
        crypto.randomUUID = vi.fn().mockReturnValue('mock-uuid-123');

        orchestrator = new MaestroOrchestrator(crypto, 'http://mock-api/sync');

        fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            statusText: 'OK'
        });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should block non-allowlisted actions', async () => {
        const result = await orchestrator.schedule('evil.hack', {});
        expect(result.success).toBe(false);
        expect(result.error).toContain('not allowlisted');
    });

    it('should allow allowlisted actions', async () => {
        const result = await orchestrator.schedule('email.send', { to: 'test@example.com' });
        expect(result.success).toBe(true);
        expect(result.result).toBeDefined();
    });

    it('should generate idempotency key', async () => {
        await orchestrator.schedule('email.send', {});
        expect(crypto.randomUUID).toHaveBeenCalled();
    });

    it('should sync to server before execution', async () => {
        await orchestrator.schedule('email.send', {});
        expect(fetchMock).toHaveBeenCalledWith('http://mock-api/sync', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                'x-maestro-idempotency-key': 'mock-uuid-123'
            })
        }));
    });

    it('should block execution if sync fails', async () => {
        fetchMock.mockResolvedValue({ ok: false, statusText: 'Server Error' });
        const result = await orchestrator.schedule('email.send', {});
        expect(result.success).toBe(false);
        expect(result.error).toBe('SYNC_FAILED');
    });

    it('should gate low confidence actions (MAN Mode)', async () => {
        // Default MAN mode is off, but low confidence should trigger it
        const result = await orchestrator.schedule('email.send', {}, 0.5); // 0.5 confidence
        expect(result.success).toBe(false);
        expect(result.error).toBe('MAN_MODE_REQUIRED');
    });

    it('should gate when MAN mode is explicitly enabled', async () => {
        orchestrator.setManMode(true);
        const result = await orchestrator.schedule('email.send', {}, 1.0); // High confidence
        expect(result.success).toBe(false);
        expect(result.error).toBe('MAN_MODE_REQUIRED');
    });
});
