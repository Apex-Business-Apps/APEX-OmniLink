#!/usr/bin/env node
import { AdversarialEngine } from './engine.js';
import { AdversarialConfig } from './types.js';

async function main() {
    const sandboxTenant = process.env.SANDBOX_TENANT;

    if (sandboxTenant !== 'adversarial-sandbox') {
        console.error('❌ FATAL: Adversarial Battery requires SANDBOX_TENANT=adversarial-sandbox');
        process.exit(1);
    }

    const config: AdversarialConfig = {
        targetUrl: process.env.BASE_URL || 'http://localhost:4173', // Default to preview port
        maxConcurrency: 10,
        mutationRate: 0.5,
        sandboxTenant: sandboxTenant,
        safeMode: true
    };

    console.log(`💀 STARTING LEVEL 6 ADVERSARIAL SIMULATION`);
    console.log(`🎯 Target: ${config.targetUrl}`);
    console.log(`🏝️  Tenant: ${config.sandboxTenant}`);

    try {
        const engine = new AdversarialEngine(config);
        const result = await engine.runCampaign();

        console.log('\n📊 CAMPAIGN RESULTS');
        console.log(JSON.stringify(result, null, 2));

        // Fail if efficiency < 99%
        if (result.guardianEfficiency < 99) {
            console.error(`\n❌ FAILED: Guardian Efficiency ${result.guardianEfficiency.toFixed(2)}% < 99%`);
            process.exit(1);
        }

        if (result.leaked > 0) {
            console.error(`\n❌ FAILED: ${result.leaked} Payload Leaks Detected!`);
            process.exit(1);
        }

        console.log('\n✅ PASSED: System withstood Adaptive Adversarial Attack.');
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
