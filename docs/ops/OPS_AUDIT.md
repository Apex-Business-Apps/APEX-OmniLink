# OMNILINK-APEX OPS PACK AUDIT REPORT

**Audit Date:** December 21, 2025
**Auditor:** Principal Architect + SRE
**Mission:** Verify Ops Pack completeness (telemetry + eval + governance + tuning)

## PHASE A — CODEBASE AUDIT RESULTS

### 1. Existing Migrations
**Location:** `supabase/migrations/`

Migration files found:
- `20251003094610_9ce8947e-f3b6-46cc-8bfa-b93d2677bdd9.sql`
- `20251004032712_3d6dc06d-21cd-4fbb-b80d-f4a12307f8d8.sql`
- `20251004072520_8fcd5084-a6fc-4a13-a994-3cb1d7e12125.sql`
- `20251004223440_1b0177ed-f035-453c-b7a2-a3702234d41e.sql`
- `20251004223451_c5a8ff24-a2fd-40df-b1c4-07e61a829bc3.sql`
- `20251218000000_create_audit_logs_table.sql`
- `20251218000001_create_device_registry_table.sql`
- `20251221000000_omnilink_agentic_rag.sql`

**Ops Pack Specific:** `20251221000000_omnilink_agentic_rag.sql` exists but no `*_ops_pack*.sql` files found.

### 2. Existing Tables Expected by Ops Pack

#### Ripgrep Results for Ops Pack Tables:
```
$ rg -n "agent_runs|skill_matches|tool_invocations|eval_cases|eval_results" .
```
**RESULTS:** No matches found

**Expected Tables Status:**
- ❌ `agent_runs` - NOT FOUND
- ❌ `skill_matches` - NOT FOUND
- ❌ `tool_invocations` - NOT FOUND
- ❌ `eval_cases` - NOT FOUND
- ❌ `eval_results` - NOT FOUND

### 3. Existing Edge Functions
**Location:** `supabase/functions/`

Functions found:
- `apex-assistant/index.ts`
- `apex-voice/index.ts`
- `execute-automation/index.ts`
- `lovable-audit/index.ts`
- `lovable-device/index.ts`
- `lovable-healthcheck/index.ts`
- `omnilink-agent/index.ts`
- `storage-upload-url/index.ts`
- `supabase_healthcheck/index.ts`
- `test-integration/index.ts`

**Ops Pack Specific:**
- ✅ `omnilink-agent/index.ts` - EXISTS (core agent)
- ❌ `omnilink-eval/index.ts` - MISSING (evaluation function)

### 4. Existing Docs/Runbooks
**Location:** `docs/`

Documentation files:
- `APEX_ECOSYSTEM_STATUS.md`
- `BACKUP_VERIFICATION.md`
- `dependency-scanning.md`
- `device-registry.md`
- `DR_RUNBOOK.md`
- `GDPR_COMPLIANCE.md`
- `prompt-defense-tuning.md`
- `SOC2_READINESS.md`
- `TECH_SPEC_ARCHITECTURE.md`
- `zero-trust-baseline.md`

**Ops Pack Specific:**
```
$ rg -n "OPS_RUNBOOK|ops pack|telemetry|evaluation|nightly|cron|pg_cron|pg_net|vault" docs/
```
**RESULTS:** No matches found

❌ No OPS_RUNBOOK.md or operational documentation found.

### 5. Existing Telemetry Instrumentation in Agent

**File:** `supabase/functions/omnilink-agent/index.ts`

```
$ rg -n "agent_runs|skill_matches|tool_invocations|eval_cases|eval_results" supabase/functions/omnilink-agent/index.ts
```
**RESULTS:** No matches found

```
$ rg -n "telemetry|metrics|instrumentation|logging|audit" supabase/functions/omnilink-agent/index.ts
```
**RESULTS:** No matches found

❌ **VERDICT:** No telemetry instrumentation found in omnilink-agent.

### 6. Existing Evaluation Scheduler

```
$ rg -n "OPS_RUNBOOK|ops pack|telemetry|evaluation|nightly|cron|pg_cron|pg_net|vault" .
```
**RESULTS:**
- No scheduling infrastructure found
- No pg_cron or pg_net references
- No evaluation scheduler detected

❌ **VERDICT:** No evaluation scheduler or automated eval system.

### 7. HNSW Tuning Knobs

**File:** `supabase/migrations/20251221000000_omnilink_agentic_rag.sql`

```
$ rg -n "hnsw\.ef_search|set_config\('hnsw\.ef_search'" supabase/migrations/20251221000000_omnilink_agentic_rag.sql
```
**RESULTS:** No matches found

❌ **VERDICT:** No HNSW tuning knobs implemented.

### 8. Governance Fields on agent_skills

**File:** `supabase/migrations/20251221000000_omnilink_agentic_rag.sql`

```
$ rg -n "deprecated_at|is_active|tenant_scope|requires_strong_auth|version" supabase/migrations/20251221000000_omnilink_agentic_rag.sql
```
**RESULTS:** No matches found

❌ **VERDICT:** No governance fields on agent_skills table.

## PHASE A VERDICT SUMMARY

### PRESENT ✅
- `omnilink-agent` edge function exists
- Basic agent_skills and agent_checkpoints tables exist
- RAG migration exists

### MISSING ❌
- Telemetry tables (agent_runs, skill_matches, tool_invocations)
- Evaluation tables (eval_cases, eval_results)
- omnilink-eval edge function
- Telemetry instrumentation in agent
- Governance fields on agent_skills
- HNSW tuning parameters
- Evaluation scheduler/cron system
- OPS_RUNBOOK.md documentation

---

## PHASE B — DATABASE STATE AUDIT

**Note:** Local Supabase not verified in this audit. Database state checks would require:
- `supabase db reset` (local development)
- PSQL queries to verify schema matches migrations

**ASSUMPTION:** Database schema matches migration files until proven otherwise.

---

## PHASE C — DECISION MATRIX

| Component | Status | Evidence | Action Required |
|-----------|--------|----------|----------------|
| **Telemetry Tables** | ❌ MISSING | No agent_runs, skill_matches, tool_invocations tables | IMPLEMENT |
| **Governance Fields** | ❌ MISSING | No version, is_active, deprecated_at, tenant_scope, requires_strong_auth on agent_skills | IMPLEMENT |
| **match_skills Tuning** | ❌ MISSING | No hnsw.ef_search support or tuning parameters | IMPLEMENT |
| **omnilink-eval Function** | ❌ MISSING | No omnilink-eval/index.ts | IMPLEMENT |
| **Eval Tables** | ❌ MISSING | No eval_cases, eval_results tables | IMPLEMENT |
| **Scheduled Eval** | ❌ MISSING | No pg_cron/pg_net or alternative scheduler | IMPLEMENT |
| **Agent Instrumentation** | ❌ MISSING | No telemetry writes in omnilink-agent | IMPLEMENT |

## CONCLUSION

**ALL Ops Pack components are MISSING.** Full implementation required.

---

*Audit completed without modifications to codebase.*
*Proceeding to Phase D implementation.*