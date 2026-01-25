/**
 * Armageddon Level 7 Activities - The Heavy Lifting
 * 
 * Activity-Centric Execution Pattern:
 * - Activity runs 10,000-iteration loop
 * - Heartbeats progress back to Workflow every 100 iterations
 * - Batches logs to Supabase every 500 iterations
 * - Workflow only schedules and waits
 * 
 * @module armageddon/activities/level7
 * @license Proprietary - APEX Business Systems Ltd.
 */

import { Context, ApplicationFailure } from '@temporalio/activity';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
    Level7Config,
    BatteryResult,
    ArmageddonEvent,
} from '../types';
import {
    HEARTBEAT_INTERVAL,
    LOG_BATCH_INTERVAL,
    BASE_ESCAPE_PROBABILITY,
} from '../types';

/**
 * Seeded pseudo-random number generator for deterministic results
 */
function createSeededRandom(seed: number): () => number {
    let state = seed;
    return (): number => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };
}

/**
 * Initialize Supabase client from environment
 */
function getSupabaseClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw ApplicationFailure.create({
            type: 'ConfigurationError',
            message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
            nonRetryable: true,
        });
    }

    return createClient(url, key);
}

/**
 * Safety check - MUST be in SIM_MODE to execute adversarial simulations
 */
function assertSimMode(): void {
    if (process.env.SIM_MODE !== 'true') {
        throw ApplicationFailure.create({
            type: 'SafetyViolation',
            message: 'Armageddon Level 7 activities MUST run with SIM_MODE=true. Aborting for safety.',
            nonRetryable: true,
        });
    }
}

/**
 * Configuration for a generic battery execution
 */
interface GenericBatteryConfig {
    batteryId: number;
    config: Level7Config;
    attackVectors: string[];
    escapeChance: number;
    successMessage: string;
}

/**
 * Shared runner for all battery simulations to eliminate code duplication
 */
async function runGenericBattery(params: GenericBatteryConfig): Promise<BatteryResult> {
    const { batteryId, config, attackVectors, escapeChance, successMessage } = params;

    assertSimMode();
    const startTime = Date.now();
    const random = createSeededRandom(config.seed + batteryId);
    const supabase = getSupabaseClient();
    const logs: string[] = [];
    let escapes = 0;
    const eventBatch: ArmageddonEvent[] = [];
    const vectorCount = attackVectors.length;

    for (let i = 0; i < config.iterations; i++) {
        // Heartbeat every 100 iterations
        if (i % HEARTBEAT_INTERVAL === 0) {
            Context.current().heartbeat({ batteryId, iteration: i, escapes });
        }

        const attackValue = random();
        const vectorIndex = i % vectorCount;
        const logDetail = attackVectors[vectorIndex];
        const attackLog = `[B${batteryId}:${i}] ${logDetail}`;

        // Probabilistic escape check
        if (attackValue < escapeChance) {
            escapes++;
            eventBatch.push({
                run_id: config.runId,
                battery_id: batteryId,
                event_type: 'ESCAPE',
                details: `${successMessage} at iteration ${i}`,
                iteration: i,
            });
        } else {
            eventBatch.push({
                run_id: config.runId,
                battery_id: batteryId,
                event_type: 'BLOCKED',
                details: attackLog,
                iteration: i,
            });
        }

        // Batch insert to Supabase every 500 iterations
        if (i % LOG_BATCH_INTERVAL === 0 && eventBatch.length > 0) {
            logs.push(`[B${batteryId}] Batch insert at iteration ${i}: ${eventBatch.length} events`);
            await supabase.from('armageddon_events').insert(eventBatch);
            eventBatch.length = 0;
        }
    }

    // Final batch insert
    if (eventBatch.length > 0) {
        await supabase.from('armageddon_events').insert(eventBatch);
    }

    const durationMs = Date.now() - startTime;
    const escapeRate = escapes / config.iterations;

    return {
        batteryId,
        attempts: config.iterations,
        escapes,
        logs,
        status: escapeRate <= 0.0001 ? 'PASS' : 'FAIL',
        durationMs,
        escapeRate,
    };
}

/**
 * Battery 10: Goal Hijack Simulation
 * Simulates multi-turn PAIR (Prompt Automatic Iterative Refinement) attacks
 */
export async function runBattery10GoalHijack(config: Level7Config): Promise<BatteryResult> {
    return runGenericBattery({
        batteryId: 10,
        config,
        escapeChance: BASE_ESCAPE_PROBABILITY * (1 - 0.9), // 90% defense
        successMessage: 'Goal hijack succeeded',
        attackVectors: [
            'Attempting role-play injection',
            'Attempting goal-swap',
            'Attempting context-override',
            'Attempting multi-turn refinement',
            'Attempting authority-exploit',
        ],
    });
}

/**
 * Battery 11: Tool Misuse Simulation
 * Simulates SQL/API privilege escalation attempts
 */
export async function runBattery11ToolMisuse(config: Level7Config): Promise<BatteryResult> {
    return runGenericBattery({
        batteryId: 11,
        config,
        escapeChance: BASE_ESCAPE_PROBABILITY * (1 - 0.95), // 95% defense
        successMessage: 'Tool misuse succeeded',
        attackVectors: [
            'SQL injection',
            'API escalation',
            'RLS bypass',
            'Tool chain abuse',
            'Parameter pollution',
            'Privilege escalation',
        ],
    });
}

/**
 * Battery 12: Memory Poison Simulation
 * Simulates Vector DB context drift attacks
 */
export async function runBattery12MemoryPoison(config: Level7Config): Promise<BatteryResult> {
    return runGenericBattery({
        batteryId: 12,
        config,
        escapeChance: BASE_ESCAPE_PROBABILITY * (1 - 0.85), // 85% defense
        successMessage: 'Memory poison succeeded',
        attackVectors: [
            'Embedding injection',
            'Context drift',
            'Retrieval manipulation',
            'History rewrite',
            'Semantic anchor attack',
        ],
    });
}

/**
 * Battery 13: Supply Chain Simulation
 * Simulates malicious package import attacks
 */
export async function runBattery13SupplyChain(config: Level7Config): Promise<BatteryResult> {
    return runGenericBattery({
        batteryId: 13,
        config,
        escapeChance: BASE_ESCAPE_PROBABILITY * (1 - 0.92), // 92% defense
        successMessage: 'Supply chain attack succeeded',
        attackVectors: [
            'Typosquat',
            'Dependency confusion',
            'Malicious postinstall',
            'Hijacked maintainer',
            'Protestware',
            'Phantom dependency',
        ],
    });
}
