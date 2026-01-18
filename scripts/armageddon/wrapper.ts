import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';

// usage: tsx wrapper.ts <name> <barrierPath> <logPath> <cmd> <...args>

async function main() {
    const [name, barrierPath, logPath, cmd, ...args] = process.argv.slice(2);

    if (!name || !barrierPath || !logPath || !cmd) {
        console.error('Usage: tsx wrapper.ts <name> <barrierPath> <logPath> <cmd> <...args>');
        process.exit(1);
    }

    // Optimize log writing buffer
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const writeLog = (msg: string) => {
        logStream.write(`${msg}\n`);
    };

    // 1. Wait for Barrier
    // Polling every 100ms
    // console.log(`[${name}] Waiting for barrier: ${barrierPath}`);
    while (!fs.existsSync(barrierPath)) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const startTime = new Date().toISOString();
    writeLog(`BATT_START ${startTime}`);
    // console.log(`[${name}] Started at ${startTime}`);

    // 2. Spawn Child Process
    const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'], // capture stdout/err
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1' } // maintain color if possible, though writing to log strips it often unless we handle escape codes
    });

    child.stdout.on('data', (data) => {
        logStream.write(data);
    });

    child.stderr.on('data', (data) => {
        logStream.write(data);
    });

    child.on('error', (err) => {
        writeLog(`BATT_ERROR ${err.message}`);
        process.exit(1);
    });

    child.on('close', (code) => {
        const endTime = new Date().toISOString();
        writeLog(`BATT_END ${endTime} exit=${code}`);
        logStream.end();
        process.exit(code ?? 1);
    });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
