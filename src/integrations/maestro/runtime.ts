/**
 * MAESTRO Runtime
 * 
 * Manages the Web Worker lifecycle and bridges messages.
 * Ensures UI thread remains unblocked during AI operations.
 */

import { WorkerMessage, WorkerResponse } from './worker';

export class MaestroRuntime {
    private worker: Worker | null = null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private pendingRequests = new Map<string, { resolve: (val: unknown) => void; reject: (err: unknown) => void }>();

    async init(): Promise<void> {
        if (this.worker) return;

        // Vite handles this import.meta.url magic to bundle the worker correctly
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
            type: 'module',
        });

        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            this.handleMessage(event.data);
        };

        this.worker.onerror = (error) => {
            console.error('[MAESTRO WORKER ERROR]', error);
        };

        // Initialize the worker environment
        await this.send({ type: 'INIT', payload: { config: {} } });
    }

    private handleMessage(message: WorkerResponse) {
        // In a real implementation with unique IDs per request, we would resolve specific promises.
        // For this simple scaffold, we don't have IDs yet, so we assume sequentiality or just log.
        // TODO: Implement proper Request/Response correlation with IDs.

        // For now, let's just log capabilities.
        console.debug('[MAESTRO RUNTIME] Received:', message.type);
    }

    // Generic send wrapper
    // In a robust version, this returns a Promise<ExpectedResponse>
    async send(message: WorkerMessage): Promise<void> {
        if (!this.worker) await this.init();
        this.worker?.postMessage(message);
    }

    async classify(text: string, labels: string[]): Promise<void> {
        // Fire and forget for now until we have ID correlation
        await this.send({
            type: 'CLASSIFY',
            payload: { text, labels }
        });
    }

    terminate() {
        this.worker?.terminate();
        this.worker = null;
    }
}
