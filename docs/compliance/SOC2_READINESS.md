# SOC2 Readiness

## Controls Mapping
- **Availability**: DR runbook (`docs/DR_RUNBOOK.md`), DR scripts under `scripts/dr/*`.
- **Integrity**: Backup verification (`docs/BACKUP_VERIFICATION.md`, `scripts/backup/verify_backup.ts`).
- **Security**: Prompt defense config/tests, guardian heartbeats, dependency scanning policy.
- **Confidentiality**: Device registry + zero-trust baseline, audit logs for sensitive actions.
- **Privacy**: GDPR practices (`docs/GDPR_COMPLIANCE.md`).

## Evidence Pointers
- Audit logs: `src/security/auditLog.ts` (hooked into auth + DR flows).
- Dependency scanning: `SECURITY_ADVISORIES.md`, `docs/dependency-scanning.md`.
- Zero-trust: `src/zero-trust/*`, `docs/zero-trust-baseline.md`, `docs/device-registry.md`.

## Next Steps
- Add automated control attestations in CI.
- Expand audit log persistence to durable storage.
- Include third-party risk reviews for sub-processors.

