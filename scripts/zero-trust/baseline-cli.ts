import fs from 'fs';
import path from 'path';
import { ActivityLog, computeBaseline, formatBaseline } from '../../src/zero-trust/baseline';

function loadLogs(): ActivityLog[] {
  const arg = process.argv.find((a) => a.startsWith('--input='));
  if (!arg) {
    return [
      { userId: 'u1', deviceId: 'laptop', action: 'login', timestamp: Date.now() - 60000, durationMs: 5000 },
      { userId: 'u1', deviceId: 'laptop', action: 'view', timestamp: Date.now() - 30000, durationMs: 2000 },
      { userId: 'u2', deviceId: 'mobile', action: 'login', timestamp: Date.now() - 40000, durationMs: 800 },
    ];
  }
  const filePath = arg.split('=')[1];
  const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
  return JSON.parse(content) as ActivityLog[];
}

function main() {
  const logs = loadLogs();
  const baseline = computeBaseline(logs);
  console.log(formatBaseline(baseline));
}

main();

