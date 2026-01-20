/**
 * MAESTRO Client
 * 
 * The single integration port for the application.
 * Orchestrates Memory, Crypto, and Runtime (future).
 * 
 * NON-NEGOTIABLES:
 * 1. Optional-by-default: functionality guards against disabled state.
 */

import { WebCryptoProvider } from './crypto';
import { TieredMemory } from './memory';
import { MaestroRuntime } from './runtime';
import { MaestroOrchestrator } from './orchestrator';

export interface MaestroConfig {
    enabled: boolean;
    tenantId?: string;
    syncUrl?: string;
}

export class MaestroClient {
    public readonly memory: TieredMemory;
    public readonly runtime: MaestroRuntime;
    public readonly orchestrator: MaestroOrchestrator;

    private crypto: WebCryptoProvider;
    private enabled = false;
    private initialized = false;

    constructor() {
        this.crypto = new WebCryptoProvider();
        this.memory = new TieredMemory(this.crypto);
        this.runtime = new MaestroRuntime();
        // Default URL, can be overridden
        const defaultSyncUrl = import.meta.env.VITE_SUPABASE_URL
            ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/maestro-sync`
            : 'http://localhost:54321/functions/v1/maestro-sync';

        this.orchestrator = new MaestroOrchestrator(this.crypto, defaultSyncUrl);
    }

    async init(config?: MaestroConfig): Promise<void> {
        // Check environment variable first, then config override
        const envEnabled = import.meta.env.VITE_MAESTRO_ENABLED === 'true';
        this.enabled = config?.enabled ?? envEnabled;

        if (!this.enabled) {
            // eslint-disable-next-line no-console
            console.log('[MAESTRO] Disabled by configuration.');
            return;
        }

        try {
            await this.crypto.init();
            await this.memory.init();
            await this.runtime.init();
            this.initialized = true;
            // eslint-disable-next-line no-console
            console.info('[MAESTRO] Initialized successfully (Browser-Only Mode).');
        } catch (error) {
            console.error('[MAESTRO] Initialization failed:', error);
            this.enabled = false; // Fallback to disabled
        }
    }

    get isEnabled(): boolean {
        return this.enabled && this.initialized;
    }

    /**
     * "atomicCut": Stop side effects, log risk, return safe response.
     */
    atomicCut(reason: string): { safe: boolean; reason: string } {
        this.logRiskEvent('ATOMIC_CUT', { reason });
        return { safe: false, reason };
    }

    logRiskEvent(type: string, payload: Record<string, unknown>): void {
        if (!this.isEnabled) return;

        // In a real implementation, this would persist to a specialized audit log
        // and potentially attempt a best-effort sync if critical.
        console.warn(`[MAESTRO RISK] ${type}`, payload);
    }
}

export const maestro = new MaestroClient();
