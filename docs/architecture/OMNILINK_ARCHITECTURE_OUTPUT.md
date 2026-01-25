# OmniLink Architecture Output: Portability Matrix + SRE Package + Rollback/DR

> **Evidence labeling**: statements are tagged as **VERIFIED** (from repo evidence) or **PROPOSED** (design guidance).

## 1) Portability Matrix (NO LOCK-IN)

| Layer / Capability | Default (portable) | AWS option | GCP option | Azure option | Migration / Exit Plan | Lock-in Score (1=low, 5=high) |
| --- | --- | --- | --- | --- | --- | --- |
| OmniLink Port (client) | **VERIFIED:** `src/integrations/omnilink/port.ts` uses plain HTTP + env flags | **PROPOSED:** API Gateway + Lambda adapter | **PROPOSED:** Cloud Run + API Gateway | **PROPOSED:** Azure Functions + API Mgmt | **PROPOSED:** Swap adapter via `setOmniLinkAdapter(...)`, keep HTTP adapter as fallback | **VERIFIED:** 1 |
| Health Check | **VERIFIED:** UI health page calls `getOmniLinkHealth()` | **PROPOSED:** CloudWatch Synthetics | **PROPOSED:** Cloud Monitoring Uptime | **PROPOSED:** Azure Monitor Availability | **PROPOSED:** Keep `/health` contract stable; health CLI uses `npm run omnilink:health` | **VERIFIED:** 1 |
| Audit Trail | **VERIFIED:** `src/security/auditLog.ts` writes to Supabase audit_logs | **PROPOSED:** DynamoDB + OpenSearch | **PROPOSED:** BigQuery + Cloud Logging | **PROPOSED:** Cosmos DB + Log Analytics | **PROPOSED:** Abstract storage behind `recordAuditEvent` + data export to neutral format | **PROPOSED:** 2 |
| LLM Safety (prompt defense) | **VERIFIED:** `supabase/functions/_shared/promptDefense.ts` | **PROPOSED:** Bedrock Guardrails | **PROPOSED:** Vertex AI Safety | **PROPOSED:** Azure AI Content Safety | **PROPOSED:** Keep rule-based checks provider-agnostic; swap LLM vendor via shared `callLLM` | **PROPOSED:** 2 |

**Notes**
- **VERIFIED:** The port is optional-by-default and provider-agnostic via `OmniLinkAdapter` (`src/integrations/omnilink/types.ts`).
- **PROPOSED:** Cloud options are offered only as plugins behind the same adapter contract.

## 2) SRE Package (Operational Baseline)

### Observability
- **VERIFIED:** Audit events are queued and flushed with retries in `src/security/auditLog.ts`.
- **PROPOSED:** Add log correlation with `trace_id` across port requests and LLM calls.

### Reliability
- **VERIFIED:** OmniLink port enforces timeouts, retries with jitter, circuit breaker, and idempotency (`src/integrations/omnilink/port.ts`).
- **PROPOSED:** Add SLIs/SLOs for OmniLink latency/error rates in monitoring stack of choice.

### On-call Runbook (minimal)
- **VERIFIED:** `/health` UI shows OmniLink status.
- **PROPOSED:** Create a dedicated `/status/omnilink` endpoint in a backend service if required.
- **VERIFIED:** CLI health check: `npm run omnilink:health`.

## 3) Rollback / DR Plan

### Rollback (1–2 minute path)
- **VERIFIED:** Set `VITE_OMNILINK_ENABLED=false` (or unset). This disables OmniLink.
- **VERIFIED:** Confirm `/health` shows OmniLink **disabled**.

### Disaster Recovery (DR) Plan (high level)
- **VERIFIED:** Existing DR runbook lives at `docs/DR_RUNBOOK.md`.
- **PROPOSED:** Ensure OmniLink port health is part of DR validation checklist.
- **PROPOSED:** Add periodic export of audit_logs in portable JSON/CSV for vendor exit.
