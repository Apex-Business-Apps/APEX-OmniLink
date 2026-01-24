# APEX / OmniHub — Technical Specification & Architecture

## Overview
- Frontend: React 18 + Vite + TypeScript + Tailwind (utility classes), shadcn UI.
- Routing: `react-router-dom` with guarded dashboard routes.
- Backend: Supabase (auth, storage, functions) accessed via `@supabase/supabase-js`.
- State/Queries: React Query for caching/resilience.
- Observability: Local monitoring hooks, guardian heartbeats, audit logging, DR/backup tooling.

## Key Modules
- **OmniDash v2 Navigation UI**: Revolutionary icon-based navigation (`src/components/OmniDashNavIconButton.tsx`, `src/pages/OmniDash/OmniDashLayout.tsx`) with zero-overlap flexbox layout, mobile bottom tabs, and tooltip integration.
- **OmniPort Ingress Engine**: Proprietary fortified ingress gateway (`src/omniconnect/ingress/`) with Zero-Trust gate, idempotency, MAN Mode governance, and circuit breaker. Supports text, voice, and webhook inputs. See dedicated section below.
- Auth/session: `src/contexts/AuthContext.tsx` (supabase session, device registration, audit logging on login/logout).
- Guardian heartbeats: `src/guardian/heartbeat.ts`, loops in `src/guardian/loops.ts`, CLI `npm run guardian:status`.
- Prompt defense: Config `src/security/promptDefenseConfig.ts`, evaluator `src/security/promptDefense.ts`, tests `tests/prompt-defense`.
- Audit logging: `src/security/auditLog.ts` (in-memory, extensible to persistent store), wired into auth and DR flows.
- Zero-trust: Baseline metrics `src/zero-trust/baseline.ts`, device registry `src/zero-trust/deviceRegistry.ts`, CLI `npm run zero-trust:baseline`.
- DR/Backup: Scripts under `scripts/dr/*` and `scripts/backup/verify_backup.ts`; runbook `docs/DR_RUNBOOK.md`, verification doc `docs/BACKUP_VERIFICATION.md`.
- Dependency & security: `SECURITY_ADVISORIES.md`, `docs/dependency-scanning.md`, script `npm run security:audit`.

## Temporal Orchestrator (Python Backend)

The `orchestrator/` directory contains a Temporal.io-based workflow orchestration system for AI agent task execution.

### Architecture
- **Workflows**: Event-sourced workflows with Saga pattern for compensation (`orchestrator/workflows/agent_saga.py`)
- **Activities**: Stateless, retryable activities for external I/O (`orchestrator/activities/`)
- **Models**: Pydantic-based data models with strict validation (`orchestrator/models/`)
- **Providers**: Database abstraction layer supporting Supabase (`orchestrator/providers/`)

### MAN Mode (Manual Approval Node)
Human-in-the-loop safety gate for high-risk agent actions. When an action is classified as high-risk (RED lane), it is **isolated** (not executed) and sent for human approval. The workflow continues without blocking for efficiency.

**Risk Classification Lanes:**
| Lane | Behavior | Example Tools |
|------|----------|---------------|
| GREEN | Auto-execute | `search_database`, `read_record`, `get_config` |
| YELLOW | Execute with audit logging | Unknown tools, single high-risk param |
| RED | Isolate + notify human (non-blocking) | `delete_record`, `transfer_funds`, `send_email` |
| BLOCKED | Never execute | `execute_sql_raw`, `shell_execute` |

**Key Files:**
- Policy Engine: `orchestrator/policies/man_policy.py` (stateless risk classification)
- Data Models: `orchestrator/models/man_mode.py` (`ActionIntent`, `ManTask`, `RiskTriageResult`)
- Activities: `orchestrator/activities/man_mode.py` (`risk_triage`, `create_man_task`, `resolve_man_task`)
- Workflow Integration: `orchestrator/workflows/agent_saga.py` (non-blocking isolation)
- Database Schema: `supabase/migrations/20260108120000_man_mode.sql` (`man_tasks` table)

**Flow:**
```
Agent Step → risk_triage() → Lane?
   GREEN  → Execute immediately
   YELLOW → Execute with audit log
   RED    → Isolate action → Create MAN task → Notify human → Continue workflow
   BLOCKED → Reject with ApplicationError
```

**Non-blocking Design:** RED lane actions return `{status: "isolated", awaiting_approval: true}` and the workflow proceeds to the next step. Approved actions can be re-executed via a separate workflow or manual trigger.

**Performance:** Policy engine uses cached `frozenset` for O(1) tool lookups. Database schema includes partial indexes and GIN index for JSONB queries. 38 unit tests validate models, policy, and edge cases.

## OmniPort Ingress Engine (TypeScript Frontend/Backend)

The `src/omniconnect/ingress/` directory contains the proprietary ingress fortress for APEX OmniHub—a unified gateway for all input sources (text, voice, webhook) with enterprise-grade security and governance.

### Core Philosophy
1. **Defensive Ingress**: Nothing enters without Identity + Rate Limit validation
2. **Deterministic Execution**: All side effects wrapped in `withIdempotency`
3. **Proprietary Governance**: High-risk intents tagged for MAN Mode approval

### Architecture

**Input Sources (Zod-validated):**
| Source | Schema | Key Fields |
|--------|--------|------------|
| `TextSource` | `src/omniconnect/types/ingress.ts` | `content`, `source` (web/sms), `userId` |
| `VoiceSource` | `src/omniconnect/types/ingress.ts` | `transcript`, `confidence` (0-1), `audioUrl`, `durationMs` |
| `WebhookSource` | `src/omniconnect/types/ingress.ts` | `payload`, `provider`, `signature` |

**Execution Pipeline (Strict Order):**
```
RawInput → Zero-Trust Gate → Idempotency Wrapper → Semantic Normalization → Resilient Dispatch
    ↓           ↓                   ↓                      ↓                      ↓
  Validate   Check Device      Compute Hash         Map to Canonical      Deliver or DLQ
             (blocked/suspect)  (FNV-1a)            + MAN Mode Analysis
```

**Risk Classification (OmniPort-level):**
| Lane | Trigger | Behavior |
|------|---------|----------|
| GREEN | Normal content | Standard processing |
| RED | Suspect device OR high-risk intent (`delete`, `transfer`, `grant_access`) | Flag `requires_man_approval = true` |
| BLOCKED | Device status = `blocked` | Throw `SecurityError`, reject immediately |

**Key Files:**
- Engine: `src/omniconnect/ingress/OmniPort.ts` (singleton with full pipeline)
- Types: `src/omniconnect/types/ingress.ts` (Zod schemas for `RawInput`, `IngestResult`)
- Metrics: `src/omniconnect/ingress/omniport-metrics.ts` (real-time observability for OmniDash)
- Voice: `src/omniconnect/ingress/omniport-voice.ts` (natural language command handler)
- DLQ Schema: `supabase/migrations/20260124000000_omniport_dlq.sql` (`ingress_buffer` table)

**Dead Letter Queue (Circuit Breaker):**
When delivery fails, OmniPort writes to `ingress_buffer` with risk-prioritized replay:
- `risk_score` (0-100): RED lane +50, high-risk intent +30, webhook +10
- `status` enum: `pending`, `replaying`, `failed`
- RLS policies for tenant isolation

**Observability (OmniDash Integration):**
```typescript
import { getOmniPortMetrics, getOmniPortStatus } from '@/omniconnect/ingress';

const metrics = getOmniPortMetrics(60000); // Last 60 seconds
// { totalIngestions, accepted, blocked, buffered, redLaneEvents, avgLatencyMs, p95LatencyMs }

const status = getOmniPortStatus();
// { health: 'healthy'|'degraded'|'critical', eventsPerSecond, dlqDepth, uptimeSeconds }
```

**Performance:** E2E ingestion < 50ms. FNV-1a hash for browser+Node.js compatibility. 27 unit tests covering speed, moat logic, shield, and safety net scenarios.

## Runtime & Ops
- Build: Vite with SWC, terser minification, chunk splitting (`vite.config.ts`), console stripping in production.
- Env: Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Auth provider guards missing env and surfaces setup message.
- Scripts/CLI (idempotent):
  - Tests: `npm test`, `npm run test:prompt-defense`.
  - Security: `npm run security:audit`.
  - Guardian: `npm run guardian:status`.
  - DR: `npm run dr:test` (dry-run default).
  - Zero-trust: `npm run zero-trust:baseline`.
  - Prompt defense analysis: `npm run prompt-defense:analyze -- --input=...`.
- Health: Supabase edge healthcheck function invoked via `runHealthCheck` (used in guardian loop).

## Data & Models
- Supabase models: profiles, health_checks (from edge function), ingress_buffer (DLQ), plus implied tables for app features.
- In-app models:
  - Audit events: `{id, timestamp, actorId, actionType, resourceType, resourceId, metadata}`.
  - Device registry: `{deviceId, userId, firstSeenAt, lastSeenAt, deviceFingerprint, status}`.
  - Guardian heartbeats: `{loopName, lastSeen, ageMs, status}` (in-memory).
  - OmniPort ingress: `RawInput` (text/voice/webhook), `IngestResult` (correlationId, status, riskLane, latencyMs).
  - OmniPort DLQ: `{id, correlation_id, raw_input, error_reason, status, risk_score, created_at}` (Supabase).

## Security & Compliance
- Prompt injection defenses with configurable rules and tests; analysis tooling to measure FP rate.
- CSRF token generation, input sanitization, lockout and suspicious-activity detection (`src/lib/security.ts`).
- Dependency policy (dev vs prod) documented; audit artifacts under `security/`.
- GDPR (`docs/GDPR_COMPLIANCE.md`) and SOC2 readiness (`docs/SOC2_READINESS.md`).
- Zero-trust posture via device registry and behavioral baseline.
- DR/Backup plans and verification scripts, all audit-logged.

## Performance & Reliability
- React Query caching, connection pooling, request cache cleanup loops with heartbeats.
- Vite build optimizations, code-splitting, chunk warnings raised to 1000kb for awareness.
- Idempotent guardians (single start), DR dry-run safe by default.
- Logs trimmed (max lengths) in monitoring/audit helpers to prevent unbounded growth.

## Stress & Threat Handling
- Guardian loops and health pings to detect staleness.
- High-risk prompt keywords blocked; rule-based detection with tests.
- Rate limits in Supabase edge functions; device status tracking to flag suspect devices.
- Audit logging on security-sensitive actions (login/logout, DR tests, backup verification).

## Irrelevant / Non-core Artifacts (keep under review)
- `bun.lockb`: legacy lockfile; npm is the active package manager (see `package-lock.json`).
- `src/App.css`: Vite starter styles currently unused; safe to remove or leave inert.
- Placeholder assets under `public/` and `src/assets/`—verify necessity before pruning.

## Expansion / Next Steps
- Persist audit logs and device registry to Supabase tables with RLS.
- Expose guardian status via backend health endpoint and surface in UI.
- Align CI with `security-scan` workflow; add automated control attestations.
- Extend prompt defense analytics with trend dashboards; add MFA for suspect devices.
- Add synthetic load tests and capture SLOs in monitoring.

