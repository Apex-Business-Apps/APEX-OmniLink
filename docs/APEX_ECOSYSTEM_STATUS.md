# APEX Ecosystem Status

**Last Updated:** 2026-01-23

## Core Systems

- **Guardian Heartbeats**: `src/guardian/heartbeat.ts`, loops started via `initializeSecurity`, status CLI `npm run guardian:status`.
- **Prompt Defense**: Config in `src/security/promptDefenseConfig.ts`, evaluation in `src/security/promptDefense.ts`, analysis script under `scripts/prompt-defense`, tests in `tests/prompt-defense`.
- **DR/Backup**: Runbook `docs/DR_RUNBOOK.md`, scripts under `scripts/dr/*`, backup verification in `scripts/backup/verify_backup.ts` with doc `docs/BACKUP_VERIFICATION.md`.
- **Security Advisories**: `SECURITY_ADVISORIES.md`, audit script `npm run security:audit`, dependency policy `docs/dependency-scanning.md`.
- **Compliance**: GDPR (`docs/GDPR_COMPLIANCE.md`), SOC2 (`docs/SOC2_READINESS.md`), audit log helper `src/security/auditLog.ts`.
- **Zero-Trust**: Baseline metrics `src/zero-trust/baseline.ts` + CLI, registry `src/zero-trust/deviceRegistry.ts`, docs `docs/zero-trust-baseline.md` and `docs/device-registry.md`.

## OmniPort Ingress Engine (NEW)

The proprietary fortified ingress gateway for all input sources.

| Component | Location | Status |
|-----------|----------|--------|
| **Engine** | `src/omniconnect/ingress/OmniPort.ts` | ✅ Production Ready |
| **Types** | `src/omniconnect/types/ingress.ts` | ✅ Zod-validated |
| **Metrics** | `src/omniconnect/ingress/omniport-metrics.ts` | ✅ OmniDash Integration |
| **Voice** | `src/omniconnect/ingress/omniport-voice.ts` | ✅ Natural Language |
| **DLQ** | `supabase/migrations/20260124000000_omniport_dlq.sql` | ✅ Risk-prioritized |
| **Tests** | `tests/omniconnect/omniport.spec.ts` | ✅ 27/27 Passing |

**Features:**
- Zero-Trust Gate with device validation (trusted/suspect/blocked)
- MAN Mode governance for high-risk intents (`delete`, `transfer`, `grant_access`)
- Idempotent execution with FNV-1a hashing (browser + Node.js compatible)
- Circuit breaker with Dead Letter Queue fallback
- Real-time metrics (latency, throughput, P95) for OmniDash dashboards
- Voice command processing with wake word detection

**Usage:**
```typescript
import { ingest, processVoiceCommand, getOmniPortMetrics } from '@/omniconnect/ingress';

// Text/Webhook ingestion
const result = await ingest({ type: 'text', content: 'Hello', source: 'web', userId: 'uuid' });

// Voice command
const voiceResult = await processVoiceCommand(transcript, confidence, audioUrl, durationMs, userId);

// Metrics for OmniDash
const metrics = getOmniPortMetrics(60000);
```

## Remaining TODOs

- Move audit log + device registry to persistent storage
- Wire guardian status into backend health endpoint
- Align dependency scan workflow in CI
- Add OmniPort metrics dashboard to OmniDash UI

