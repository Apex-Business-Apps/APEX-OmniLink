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
import * as level7Activities from './activities/level7';

// Task queue for Armageddon Level 7 tests
export const ARMAGEDDON_TASK_QUEUE = 'armageddon-level7-queue';

/**
 * Create and configure the Armageddon Level 7 worker
 * 
 * Usage in main worker.ts:
 * ```typescript
 * import { createArmageddonWorker, ARMAGEDDON_TASK_QUEUE } from './armageddon/worker';
 * 
 * async function main() {
 *   const worker = await createArmageddonWorker();
 *   await worker.run();
 * }
 * ```
 */
export async function createArmageddonWorker(): Promise<Worker> {
    // Configure runtime telemetry (optional, for observability)
    Runtime.install({
        logger: {
            level: 'INFO',
            destination: {
                type: 'console',
            },
        },
    });

    // Establish connection to Temporal server
    const connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    });

    const worker = await Worker.create({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
        taskQueue: ARMAGEDDON_TASK_QUEUE,
        workflowsPath: require.resolve('./workflows/level7'),
        activities: level7Activities,
        // Worker options optimized for long-running battery simulations
        maxConcurrentActivityTaskExecutions: 4, // One per battery
        maxConcurrentWorkflowTaskExecutions: 10,
        maxCachedWorkflows: 100,
        stickyQueueScheduleToStartTimeout: '10s',
    });

    return worker;
}

/**
 * Activity registration snippet for existing workers
 * 
 * If you have an existing worker.ts that needs to include
 * the Armageddon Level 7 activities, add this:
 * 
 * ```typescript
 * import * as armageddonActivities from './armageddon/activities/level7';
 * 
 * const worker = await Worker.create({
 *   // ... existing config ...
 *   activities: {
 *     ...existingActivities,
 *     ...armageddonActivities,
 *   },
 * });
 * ```
 */

/**
 * Workflow registration snippet for existing workers
 * 
 * For bundled workflows, ensure the webpack/esbuild config includes:
 * 
 * ```typescript
 * workflowsPath: require.resolve('./armageddon/workflows/level7'),
 * // OR for multiple workflow files:
 * workflowBundle: await bundleWorkflowCode({
 *   workflowsPath: [
 *     require.resolve('./workflows/existing'),
 *     require.resolve('./armageddon/workflows/level7'),
 *   ],
 * }),
 * ```
 */

/**
 * Start client snippet for triggering Level 7 tests
 * 
 * ```typescript
 * import { Client } from '@temporalio/client';
 * import { ArmageddonLevel7Workflow } from './armageddon/workflows/level7';
 * import { ARMAGEDDON_TASK_QUEUE } from './armageddon/worker';
 * import { v4 as uuidv4 } from 'uuid';
 * 
 * async function runArmageddon() {
 *   const client = new Client();
 *   
 *   const handle = await client.workflow.start(ArmageddonLevel7Workflow, {
 *     taskQueue: ARMAGEDDON_TASK_QUEUE,
 *     workflowId: `armageddon-level7-${uuidv4()}`,
 *     args: [{
 *       runId: uuidv4(),
 *       iterations: 10000,
 *       seed: Date.now(),
 *     }],
 *   });
 *   
 *   console.log(`Started Armageddon Level 7: ${handle.workflowId}`);
 *   const result = await handle.result();
 *   console.log(`Verdict: ${result.verdict}`);
 *   console.log(`Aggregate Escape Rate: ${(result.aggregateEscapeRate * 100).toFixed(4)}%`);
 * }
 * ```
 */

// Export types for external consumption
export type { Level7Config, BatteryResult, ArmageddonLevel7Result } from './types';
