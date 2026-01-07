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

### Tables Added

### Verification Results

**PHASE 2 STATUS:**

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