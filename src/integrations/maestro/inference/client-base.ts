/**
 * MAESTRO Inference Client Base
 * 
 * Shared utilities for managing Web Worker inference clients.
 * Handles request lifecycle, health checks, and worker termination.
 */

export type PendingRequest<T> = {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

export type HealthCheckResponse = {
    status: 'ok' | 'error';
    model_loaded: boolean;
    error?: string;
};

/**
 * Cleanup function to clear all pending requests with a specific error
 */
export function clearPendingRequests<T>(
    pendingRequests: Map<string, PendingRequest<T>>,
    errorMessage: string
): void {
    pendingRequests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error(errorMessage));
    });
    pendingRequests.clear();
}

/**
 * Generic health check handler
 */
export async function performHealthCheck(
    initWorkerFn: () => Worker,
    workerName: string = 'Worker'
): Promise<HealthCheckResponse> {
    try {
        const worker = initWorkerFn();
        const requestId = crypto.randomUUID();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`${workerName} health check timed out`));
            }, 5000);

            const handler = (event: MessageEvent) => {
                const response = event.data;
                if (response.id === requestId && response.type === 'health') {
                    clearTimeout(timeout);
                    worker.removeEventListener('message', handler);
                    resolve({
                        status: response.status,
                        model_loaded: response.model_loaded,
                        error: response.error
                    });
                }
            };

            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'health', id: requestId });
        });
    } catch (error) {
        return {
            status: 'error',
            model_loaded: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Handle worker response for a pending request
 */
export function handleWorkerResponse<T>(
    pendingRequests: Map<string, PendingRequest<T>>,
    id: string,
    result: T | null,
    error?: string
): void {
    const pending = pendingRequests.get(id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    pendingRequests.delete(id);

    if (error) {
        pending.reject(new Error(error));
    } else if (result !== null) {
        pending.resolve(result);
    }
}

/**
 * Create a standardized promise for a worker request
 */
export function createWorkerRequest<T>(
    pendingRequests: Map<string, PendingRequest<T>>,
    requestId: string,
    timeoutMs: number,
    timeoutMessage: string
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error(timeoutMessage));
        }, timeoutMs);

        pendingRequests.set(requestId, { resolve, reject, timeout });
    });
}
