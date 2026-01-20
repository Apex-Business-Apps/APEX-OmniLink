/**
 * MAESTRO Execution Adapter (Phase 5)
 *
 * Single-port entry point for ExecutionIntent processing.
 * Browser-only compute preserved - no server inference/embeddings/vector search.
 */

import { MaestroOrchestrator, ExecutionIntent, ExecutionResult } from './orchestrator';
import { CryptoProvider } from './crypto';

/**
 * Single-Port Execution Adapter
 * Entry point: /src/integrations/maestro/execution
 */
export class MaestroExecutionAdapter {
    private orchestrator: MaestroOrchestrator;

    constructor(
        crypto: CryptoProvider,
        syncUrl: string,
        manModeUrl?: string
    ) {
        this.orchestrator = new MaestroOrchestrator(crypto, syncUrl, manModeUrl);
    }

    /**
     * Main execution entry point - Single Port Rule
     */
    async executeExecutionIntent(intent: ExecutionIntent): Promise<ExecutionResult> {
        return this.orchestrator.executeExecutionIntent(intent);
    }

    /**
     * Convenience method: Validate ExecutionIntent
     */
    validateExecutionIntent(intent: ExecutionIntent) {
        return this.orchestrator.validateExecutionIntent(intent);
    }

    /**
     * Convenience method: Route ExecutionIntent
     */
    routeExecutionIntent(intent: ExecutionIntent) {
        return this.orchestrator.routeExecutionIntent(intent);
    }
}

// Global instance for singleton access
let globalAdapter: MaestroExecutionAdapter | null = null;

/**
 * Get or create global MAESTRO execution adapter
 * Browser-only - respects MAESTRO_ENABLED flag
 */
export function getMaestroExecutionAdapter(): MaestroExecutionAdapter | null {
    // Check MAESTRO_ENABLED environment flag
    const maestroEnabled = import.meta.env.VITE_MAESTRO_ENABLED === 'true';

    if (!maestroEnabled) {
        console.warn('[MAESTRO] Disabled by VITE_MAESTRO_ENABLED=false');
        return null;
    }

    if (!globalAdapter) {
        // TODO: Initialize with proper crypto, sync URL, and MAN mode URL
        // This is a placeholder - needs proper initialization
        console.warn('[MAESTRO] ExecutionAdapter not fully initialized - placeholder implementation');
        globalAdapter = null; // Set to null until properly initialized
    }

    return globalAdapter;
}

/**
 * Initialize MAESTRO execution adapter
 * Should be called during app startup if MAESTRO is enabled
 */
export async function initializeMaestroExecutionAdapter(
    crypto: CryptoProvider,
    syncUrl: string,
    manModeUrl?: string
): Promise<void> {
    globalAdapter = new MaestroExecutionAdapter(crypto, syncUrl, manModeUrl);
    console.warn('[MAESTRO] ExecutionAdapter initialized successfully');
}

/**
 * Execute ExecutionIntent via global adapter
 * Returns null if MAESTRO is disabled
 */
export async function executeMaestroIntent(intent: ExecutionIntent): Promise<ExecutionResult | null> {
    const adapter = getMaestroExecutionAdapter();
    if (!adapter) {
        console.warn('[MAESTRO] Execution skipped - adapter not available');
        return null;
    }

    return adapter.executeExecutionIntent(intent);
}
