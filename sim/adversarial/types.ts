export type Strategy = 'PROBE' | 'FLOOD' | 'INFILTRATE' | 'BYPASS';

export interface AdversarialConfig {
    targetUrl: string;
    maxConcurrency: number;
    mutationRate: number;
    sandboxTenant: string;
    safeMode: boolean; // Must be true for this engine to run
}

export interface AttackVector {
    name: string;
    payloads: string[];
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    successCriteria: (status: number, body: string) => boolean; // True if attack SUCCEEDED (which is BAD for us)
}

export interface CampaignResult {
    vectorsAttempted: number;
    payloadsDelivered: number;
    blocked: number; // 403, 422, 400
    safe: number;    // 200/500 but without data leakage
    leaked: number;  // 200 with confirming evidence
    rateLimited: number; // 429
    guardianEfficiency: number; // % of blocked/(blocked+leaked)
    strategiesUsed: Strategy[];
}
