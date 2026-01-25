/**
 * Armageddon Level 7 Worker Registration
 * 
 * Worker configuration for registering Level 7 activities and workflows
 * with the Temporal.io runtime.
 * 
 * @module armageddon/worker
 * @license Proprietary - APEX Business Systems Ltd.
 */

import { Worker, NativeConnection, Runtime } from '@temporalio/worker';
import * as level7Activities from './armageddon/activities/level7';
import { fileURLToPath } from 'url';
import path from 'path';

// Task queue for Armageddon Level 7 tests
export const ARMAGEDDON_TASK_QUEUE = 'armageddon-level7-queue';

export async function createArmageddonWorker(): Promise<Worker> {
    // Configure runtime telemetry (optional, for observability)
    Runtime.install({
        // Default logger is sufficient
    });

    // Establish connection to Temporal server
    const connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    });

    // Resolve workflow path using ESM-friendly approach
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const workflowsPath = path.join(__dirname, 'armageddon/workflows/level7.ts');

    const worker = await Worker.create({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
        taskQueue: ARMAGEDDON_TASK_QUEUE,
        workflowsPath,
        activities: level7Activities,
        // Worker options optimized for long-running battery simulations
        maxConcurrentActivityTaskExecutions: 4, // One per battery
        maxConcurrentWorkflowTaskExecutions: 10,
        maxCachedWorkflows: 100,
        stickyQueueScheduleToStartTimeout: '10s',
    });

    return worker;
}

// Auto-run if executed directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    (async () => {
        console.log('Starting Armageddon Level 7 Worker...');
        const worker = await createArmageddonWorker();
        await worker.run();
    })().catch((err) => {
        console.error('Worker failed to start:', err);
        process.exit(1);
    });
}

// Export types for external consumption
export type { Level7Config, BatteryResult, ArmageddonLevel7Result } from './armageddon/types';
