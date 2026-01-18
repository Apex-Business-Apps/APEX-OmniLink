# APEX Ecosystem Status
**Updated:** January 18, 2026 03:49 MST

- **Guardian Heartbeats**: `src/guardian/heartbeat.ts`, loops started via `initializeSecurity`, status CLI `npm run guardian:status`.
- **Prompt Defense**: Config in `src/security/promptDefenseConfig.ts`, evaluation in `src/security/promptDefense.ts`, analysis script under `scripts/prompt-defense`, tests in `tests/prompt-defense`.
- **DR/Backup**: Runbook `docs/DR_RUNBOOK.md`, scripts under `scripts/dr/*`, backup verification in `scripts/backup/verify_backup.ts` with doc `docs/BACKUP_VERIFICATION.md`.
- **Security Advisories**: `SECURITY_ADVISORIES.md`, audit script `npm run security:audit`, dependency policy `docs/dependency-scanning.md`.
- **Compliance**: GDPR (`docs/GDPR_COMPLIANCE.md`), SOC2 (`docs/SOC2_READINESS.md`), audit log helper `src/security/auditLog.ts`.
- **Zero-Trust**: Baseline metrics `src/zero-trust/baseline.ts` + CLI, registry `src/zero-trust/deviceRegistry.ts`, docs `docs/zero-trust-baseline.md` and `docs/device-registry.md`.
- **Remaining TODOs**: Move audit log + device registry to persistent storage; wire guardian status into backend health endpoint; align dependency scan workflow in CI.

