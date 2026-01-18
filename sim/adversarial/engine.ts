import { AdversarialConfig, CampaignResult, Strategy } from './types.js';
import { PAYLOADS, GUAARDIAN_BYPASS_HEADERS } from './payloads.js';
import axios, { AxiosError } from 'axios';

export class AdversarialEngine {
    private config: AdversarialConfig;
    private log: string[] = [];
    private currentStrategy: Strategy = 'PROBE';

    constructor(config: AdversarialConfig) {
        if (!config.safeMode || config.sandboxTenant !== 'adversarial-sandbox') {
            throw new Error('Adversarial Engine SAFETY LOCK: Must execute in SAFE_MODE with SANDBOX_TENANT=adversarial-sandbox');
        }
        this.config = config;
    }

    private async delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async executeRequest(url: string, method: string, data?: any): Promise<{ status: number; time: number }> {
        const start = Date.now();
        try {
            const res = await axios({
                url,
                method,
                data,
                headers: {
                    ...GUAARDIAN_BYPASS_HEADERS,
                    'X-Adversarial-Safe-Mode': 'true',
                    'X-Tenant-ID': this.config.sandboxTenant
                },
                validateStatus: () => true, // Don't throw on 4xx/5xx
                timeout: 5000
            });
            return { status: res.status, time: Date.now() - start };
        } catch (error) {
            // Network error / timeout
            return { status: 0, time: Date.now() - start };
        }
    }

    public async runCampaign(): Promise<CampaignResult> {
        this.log.push(`[${new Date().toISOString()}] STARTING LEVEL 6 ADVERSARIAL CAMPAIGN`);

        const result: CampaignResult = {
            vectorsAttempted: 0,
            payloadsDelivered: 0,
            blocked: 0,
            safe: 0,
            leaked: 0,
            rateLimited: 0,
            guardianEfficiency: 100,
            strategiesUsed: ['PROBE']
        };

        const target = this.config.targetUrl; // e.g., http://localhost:3000

        // PHASE 1: PROBE
        this.log.push(`[PHASE 1] PROBE - Analyzing ${target}...`);
        // Simple probe to check connectivity
        const probe = await this.executeRequest(`${target}/health`, 'GET');
        if (probe.status === 0) {
            this.log.push('Target unreachable. Aborting.');
            return result;
        }

        // PHASE 2 & 3: ADAPTIVE LOOP
        // We will try SQLi first. If blocked (403), we try XSS. If 429, we wait (BYPASS).

        const vectors = [
            ...PAYLOADS.SQL_INJECTION.map(p => ({ payload: p, type: 'SQLi' })),
            ...PAYLOADS.XSS_POLYGLOTS.map(p => ({ payload: p, type: 'XSS' })),
            ...PAYLOADS.NO_SQL_INJECTION.map(p => ({ payload: p, type: 'NoSQL' })),
        ];

        for (const vector of vectors) {
            // Adaptive logic
            if (result.rateLimited > 5 && this.currentStrategy !== 'BYPASS') {
                this.currentStrategy = 'BYPASS';
                result.strategiesUsed.push('BYPASS');
                this.log.push('Rate limits hit. Switching to BYPASS strategy (slow roll)...');
                await this.delay(2000);
            }

            if (this.currentStrategy === 'BYPASS') {
                await this.delay(500); // 2Hz
            } else {
                // FLOOD / INFILTRATE speed
                await this.delay(50); // 20Hz
            }

            result.vectorsAttempted++;

            // Construct payload
            // Trying generic login bypass pattern
            const endpoint = `${target}/api/auth/login`;
            const body = { email: `admin@example.com${vector.payload}`, password: 'password' };

            const response = await this.executeRequest(endpoint, 'POST', body);
            result.payloadsDelivered++;

            // Analyze Response
            if (response.status === 429) {
                result.rateLimited++;
            } else if (response.status === 403 || response.status === 400 || response.status === 422) {
                result.blocked++;
                // If blocked, maybe try mutating? (Infiltrate)
                if (this.currentStrategy !== 'INFILTRATE' && Math.random() > 0.8) {
                    this.currentStrategy = 'INFILTRATE';
                    result.strategiesUsed.push('INFILTRATE');
                }
            } else if (response.status === 200) {
                // Potential Leak!
                // Check body for signs of success (in a real scenario we'd check tokens)
                // For this sim, we assume 200 OK on a bad payload IS a leak unless it's a "Login Failed" 200.
                // Simplified check:
                result.leaked++; // Penalize for any 200 OK on injection
            } else {
                result.safe++; // 401, 404, 500 (handled via other metrics)
            }
        }

        // Calculation
        const totalBadEvents = result.blocked + result.leaked + result.rateLimited;
        if (totalBadEvents > 0) {
            result.guardianEfficiency = ((result.blocked + result.rateLimited) / totalBadEvents) * 100;
        }

        this.log.push(`[${new Date().toISOString()}] CAMPAIGN FINISHED. Efficiency: ${result.guardianEfficiency}%`);
        console.log(this.log.join('\n'));

        return result;
    }
}
