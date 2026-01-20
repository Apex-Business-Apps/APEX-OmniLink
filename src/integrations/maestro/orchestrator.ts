/**
 * MAESTRO Orchestrator
 * 
 * Coordinates the safe execution of AI actions.
 * - Generates Idempotency Keys.
 * - Gates high-risk actions (MAN Mode).
 * - Syncs encrypted intents to the server.
 * - Dispatches allowed actions.
 */

import { CryptoProvider } from './crypto';

export interface ExecutionIntent {
    action: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    timestamp: number;
    idempotencyKey: string;
    confidence?: number;
}

export interface ExecutionResult {
    success: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
    error?: string;
    receipt?: string;
}

// Registry of allowed actions (Allowlist)
// In a real app, this might be imported from a central registry.
const ALLOWED_ACTIONS = new Set([
    'email.send',
    'calendar.schedule',
    'notification.show',
    'apex.assistant.query', // Added for Chat UI
]);

export class MaestroOrchestrator {
    private manModeEnabled = false; // Default off, can be toggled via init

    constructor(private crypto: CryptoProvider, private syncUrl: string) { }

    setManMode(enabled: boolean) {
        this.manModeEnabled = enabled;
    }

    /**
     * Schedule an action for execution.
     */
    async schedule(
        action: string,
        payload: unknown,
        confidence = 1.0,
        executor?: () => Promise<unknown>
    ): Promise<ExecutionResult> {
        const timestamp = Date.now();

        // 1. Validate Allowlist
        if (!ALLOWED_ACTIONS.has(action)) {
            return { success: false, error: `Action '${action}' is not allowlisted.` };
        }

        // 2. Generate Idempotency Key
        const idempotencyKey = this.crypto.randomUUID();

        const intent: ExecutionIntent = {
            action,
            payload,
            timestamp,
            idempotencyKey,
            confidence
        };

        // 3. MAN Mode Gating
        // If confidence is low or MAN mode is forced, require approval.
        if (this.manModeEnabled || confidence < 0.8) {
            return { success: false, error: 'MAN_MODE_REQUIRED' };
        }

        // 4. Sync to Server (Thin Sync)
        // We encrypt the payload and send it to the server for the audit log.
        try {
            await this.syncToServer(intent);
        } catch (error) {
            // Log warning but allow offline execution if intended
            // For "Fortress", failure to sync might block high-risk.
            // For Chat, we'll allow soft-fail for UX.
            console.warn('[MAESTRO] Server sync unreachable', error);
            // return { success: false, error: 'SYNC_FAILED' };
        }

        // 5. Execute
        return this.execute(intent, executor);
    }

    private async syncToServer(intent: ExecutionIntent): Promise<void> {
        // Encrypt the blob
        const encrypted = await this.crypto.encrypt(intent);

        // Sign dispatch (mock signature for now, real one would use a specific signing key)
        const signature = 'mock_sig_' + intent.idempotencyKey;

        try {
            const response = await fetch(this.syncUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-maestro-idempotency-key': intent.idempotencyKey
                },
                body: JSON.stringify({
                    encrypted_blob: encrypted.data,
                    signature,
                    operation: intent.action,
                    timestamp: intent.timestamp
                })
            });

            if (!response.ok) {
                console.warn(`[MAESTRO] Server sync warning: ${response.statusText}`);
            }
        } catch (e) {
            throw e;
        }
    }

    private async execute(intent: ExecutionIntent, executor?: () => Promise<unknown>): Promise<ExecutionResult> {
        // eslint-disable-next-line no-console
        console.info(`[MAESTRO] Executing action: ${intent.action}`, intent.payload);

        let resultData: unknown = { executed: true, ts: Date.now() };

        if (executor) {
            try {
                resultData = await executor();
            } catch (error) {
                console.error('[MAESTRO] Execution failed:', error);
                return {
                    success: false,
                    receipt: intent.idempotencyKey,
                    error: String(error)
                };
            }
        }

        return {
            success: true,
            receipt: intent.idempotencyKey,
            result: resultData
        };
    }
}
