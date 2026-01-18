import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { BATTERY_REGISTRY } from './registry';
import { BatteryConfig, BatteryStatus } from './types';
import os from 'os';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, () => {
            const port = (srv.address() as net.AddressInfo).port;
            srv.close((err) => {
                if (err) reject(err);
                else resolve(port);
            });
        });
    });
}

function generateRunId(): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', '');
    const rand = Math.random().toString(36).substring(2, 8);
    return `adt-${ts}-${rand}`;
}

async function main() {
    const startTime = Date.now();

    // 1. Env & Configuration
    const args = process.argv.slice(2);
    const modeIndex = args.indexOf('--only');
    const specificBattery = modeIndex !== -1 ? args[modeIndex + 1] : undefined;

    const runIdIndex = args.indexOf('--run-id');
    const customRunId = runIdIndex !== -1 ? args[runIdIndex + 1] : process.env.ARMAGEDDON_RUN_ID;

    const isSimMode = process.env.SIM_MODE === 'true';
    const sandboxTenant = process.env.SANDBOX_TENANT;
    const runId = customRunId || generateRunId();

    // 2. Setup Artifacts Directory
    const rootDir = process.cwd();
    const artifactsDir = path.join(rootDir, 'artifacts', 'armageddon', runId);
    const evidenceDir = path.join(artifactsDir, 'evidence');
    const tmpDir = path.join(artifactsDir, 'tmp');
    const barrierPath = path.join(artifactsDir, 'barrier.lock');

    console.log(`\n🔥 ARMAGEDDON CERTIFICATION HARNESS 🔥`);
    console.log(`Run ID: ${runId}`);
    console.log(`Artifacts: ${artifactsDir}\n`);

    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    // 3. Select Batteries
    const batteriesToRun: { config: BatteryConfig; status: BatteryStatus; reason?: string }[] = [];

    // Filter by --only if present
    const registry = specificBattery
        ? BATTERY_REGISTRY.filter(b => b.name === specificBattery)
        : BATTERY_REGISTRY;

    if (specificBattery && registry.length === 0) {
        console.error(`Battery '${specificBattery}' not found in registry.`);
        process.exit(1);
    }

    // Filter / Block logic
    for (const b of registry) {
        if (b.destructive) {
            if (!isSimMode) {
                batteriesToRun.push({ config: b, status: 'BLOCKED', reason: 'SIM_MODE != true' });
                continue;
            }
            if (!sandboxTenant) {
                batteriesToRun.push({ config: b, status: 'BLOCKED', reason: 'SANDBOX_TENANT unset' });
                continue;
            }
            // Production URL Heuristics (Simplistic check)
            const baseUrl = process.env.BASE_URL || '';
            if (baseUrl.includes('production') || baseUrl.includes('mainnet')) {
                batteriesToRun.push({ config: b, status: 'BLOCKED', reason: 'Production URL detected' });
                console.error(`🚨 CRITICAL: Production URL detected (${baseUrl}) blocking destructive battery ${b.name}`);
                continue;
            }
        }
        batteriesToRun.push({ config: b, status: 'PENDING' });
    }

    // 4. PREPARE FOR LAUNCH
    const pendingBatteries = batteriesToRun.filter(b => b.status === 'PENDING');
    console.log(`\nPreparing ${pendingBatteries.length} batteries...`);

    // Reserve Ports (simulating port allocation if we needed strictly defined ports, 
    // but mostly relying on isolation ENV vars)
    // We'll give each battery a unique potential port just in case they need one via env PORT

    const launchPromises = pendingBatteries.map(async (item) => {
        const b = item.config;
        const batTmpDir = path.join(tmpDir, b.name);
        fs.mkdirSync(batTmpDir, { recursive: true });

        const logPath = path.join(evidenceDir, `${b.name}.log`);
        const port = await getFreePort();

        // Construct Env
        const env = {
            ...process.env,
            ...b.env,
            BATTERY_TMPDIR: batTmpDir,
            BATTERY_LOG_PATH: logPath,
            BATTERY_PORT: port.toString(), // Some scripts might use this
            PORT: port.toString(), // Common convention
            FORCE_COLOR: '1',
        };

        // Use relative path to avoid whitespace quoting issues in shell mode
        const wrapperPath = 'scripts/armageddon/wrapper.ts';

        // Split command for spawn
        const [cmdBin, ...cmdArgs] = b.command.split(' ');

        const finalArgs = [
            wrapperPath,
            b.name,
            barrierPath,
            logPath,
            cmdBin,
            ...cmdArgs
        ];

        console.log(`[${b.name}] Spawning (Port: ${port})...`);

        // Use npx with shell: true for reliability on Windows
        const child = spawn('npx', ['tsx', ...finalArgs], {
            env,
            stdio: 'inherit',
            detached: false,
            shell: true
        });

        return { item, child, logPath };
    });

    const children = await Promise.all(launchPromises);

    // 5. BARRIER RELEASE
    console.log(`\n🛑 All Batteries Spawned & Paused. Releasing Barrier in 1s...`);
    await new Promise(r => setTimeout(r, 1000));

    const releaseTime = new Date().toISOString();
    fs.writeFileSync(barrierPath, `BARRIER_RELEASE ${releaseTime}`);
    console.log(`🚀 BARRIER RELEASED at ${releaseTime}`);

    // 6. Wait for Completion
    // We wait for all children to exit
    const results = await Promise.all(children.map(c => {
        return new Promise<{ name: string; code: number }>((resolve) => {
            c.child.on('close', (code) => {
                resolve({ name: c.item.config.name, code: code ?? 1 });
            });
            c.child.on('error', (err) => {
                console.error(`Error spawning ${c.item.config.name}:`, err);
                resolve({ name: c.item.config.name, code: 1 });
            });
        });
    }));

    // 7. Summary
    console.log(`\n\n🏁 MISSION COMPLETE`);
    console.log('Results:');

    let exitCode = 0;

    for (const b of batteriesToRun) {
        if (b.status === 'BLOCKED') {
            console.log(`[BLOCKED] ${b.config.name} - ${b.reason}`);
        } else {
            const res = results.find(r => r.name === b.config.name);
            const code = res?.code ?? -1;
            const passed = code === 0;
            if (!passed) exitCode = 1;
            console.log(`[${passed ? 'PASS' : 'FAIL'}] ${b.config.name} (Exit: ${code})`);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nTotal Duration: ${duration}s`);
    console.log(`Artifacts: ${artifactsDir}`);

    // Note: Report generation will read these artifacts later.
    // For now, this orchestrator finishes.

    process.exit(exitCode);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
