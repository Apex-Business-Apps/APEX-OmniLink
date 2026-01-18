export type BatteryStatus = 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';

export interface BatteryConfig {
    name: string;
    command: string; // The npm script or command to run
    category: 'lint' | 'test' | 'e2e' | 'sim' | 'build';
    destructive?: boolean; // If true, requires SIM_MODE and SANDBOX_TENANT
    env?: Record<string, string>;
    timeoutMs?: number;
}

export interface BatteryResult {
    name: string;
    status: BatteryStatus;
    exitCode: number | null;
    durationMs: number;
    startTime?: number;
    endTime?: number;
    logPath: string;
    error?: string;
}

export interface ATSCReport {
    runId: string;
    timestamp: string;
    status: 'PASS' | 'FAIL'; // specific logic for "PASS": no FAIL, but BLOCKED is ok
    batteries: BatteryResult[];
    summary: {
        total: number;
        passed: number;
        failed: number;
        blocked: number;
        skipped: number;
        durationMs: number;
    };
    guardrails: {
        simMode: boolean;
        sandboxTenant: string | undefined;
        destructiveBlocked: boolean;
    };
}
