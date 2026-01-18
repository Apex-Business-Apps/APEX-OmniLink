import { BatteryConfig } from './types';

export const BATTERY_REGISTRY: BatteryConfig[] = [
    {
        name: 'lint',
        command: 'npm run lint',
        category: 'lint',
        timeoutMs: 300000, // 5m
    },
    {
        name: 'typecheck',
        command: 'npm run typecheck',
        category: 'lint',
        timeoutMs: 300000, // 5m
    },
    {
        name: 'unit-tests',
        command: 'npm run test:unit',
        category: 'test',
        timeoutMs: 300000, // 5m
    },
    {
        name: 'prompt-defense',
        command: 'npm run test:prompt-defense',
        category: 'test',
        timeoutMs: 300000, // 5m
    },
    {
        name: 'check-react',
        command: 'npm run check:react',
        category: 'lint',
        timeoutMs: 60000, // 1m
    },
    {
        name: 'secret-scan',
        command: 'npm run secret:scan',
        category: 'lint',
        timeoutMs: 60000, // 1m
    },
    {
        name: 'e2e',
        command: 'npm run test:e2e',
        category: 'e2e',
        timeoutMs: 900000, // 15m
        env: {
            // Ensure Playwright uses CI workers if not overridden
            CI: 'true',
        }
    },
    {
        name: 'sim-chaos',
        command: 'npm run sim:chaos',
        category: 'sim',
        destructive: true,
        timeoutMs: 600000, // 10m
    },
    {
        name: 'sim-burst',
        command: 'npm run sim:burst',
        category: 'sim',
        destructive: true, // Moderate load, arguably destructive to shared tenants
        timeoutMs: 300000, // 5m
    },
    {
        name: 'sim-adversarial',
        command: 'npx tsx sim/adversarial/cli.ts',
        category: 'sim',
        destructive: true
    }
];
