declare module '@xenova/transformers' {
    export function pipeline(
        task: string,
        model?: string,
        options?: Record<string, unknown>
    ): Promise<unknown>;

    export const env: {
        allowLocalModels: boolean;
        useBrowserCache: boolean;
        allowRemoteModels: boolean;
        [key: string]: unknown;
    };
}
