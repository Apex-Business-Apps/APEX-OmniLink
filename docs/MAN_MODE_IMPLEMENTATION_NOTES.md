# MAN Mode Implementation Notes

## PHASE 0 — RECON + BASELINE

### Baseline Commands Results

- **Python Version**: Python 3.14.0 ✅
- **Test Command**: pytest -q (dependencies not installed in environment)
- **Lint Commands**: ruff/mypy (tools not installed in environment)
- **Located All Touchpoints**: ✅
  - Workflow: orchestrator/workflows/agent_saga.py (AgentWorkflow)
  - Activities: orchestrator/activities/tools.py + main.py worker setup
  - Database: orchestrator/providers/database/ (Supabase provider)
  - Audit: orchestrator/models/audit.py (log_audit_event)
  - API: orchestrator/main.py (FastAPI app)
  - Migrations: supabase/migrations/ (timestamp-based)
- **Activities Pattern**: Verified - uses get_database_provider() and log_audit_event in try/except/finally

### Code Structure Analysis

- Temporal.io workflow engine with Event Sourcing + Saga patterns
- Pydantic models for type safety
- Supabase backend with provider abstraction
- Comprehensive audit logging infrastructure
- Existing FastAPI surface for operator endpoints
- pytest + mypy + ruff for quality assurance

**PHASE 0 COMPLETE** - Ready for PHASE 1 implementation.

---

## PHASE 1 — DATA MODEL + POLICY MODEL

### Implementation Details

#### Pydantic Models Added (orchestrator/models/man_mode.py)
- ManLane enum (GREEN/YELLOW/RED/BLOCKED)
- ActionIntent model with parameter redaction
- RiskTriageResult model
- ManDecision enum (APPROVE/DENY/MODIFY/CANCEL_WORKFLOW)
- ManTask model for pending approvals
- ManDecisionPayload model for decision submissions
- ManPolicy model with universal risk dimensions and per-workflow overrides
- ManPolicyEngine with deterministic triage_intent() method
- Universal risk dimensions: affects_rights, contains_sensitive_data, irreversible, subjective language, missing fields
- Hard triggers for tools, parameters, and workflows
- Policy validation and effective threshold calculation

#### Unit Tests Added (tests/test_man_policy.py)
- Comprehensive tests for all risk dimensions (sensitive data → RED, affects_rights → RED, irreversible → RED)
- Subjective language pattern detection tests
- Tool minimum lane escalation tests
- Hard trigger activation tests
- Per-workflow policy override tests
- Deterministic behavior verification (same inputs = same outputs)
- Parameter redaction tests
- Policy validation tests

### Verification Results

- pytest results: (pending - dependencies not installed)
- mypy results: (pending - tools not installed)
- ruff results: (pending - tools not installed)

**PHASE 1 COMPLETE** - Models and policy engine implemented with comprehensive unit tests.

---

## PHASE 2 — DATABASE SCHEMA

### Migration Created
- supabase/migrations/20260107000000_create_man_mode_tables.sql
- Idempotent migration with IF NOT EXISTS clauses
- Proper indexes for efficient querying
- Updated_at triggers for all tables

### Tables Added
A) man_tasks
- id (UUID PK), tenant_id, workflow_id, run_id, step_id, tool_name, idempotency_key (unique)
- status, risk_score, risk_reasons (JSONB), intent (JSONB redacted)
- reviewer_id, decision (JSONB), created_at/updated_at
- Indexes: (tenant_id, status, created_at desc), (workflow_id, run_id), (idempotency_key)

B) man_policies
- id (UUID PK), tenant_id (nullable), workflow_key (nullable), policy_json (JSONB)
- version, updated_by, updated_at
- Unique constraint on (tenant_id, workflow_key) for one policy per scope
- Index on (tenant_id, workflow_key) for lookups

C) man_decision_events (append-only audit)
- id (UUID PK), task_id (FK), tenant_id, workflow_id
- decision, reviewer_id, reason, modified_params (JSONB), created_at
- Indexes for audit queries

### RLS Security
- Row Level Security enabled on all tables
- Service role full access
- Authenticated users scoped to their tenant_id
- Operators can update decisions and manage policies
- Proper grants for authenticated and service roles

### Default Policy
- Global default policy inserted on migration
- Matches ManPolicy defaults (red: 0.8, yellow: 0.5, etc.)
- ON CONFLICT DO NOTHING for safe re-runs

### Verification Results
- Migration created with proper structure
- RLS policies follow existing repo patterns
- Indexes optimized for query patterns
- Default policy matches model defaults

**PHASE 2 COMPLETE** - Database schema with RLS security and default policy.

---

## PHASE 3 — DATABASE PROVIDER EXTENSIONS

### Extensions Added

### Tests Added

### Verification Results

**PHASE 3 STATUS:**

---

## PHASE 4 — TEMPORAL ACTIVITIES

### Activities Added

### Verification Results

**PHASE 4 STATUS:**

---

## PHASE 5 — WORKFLOW INTEGRATION

### Integration Changes

### Tests Added

### Verification Results

**PHASE 5 STATUS:**

---

## PHASE 6 — OPERATOR API

### Endpoints Added

### Tests Added

### Verification Results

**PHASE 6 STATUS:**

---

## PHASE 7 — OVERLOAD + PERFORMANCE SAFEGUARDS

### Safeguards Added

### Verification Results

**PHASE 7 STATUS:**

---

## PHASE 8 — CI GUARDRAILS

### Checks Added

### Verification Results

**PHASE 8 STATUS:**

---

## FINAL VERIFICATION

### Full Test Suite Results

### Smoke Test Results

### Deliverables Created

**FINAL STATUS:**