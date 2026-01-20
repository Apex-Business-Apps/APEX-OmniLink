declare module '@xenova/transformers' {
    export const pipeline: any;
    export const env: {
        allowLocalModels: boolean;
        useBrowserCache: boolean;
        allowRemoteModels: boolean;
        [key: string]: any;
    };
}
