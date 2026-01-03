# Chaos Simulation Results Report
## Template for Test Execution

**Run ID:** `<generated-at-runtime>`
**Scenario:** `<scenario-name>`
**Date:** `<timestamp>`
**Tenant:** `<sandbox-tenant>`
**Seed:** `<random-seed>`

---

## Executive Summary

**Overall Score:** `X.X/100` ✅/❌
**Status:** PASSED / FAILED
**Duration:** `XX.XXs`
**Beats Executed:** `X/X`

### Key Findings
- ✅ Success highlight 1
- ✅ Success highlight 2
- ⚠️ Warning/Issue 1
- ⚠️ Warning/Issue 2

---

## System Performance

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **p95 Latency** | <500ms | XXXms | ✅/❌ |
| **Error Rate** | <10% | X.X% | ✅/❌ |
| **Retry Rate** | <30% | X.X% | ✅/❌ |
| **Dedupe Rate** | >0% | X.X% | ✅/❌ |

---

## App-by-App Results

### TradeLine 24/7
- **Score:** `XX.X/100`
- **Events Processed:** `X`
- **Success Rate:** `XX.X%`
- **Avg Latency:** `XXXms`
- **Status:** ✅ PASS / ❌ FAIL
- **Issues:** `none / list issues`

### AutoRepAi
- **Score:** `XX.X/100`
- **Events Processed:** `X`
- **Success Rate:** `XX.X%`
- **Avg Latency:** `XXXms`
- **Status:** ✅ PASS / ❌ FAIL

### FLOWBills
- **Score:** `XX.X/100`
- **Events Processed:** `X`
- **Success Rate:** `XX.X%`
- **Avg Latency:** `XXXms`
- **Status:** ✅ PASS / ❌ FAIL

### FlowC (Silent Compliance)
- **Score:** `XX.X/100`
- **Events Processed:** `X`
- **Success Rate:** `XX.X%`
- **Avg Latency:** `XXXms`
- **Status:** ✅ PASS / ❌ FAIL

### Jubee.Love
- **Score:** `XX.X/100`
- **Events Processed:** `X`
- **Success Rate:** `XX.X%`
- **Avg Latency:** `XXXms`
- **Status:** ✅ PASS / ❌ FAIL

### KeepSafe
- **Score:** `XX.X/100`
- **Events Processed:** `X`
- **Success Rate:** `XX.X%`
- **Avg Latency:** `XXXms`
- **Status:** ✅ PASS / ❌ FAIL

### OmniHub (Dashboard)
- **Score:** `XX.X/100`
- **Events Processed:** `X`
- **Success Rate:** `XX.X%`
- **Avg Latency:** `XXXms`
- **Status:** ✅ PASS / ❌ FAIL

*(Stubbed apps: aSpiral, TRU Talk, Bright Beginnings, CareConnect - tested with mock adapters)*

---

## Chaos Engineering Results

### Chaos Injection Statistics

| Chaos Type | Configured Rate | Actual Rate | Count |
|------------|----------------|-------------|-------|
| **Duplicates** | 15% | `XX.X%` | `XX` |
| **Delays** | 10% | `XX.X%` | `XX` |
| **Timeouts** | 5% | `XX.X%` | `XX` |
| **Network Failures** | 3% | `XX.X%` | `XX` |
| **Server Errors** | 2% | `XX.X%` | `XX` |

### Resilience Validation

✅ **Idempotency:** `X` duplicate events deduplicated successfully
✅ **Circuit Breakers:** Opened `X` times, recovered `X` times
✅ **Retries:** `X` successful retries out of `X` attempts
✅ **Out-of-Order:** `X` delayed events processed correctly

---

## Critical Test Cases

### Test 1: Payment Idempotency (Beat 12)
**Scenario:** Duplicate payment event injected
**Expected:** Payment processed once only
**Actual:** ✅ Deduplicated successfully / ❌ FAILED
**Evidence:** `idempotency_receipts` table shows single payment

### Test 2: Partial Outage Recovery (Beats 7-10)
**Scenario:** TRU Talk service down for 3 beats
**Expected:** Circuit breaker opens, queues events, recovers
**Actual:** ✅ Circuit breaker worked / ❌ FAILED
**Evidence:** Circuit state transitions: CLOSED → OPEN → HALF_OPEN → CLOSED

### Test 3: Retry Success (Beat 2, 5, 13)
**Scenario:** Network failures, should retry and succeed
**Expected:** All retries successful within 2 attempts
**Actual:** ✅ All succeeded / ❌ Some failed
**Evidence:** `retry_count` in metrics

---

## Latency Analysis

### p50/p95/p99 Breakdown

```
Operation               p50     p95     p99     Max
tradeline247:*         XXXms   XXXms   XXXms   XXXms
autorepai:*            XXXms   XXXms   XXXms   XXXms
flowbills:*            XXXms   XXXms   XXXms   XXXms
flowc:*                XXXms   XXXms   XXXms   XXXms
keepsafe:*             XXXms   XXXms   XXXms   XXXms
omnihub:*              XXXms   XXXms   XXXms   XXXms
```

### Latency Distribution
- <100ms: `XX%`
- 100-200ms: `XX%`
- 200-500ms: `XX%`
- >500ms: `XX%` ⚠️

---

## Issues & Warnings

### Critical Issues (Must Fix)
1. `Issue description` - Impact: `description`
2. `Issue description` - Impact: `description`

### Warnings (Should Fix)
1. `Warning description` - Recommendation: `action`
2. `Warning description` - Recommendation: `action`

### Informational
1. `Info item`
2. `Info item`

---

## Evidence Bundle

**Location:** `evidence/<runId>/`

**Contents:**
- ✅ `scorecard.json` - Final scorecard
- ✅ `result.json` - Complete results
- ✅ `logs.txt` - Execution logs
- ✅ `manifest.json` - Bundle metadata

**Commands:**
```bash
# View scorecard
cat evidence/<runId>/scorecard.json | jq

# Generate HTML report
npm run sim:report

# View full logs
less evidence/<runId>/logs.txt
```

---

## Reproducibility

**Seed Used:** `XX`

**To reproduce this exact run:**
```bash
export SIM_MODE=true
export SANDBOX_TENANT=<tenant>
npm run sim:chaos -- --seed XX
```

**Expected:** Identical chaos decisions and results

---

## Next Steps

### If PASSED ✅
1. ✅ Mark test run as successful
2. ✅ Archive evidence bundle
3. ✅ Proceed to next phase

### If FAILED ❌
1. ⚠️ Review issues in detail
2. ⚠️ Fix identified problems
3. ⚠️ Re-run simulation with same seed
4. ⚠️ Verify fixes resolved issues

---

## Comparison to Previous Runs

| Run ID | Date | Score | Status | Notes |
|--------|------|-------|--------|-------|
| `<runId-1>` | YYYY-MM-DD | XX.X | ✅ | Baseline |
| `<runId-2>` | YYYY-MM-DD | XX.X | ❌ | Issue X |
| `<this-run>` | YYYY-MM-DD | XX.X | ✅/❌ | Current |

**Trend:** Score improving / declining / stable

---

## Appendix

### Environment Configuration
```
SIM_MODE=true
SANDBOX_TENANT=<tenant>
SUPABASE_URL=<url>
NODE_VERSION=20.x
CHAOS_CONFIG=default
```

### Test Scope
- ✅ All 12 APEX apps tested
- ✅ Idempotency validated
- ✅ Circuit breakers validated
- ✅ Retry logic validated
- ✅ Out-of-order handling validated
- ✅ Performance within SLAs

### Known Limitations
- Stubbed apps (aSpiral, TRU Talk, Bright, CareConnect) use mock adapters
- Dry run mode mocks all external calls
- In-memory stores (not persisted to DB)

---

**Report Generated:** `<timestamp>`
**Report Version:** 1.0
**Framework Version:** 1.0.0

---

**Status:** ✅ COMPLETE
