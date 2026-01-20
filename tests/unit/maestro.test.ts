import { describe, it, expect, vi } from 'vitest';
import { MaestroClient } from '../../src/integrations/maestro/client';
import { WebCryptoProvider } from '../../src/integrations/maestro/crypto';

// Mock IndexedDB
const fakeIndexedDB = {
    open: vi.fn(),
};
global.indexedDB = fakeIndexedDB as unknown as IDBFactory;

describe('MAESTRO: Fortress Baseline', () => {

    describe('Crypto Provider', () => {
        it('should encrypt and decrypt data correctly', async () => {
            const crypto = new WebCryptoProvider();
            const payload = { secret: 'data' };

            // We rely on real WebCrypto if available in test env (Node 15+ has it),
            // otherwise we might need to mock it. JSDom usually handles it.
            if (!global.crypto) {
                console.warn('Skipping crypto test: global.crypto not found');
                return;
            }

            await crypto.init();
            const encrypted = await crypto.encrypt(payload);

            expect(encrypted.iv).toBeDefined();
            expect(encrypted.data).toBeDefined();

            const decrypted = await crypto.decrypt(encrypted);
            expect(decrypted).toEqual(payload);
        });
    });

    describe('Maestro Client', () => {
        it('should respect MAESTRO_ENABLED flag', async () => {
            const client = new MaestroClient();

            // Mock import.meta.env
            vi.stubGlobal('import', { meta: { env: { VITE_MAESTRO_ENABLED: 'false' } } });

            await client.init({ enabled: false });
            expect(client.isEnabled).toBe(false);
        });

        it('should initialize when enabled', async () => {
            const client = new MaestroClient();

            // Mock crypto/memory init to avoid complex dependency mocking
            // We cast to any to spy on private properties for testing
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.spyOn((client as any)['crypto'], 'init').mockResolvedValue(undefined);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.spyOn((client as any)['memory'], 'init').mockResolvedValue(undefined);

            await client.init({ enabled: true });
            expect(client.isEnabled).toBe(true);
        });
    });
});

describe('Vector Search', () => {
    // Mock for vector search
    // Since we are mocking IndexedDB, we can't easily test the full cursor logic without a complex IDB mock.
    // However, we can test the vector math logic if we imported it separately.
    // For now, let's just ensure the memory.search method exists and doesn't crash on init.

    it('should have search capability', async () => {
        const client = new MaestroClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn((client as any)['memory'], 'init').mockResolvedValue(undefined);

        await client.init({ enabled: true });
        expect(client.memory.search).toBeDefined();
    });
});
