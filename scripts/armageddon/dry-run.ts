import { spawn } from 'child_process';
import path from 'path';

// Usage: tsx scripts/armageddon/dry-run.ts

const env = {
    ...process.env,
    SIM_MODE: 'true',
    SANDBOX_TENANT: 'dryrun-safe-tenant',
    FORCE_COLOR: '1'
};

const certifyScript = path.join(process.cwd(), 'scripts', 'armageddon', 'certify.ts');
const reportScript = path.join(process.cwd(), 'scripts', 'armageddon', 'report.ts');

async function runStep(name: string, script: string) {
    console.log(`\n[DRY-RUN] Starting step: ${name}`);
    return new Promise<void>((resolve, reject) => {
        const child = spawn('npx', ['tsx', script], {
            env,
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${name} failed with code ${code}`));
        });
    });
}

async function main() {
    let certifyFailed = false;
    try {
        await runStep('Certify', certifyScript);
    } catch (e: any) {
        console.error(e.message);
        certifyFailed = true;
    }

    try {
        await runStep('Report', reportScript);
    } catch (e: any) {
        console.error('Report generation failed:', e.message);
    }

    if (certifyFailed) {
        console.log('\n[DRY-RUN] Finished with errors (Certify failed).');
        process.exit(1);
    } else {
        console.log('\n[DRY-RUN] Success.');
    }
}

main();
