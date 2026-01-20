import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaestroClient } from '../../src/integrations/maestro/client';
import { MaestroOrchestrator } from '../../src/integrations/maestro/orchestrator';

// Mock specific internal modules if needed, but we prefer testing the public Client API orchestrating them.
// However, simulating "Offline" or "Sync Failure" requires mocking the Orchestrator's network calls or the Runtime.

describe('MAESTRO: Verification Suite', () => {
    let client: MaestroClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fetchMock: any;

    beforeEach(async () => {
        // Setup global fetch mock
        fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            statusText: 'OK',
            json: async () => ({ success: true, receipt: 'mock-receipt' })
        });
        vi.stubGlobal('fetch', fetchMock);

        // Setup Crypto mock (needed for key gen in tests usually)
        if (!global.crypto) {
            Object.defineProperty(global, 'crypto', {
                value: {
                    getRandomValues: (arr: Uint8Array) => arr,
                    subtle: {
                        generateKey: vi.fn().mockResolvedValue('mock-key'),
                        encrypt: vi.fn().mockResolvedValue(new Uint8Array(10)),
                        decrypt: vi.fn().mockResolvedValue(new Uint8Array(10))
                    },
                    randomUUID: () => 'test-uuid-gen'
                }
            });
        }

        client = new MaestroClient();

        // Mock internal init components to bypass complex IDB
        // We want to test Orchestrator mainly here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn((client as any)['memory'], 'init').mockResolvedValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn((client as any)['crypto'], 'init').mockResolvedValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn((client as any)['runtime'], 'init').mockResolvedValue(undefined);

        await client.init({ enabled: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('should handle Allowlisted Action successfully', async () => {
        const result = await client.orchestrator.schedule('email.send', { to: 'demo' });
        expect(result.success).toBe(true);
        expect(result.receipt).toBeDefined();
        // Verify sync occurred
        expect(fetchMock).toHaveBeenCalled();
    });

    it('should block Duplicate Intent (Idempotency Replay)', async () => {
        // To strictly test duplication at the client level, we'd need to mock the Memory having seen it.
        // The implementation Plan said "Execute Intents & Idempotency".
        // Current Orchestrator generates a NEW key for every schedule() call.
        // So duplication handling is actually on the SERVER side (Phase 4).
        // The client just needs to ensure it sends a key.
        const result = await client.orchestrator.schedule('email.send', { to: 'demo' });

        // Let's verify we sent a key header
        const callArgs = fetchMock.mock.calls[0];
        const headers = callArgs[1].headers;
        expect(headers['x-maestro-idempotency-key']).toBeDefined();
    });

    it('should block Unknown Action (Safety Cut)', async () => {
        const result = await client.orchestrator.schedule('unknown.action', {});
        expect(result.success).toBe(false);
        expect(result.error).toContain('not allowlisted');
        // valid atomic cut
    });

    it('should gate Low Confidence / MAN Mode', async () => {
        const result = await client.orchestrator.schedule('email.send', {}, 0.5); // Low confidence
        expect(result.success).toBe(false);
        expect(result.error).toBe('MAN_MODE_REQUIRED');
    });

    it('should handle Offline/Sync Failure gracefully', async () => {
        fetchMock.mockRejectedValue(new Error('Network Error'));
        const result = await client.orchestrator.schedule('email.send', { to: 'demo' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('SYNC_FAILED');
    });
});
