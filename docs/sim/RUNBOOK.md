# Chaos Simulation RUNBOOK
## How to Run the OmniLink-APEX Chaotic Client Simulation

**Version:** 1.0
**Last Updated:** 2026-01-03
**Target Environment:** Sandbox/Test Only

---

## 🎯 Quick Start

```bash
# 1. Set environment variables
export SIM_MODE=true
export SANDBOX_TENANT=sandbox-test-$(date +%s)

# 2. Run the simulation
npm run sim:chaos

# 3. View results
cat evidence/latest/scorecard.json
```

**That's it!** The simulation is fully self-contained and safe.

---

## 📋 Prerequisites

### Required
- ✅ Node.js 20+ installed
- ✅ Repository cloned
- ✅ Dependencies installed (`npm install`)
- ✅ `SIM_MODE=true` environment variable set
- ✅ `SANDBOX_TENANT` environment variable set

### Optional (for live integration testing)
- Supabase project (sandbox instance)
- `SUPABASE_URL` pointing to sandbox
- `SUPABASE_SERVICE_ROLE_KEY` (sandbox key)

---

## 🛡️ Safety First - Guard Rails

The simulation **WILL NOT RUN** without proper safety configuration.

### Required Environment Variables

```bash
# MUST be set - simulation will hard-fail without these
export SIM_MODE=true                    # Enable simulation mode
export SANDBOX_TENANT=my-test-tenant    # Sandbox tenant ID

# Optional - for live Supabase integration
export SUPABASE_URL=http://localhost:54321        # Local/sandbox only
export SUPABASE_SERVICE_ROLE_KEY=sandbox-key      # Sandbox key only
```

### Production Protection

The guard rails **block** if they detect:
- ❌ `SIM_MODE` not set to `true`
- ❌ `SANDBOX_TENANT` not set
- ❌ Production URLs (`.apex.com`, `prod`, `live`, etc.)
- ❌ Non-localhost Supabase URLs without `sandbox` in name

**Example of blocked URL:**
```
https://prod.supabase.co/...    ❌ BLOCKED
https://api.apex.com/...        ❌ BLOCKED
https://www.apexbiz.io/...      ❌ BLOCKED
```

**Example of allowed URLs:**
```
http://localhost:54321          ✅ ALLOWED
http://127.0.0.1:3000           ✅ ALLOWED
https://sandbox.supabase.co     ✅ ALLOWED
https://dev.apex.test           ✅ ALLOWED
```

---

## 🚀 Running Simulations

### Mode 1: Full Chaos (Default)

Run the complete chaotic client story with all 13 beats.

```bash
npm run sim:chaos
```

**What it does:**
- Executes all 13 beats from "Sarah's Terrible Day" story
- Injects 15% duplicates, 10% delays, 5% timeouts, etc.
- Tests all 12 APEX apps
- Generates scorecard + evidence bundle
- Takes ~30-60 seconds

**Output:**
```
evidence/
└── <runId>/
    ├── scorecard.json     # Final results
    ├── events.jsonl       # All events
    ├── receipts.jsonl     # Idempotency receipts
    ├── metrics.json       # Latency stats
    └── circuits.json      # Circuit breaker states
```

---

### Mode 2: Dry Run (No Live Calls)

Test the simulation logic without making real API calls.

```bash
npm run sim:dry
```

**What it does:**
- Same beats, same chaos
- All API calls mocked
- Fast execution (~5-10 seconds)
- Perfect for CI/CD

**Use cases:**
- CI/CD pipeline testing
- Local development
- Testing chaos engine changes
- Verifying idempotency logic

---

### Mode 3: Burst Mode (Load Testing)

Simulate high load with concurrent scenarios.

```bash
npm run sim:burst -- --rate 50 --duration 60 --seed 1337
```

**Parameters:**
- `--rate`: Events per second (default: 50)
- `--duration`: Test duration in seconds (default: 60)
- `--seed`: Random seed for reproducibility (default: random)

**What it does:**
- Spawns multiple concurrent simulations
- Tests system under load
- Measures throughput + latency under stress
- Takes ~60-120 seconds

**Use cases:**
- Performance testing
- Stress testing
- Capacity planning
- SLA validation

---

### Mode 4: Quick Test (Minimal)

Single-beat smoke test for rapid iteration.

```bash
npm run sim:quick
```

**What it does:**
- 1 beat only
- Minimal chaos (5% rates)
- Dry run mode
- Takes ~1 second

**Use cases:**
- Rapid development cycles
- Testing single feature changes
- CI pre-commit hooks

---

### Mode 5: Custom Scenario

Run a custom scenario from a JSON file.

```bash
npm run sim:custom -- --scenario scenarios/my-test.json
```

**Scenario file format:**
```json
{
  "scenario": "My Custom Test",
  "tenant_id": "custom-tenant",
  "seed": 42,
  "chaos": {
    "duplicateRate": 0.20,
    "outOfOrderRate": 0.15
  },
  "beats": [
    {
      "number": 1,
      "name": "My Test Beat",
      "app": "tradeline247",
      "eventType": "tradeline247:call.received",
      "payload": {...},
      "expectedOutcome": "Call logged",
      "observability": "Check logs"
    }
  ]
}
```

---

## 📊 Understanding Results

### Scorecard Format

```json
{
  "runId": "uuid-here",
  "scenario": "Sarah's Terrible Day",
  "tenant": "sandbox-test",
  "seed": 42,
  "timestamp": "2026-01-03T...",
  "duration": 45000,
  "overallScore": 87.5,
  "passed": true,
  "apps": {
    "tradeline247": {
      "score": 92.0,
      "eventsProcessed": 2,
      "successRate": 1.0,
      "avgLatencyMs": 120,
      "passed": true,
      "issues": []
    }
  },
  "system": {
    "score": 85.0,
    "latency": true,
    "errors": true,
    "resilience": true,
    "idempotency": true,
    "passed": true
  },
  "issues": [],
  "warnings": ["High retry rate on TRU Talk"]
}
```

### Pass/Fail Criteria

**Overall Pass:** Score ≥ 70/100 AND system.passed = true

**App Pass:** Score ≥ 70/100
- Success rate ≥ 95% (40 points)
- p95 latency < 500ms (30 points)
- Retry rate < 20% (15 points)
- Events processed > 0 (15 points)

**System Pass:** ALL must be true
- p95 latency < 500ms
- Error rate < 10%
- Retry rate < 30%
- Idempotency working

---

## 🔧 Configuration

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SIM_MODE` | ✅ YES | - | Must be `"true"` |
| `SANDBOX_TENANT` | ✅ YES | - | Sandbox tenant ID |
| `SUPABASE_URL` | ⚠️ Optional | `http://localhost:54321` | Sandbox Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Optional | - | Sandbox service key |
| `SIM_VERBOSE` | ❌ No | `true` | Enable verbose logging |
| `SIM_SEED` | ❌ No | `42` | Random seed (for replay) |

### Chaos Configuration Presets

**Light Chaos** (5% rates):
```bash
npm run sim:chaos -- --chaos light
```

**Default Chaos** (15% duplicates, 10% delays):
```bash
npm run sim:chaos  # No flag needed
```

**Heavy Chaos** (30% duplicates, 25% delays):
```bash
npm run sim:chaos -- --chaos heavy
```

**No Chaos** (deterministic baseline):
```bash
npm run sim:chaos -- --chaos none
```

---

## 🔄 Replaying Simulations

### Deterministic Replay

Same seed = same results (every time).

```bash
# Run 1
npm run sim:chaos -- --seed 1234
# Results: 5 duplicates, 3 timeouts, score 85.2

# Run 2 (exact same)
npm run sim:chaos -- --seed 1234
# Results: 5 duplicates, 3 timeouts, score 85.2  ✅ IDENTICAL
```

**Use cases:**
- Debugging specific failures
- Regression testing
- Validating fixes
- Audit trails

### Replay from Evidence

```bash
npm run sim:replay -- --evidence evidence/<runId>/
```

Re-executes from saved event log (for investigation).

---

## 🧪 Integration with CI/CD

### GitHub Actions Example

```yaml
name: Chaos Simulation

on:
  pull_request:
  schedule:
    - cron: '0 2 * * *'  # Nightly

jobs:
  simulate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install deps
        run: npm ci

      - name: Run simulation
        env:
          SIM_MODE: 'true'
          SANDBOX_TENANT: 'ci-test'
        run: npm run sim:dry  # Dry run for CI

      - name: Upload evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: chaos-evidence
          path: evidence/

      - name: Check results
        run: |
          SCORE=$(jq -r '.overallScore' evidence/latest/scorecard.json)
          if (( $(echo "$SCORE < 70" | bc -l) )); then
            echo "❌ Simulation failed with score $SCORE"
            exit 1
          fi
          echo "✅ Simulation passed with score $SCORE"
```

---

## 🐛 Troubleshooting

### Error: "Guard Rail Violation - SIM_MODE not set"

```
❌ The chaos simulation cannot run due to safety violations:
   • SIM_MODE environment variable is not set
```

**Fix:**
```bash
export SIM_MODE=true
export SANDBOX_TENANT=test-$(date +%s)
npm run sim:chaos
```

---

### Error: "Production URL detected"

```
❌ Guard Rail Violation:
   • Production URL detected: https://prod.supabase.co
```

**Fix:**
Change to sandbox URL:
```bash
export SUPABASE_URL=http://localhost:54321
# OR
export SUPABASE_URL=https://sandbox.supabase.co
```

---

### Error: "Circuit breaker open"

```
Circuit is OPEN for circuit:trutalk
```

**This is expected!** The simulation intentionally triggers outages.

Check scorecard:
```bash
jq '.system.resilience' evidence/latest/scorecard.json
# Should be: true (system recovered)
```

---

### Simulation runs too slow

**Local development:**
```bash
npm run sim:dry  # Use dry run (10x faster)
```

**CI/CD:**
```bash
npm run sim:quick  # Minimal test (1 beat)
```

**Production-like:**
```bash
npm run sim:chaos -- --beats 5  # Limit beats
```

---

## 📖 Reference Commands

```bash
# Standard runs
npm run sim:chaos         # Full chaos simulation
npm run sim:dry           # Dry run (CI-safe)
npm run sim:quick         # Quick smoke test
npm run sim:burst         # Load test

# Custom runs
npm run sim:chaos -- --seed 1234              # Fixed seed
npm run sim:chaos -- --chaos heavy            # Heavy chaos
npm run sim:chaos -- --beats 5                # Limit beats
npm run sim:custom -- --scenario path.json    # Custom scenario

# Utilities
npm run sim:report        # Generate HTML report
npm run sim:clean         # Clean evidence folder
npm run sim:validate      # Validate environment
```

---

## 📚 See Also

- [CHAOTIC_CLIENT_STORY.md](./CHAOTIC_CLIENT_STORY.md) - Full narrative
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [INVENTORY.md](./INVENTORY.md) - App inventory
- [RESULTS_REPORT.md](./RESULTS_REPORT.md) - Sample results

---

**Questions?** Check `sim/README.md` or file an issue.
