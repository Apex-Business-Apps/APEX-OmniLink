/**
 * Armageddon Level 7 Certification Trigger
 * 
 * Triggers the Armageddon Level 7 Workflow and reports results.
 */
import { Client, Connection } from '@temporalio/client';
import { ArmageddonLevel7Workflow } from '../armageddon/workflows/level7';
import { ARMAGEDDON_TASK_QUEUE } from '../worker';
import { v4 as uuidv4 } from 'uuid';

async function runArmageddon() {
    console.log('Connecting to Temporal...');
    const connection = await Connection.connect({ address: 'localhost:7233' });
    const client = new Client({ connection });

    const runId = uuidv4();
    console.log(`Starting Armageddon Level 7 Certification Run (ID: ${runId})...`);
    console.log('Configuration: 10,000 iterations per battery, <0.01% escape threshold');

    const handle = await client.workflow.start(ArmageddonLevel7Workflow, {
        taskQueue: ARMAGEDDON_TASK_QUEUE,
        workflowId: `armageddon-level7-${runId}`,
        args: [{
            runId: runId,
            iterations: 10000,
            seed: Date.now(),
        }],
    });

    console.log(`Started Workflow: ${handle.workflowId}`);
    console.log('Waiting for results (timeout 1h)...');

    try {
        const result = await handle.result();

        const totalAttempts = result.batteries.reduce((acc, b) => acc + b.attempts, 0);
        const totalEscapes = result.batteries.reduce((acc, b) => acc + b.escapes, 0);

        console.log('\n--- ARMAGEDDON LEVEL 7 RESULTS ---');
        console.log(`Verdict: ${result.verdict}`);
        console.log(`Aggregate Escape Rate: ${(result.aggregateEscapeRate * 100).toFixed(4)}%`);
        console.log(`Total Attempts: ${totalAttempts}`);
        console.log(`Total Escapes: ${totalEscapes}`);
        console.log('\nBattery Details:');
        result.batteries.forEach(b => {
            console.log(`  Battery ${b.batteryId}: ${b.status} (Attempts: ${b.attempts}, Escapes: ${b.escapes})`);
        });

        if (result.verdict === 'CERTIFIED') {
            console.log('\nCERTIFICATION SUCCESSFUL');
            process.exit(0);
        } else {
            console.log('\nCERTIFICATION FAILED');
            process.exit(1);
        }
    } catch (err) {
        console.error('Workflow failed:', err);
        process.exit(1);
    }
}

// Use top-level await for cleaner execution
try {
    await runArmageddon();
} catch (err) {
    console.error('Script error:', err);
    process.exit(1);
}
