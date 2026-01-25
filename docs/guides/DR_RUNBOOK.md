# Disaster Recovery Runbook

## Critical Services
- Web front-end (APEX / TradeLine 24/7)
- Supabase backend (auth, storage, functions)
- Static assets/CDN

## Objectives
- RTO: 30 minutes for control-plane recovery.
- RPO: 15 minutes for user-facing data.

## Test Flow (Staging)
1. Run dry-run to validate orchestration: `npm run dr:test`.
2. For deeper staging validation, temporarily point environment variables to staging replicas.
3. Simulate failure (app + Supabase), failover to backup config, verify health endpoints.

## Failure Simulation
- Use `scripts/dr/simulate_failure.ts` (staging-safe stub) to represent primary outage.
- Keep production credentials out of tests; use staging tokens only.

## Restore Procedure
1. Execute `scripts/dr/run-dr-test.ts` (without `--dry-run`) in a controlled window.
2. Verify with `scripts/dr/verify_recovery.ts` (health checks and DB connectivity).
3. Confirm dashboards and guardian status are green; record outcome in audit log.

## Evidence & Logging
- DR executions are recorded via `recordAuditEvent` with stage and pass/fail state.
- Keep the latest console output alongside ticket/incident notes.

