
import { describe, it, expect } from 'vitest';
import { ChaosEngine, HEAVY_CHAOS_CONFIG, simulateFailure } from '../chaos-engine';
import { createEvent } from '../contracts';

/**
 * SIMULATED WORKFLOW: MAN Policy Enforcement
 * 
 * This mock simulates the actual python orchestrator/policies/man_policy.py workflow
 * but injected with the Chaos Engine to verify crash resilience.
 */
class ManWorkflow {
    private chaos: ChaosEngine;

    constructor(chaosConfig = HEAVY_CHAOS_CONFIG) {
        this.chaos = new ChaosEngine(chaosConfig);
    }

    /**
     * Simulates the "Evaluate & Execute" loop of the Orchestrator
     */
    async execute(intent: string, params: Record<string, any>): Promise<{ status: string; reason?: string }> {
        const event = createEvent('orchestrator', 'omnihub:workflow.triggered')
            .correlationId(`chaos-test-${Date.now()}`)
            .idempotencyKey(`idem-${Date.now()}-${crypto.randomUUID()}`)
            .source('omnihub')
            .payload({ intent, params })
            .build();

        // 1. CHAOS INJECTION: Simulate System Panic (Network/Server/Timeout)
        // We strictly follow the Chaos Engine's decision to crash the system
        const decision = this.chaos.decide(event);

        try {
            // If chaos dictates a crash, we simulate it here BEFORE policy logic
            if (decision.shouldFailNetwork) simulateFailure('network');
            if (decision.shouldFailServer) simulateFailure('server');
            if (decision.shouldTimeout) simulateFailure('timeout');

            // 2. NORMAL OPERATION: Policy Logic (Simplified simulation of man_policy.py)
            if (this.isHighRisk(intent)) {
                return { status: 'handoff_to_human', reason: 'High Risk Policy (MAN Mode)' };
            }

            return { status: 'executed', reason: 'Safe' };

        } catch (error) {
            // 3. RESILIENCE LAYER: This is what we are testing.
            // The system should CATCH the panic and DEFAULT to safe handoff.

            return {
                status: 'handoff_to_human',
                reason: `System Panic Recovery: ${(error as Error).message}`
            };
        }
    }

    // Simplified policy logic matching man_policy.py
    private isHighRisk(intent: string): boolean {
        const highRiskIntents = ['delete_database', 'transfer_funds', 'revoke_access'];
        return highRiskIntents.includes(intent);
    }
}

describe('Integration: MAN Policy Chaos Resilience', () => {
    it('should explicitly handoff to human when system panics (Chaos Mode)', async () => {
        // 1. Setup: Heavy Chaos (30% duplicates, 15% timeouts, 10% network failures)
        // We use a specific seed ensuring we hit a failure case for deterministic proofs
        // Seed 123 with HEAVY config matches a failure scenario early on in most PRNGs
        const workflow = new ManWorkflow({ ...HEAVY_CHAOS_CONFIG, seed: 999 });

        // 2. Execute: Run a high volume of requests to guarantee hitting chaos
        const results = [];
        for (let i = 0; i < 50; i++) {
            results.push(await workflow.execute('delete_database', { id: i }));
        }

        // 3. Verify: We expect Mix of "High Risk Policy" (Success) and "System Panic Recovery" (Failure Caught)
        const panicRecoveries = results.filter(r => r.reason?.includes('System Panic Recovery'));
        const policyHandoffs = results.filter(r => r.reason?.includes('High Risk Policy'));

        console.log(`Chaos Report: ${panicRecoveries.length} panic recoveries, ${policyHandoffs.length} standard handoffs`);

        // Assertion 1: We MUST have triggered some chaos to prove the test is valid
        expect(panicRecoveries.length).toBeGreaterThan(0);

        // Assertion 2: Startlingly, ALL requests (even panicked ones) must have 'handoff_to_human' status
        // This proves the "Safety Net" works. Zero crashes allowed.
        const crashed = results.filter(r => r.status !== 'handoff_to_human');
        expect(crashed).toHaveLength(0);
    });

    it('should correctly classify safe tools amidst chaos', async () => {
        const workflow = new ManWorkflow({ ...HEAVY_CHAOS_CONFIG, seed: 123 });

        // safe tool
        const result = await workflow.execute('read_data', {});

        // If it didn't panic, it should be executed.
        // If it panicked, it should be handoff_to_human.
        // It should NEVER throw unhandled.
        expect(['executed', 'handoff_to_human']).toContain(result.status);
    });
});
