# Chaos Simulation Framework
## Deterministic Chaos Testing for OmniLink-APEX

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Purpose:** Test all 12 APEX apps under realistic chaos conditions

---

## 🚀 Quick Start

```bash
# Set required environment variables
export SIM_MODE=true
export SANDBOX_TENANT=my-test

# Run full chaos simulation
npm run sim:chaos

# View results
cat evidence/latest/scorecard.json
```

---

## 📁 Directory Structure

```
sim/
├── cli.ts                    # Main CLI entry point
├── runner.ts                 # Simulation orchestration
├── contracts.ts              # Event contracts for all 12 apps
├── guard-rails.ts            # Production protection
├── chaos-engine.ts           # Deterministic chaos injection
├── idempotency.ts            # Deduplication engine
├── circuit-breaker.ts        # Failure isolation
├── metrics.ts                # Performance tracking
├── evidence.ts               # Evidence bundler
├── index.ts                  # Main exports
├── README.md                 # This file
├── adapters/                 # App-specific adapters
└── tests/                    # Unit tests
    ├── guard-rails.test.ts
    ├── idempotency.test.ts
    └── chaos-engine.test.ts
```

---

## 🎯 What It Does

This framework simulates a **chaotic, non-technical client** (Sarah Martinez) having a terrible day where everything goes wrong:

- 📞 **13 story beats** across all 12 APEX apps
- 🎲 **Deterministic chaos:** Duplicates, delays, timeouts, failures
- 🛡️ **Autonomous isolation:** Circuit breakers + idempotency
- 📊 **Performance metrics:** Latency, throughput, errors
- 🏆 **Scorecard:** Pass/fail criteria

**Key Feature:** Same seed → identical results (reproducible testing)

---

## 🧪 Test Modes

| Command | Description | Duration | Use Case |
|---------|-------------|----------|----------|
| `npm run sim:chaos` | Full chaos (default) | 30-60s | Integration testing |
| `npm run sim:dry` | Dry run (no API calls) | 5-10s | CI/CD pipelines |
| `npm run sim:quick` | Minimal smoke test | 1-2s | Rapid iteration |
| `npm run sim:burst` | Load testing | 60-120s | Performance testing |
| `npm run test:sim` | Unit tests | 5s | Development |

---

## 🛡️ Safety Guarantees

**Guard rails BLOCK if:**
- ❌ `SIM_MODE` not set to `true`
- ❌ `SANDBOX_TENANT` not set
- ❌ Production URLs detected
- ❌ Missing sandbox indicators

**Result:** Cannot accidentally run against production.

---

## 📊 Success Criteria

### Overall Pass: Score ≥ 70/100

**App Scores (per app):**
- Success rate ≥ 95% (40 points)
- p95 latency < 500ms (30 points)
- Retry rate < 20% (15 points)
- Events processed > 0 (15 points)

**System Score:**
- p95 latency < 500ms ✅
- Error rate < 10% ✅
- Retry rate < 30% ✅
- Idempotency working ✅

---

## 🔧 Programmatic Usage

```typescript
import { runSimulation, DEFAULT_CHAOS_CONFIG } from './sim';

const result = await runSimulation({
  scenario: 'My Test',
  tenantId: 'sandbox-test',
  seed: 42,
  chaos: DEFAULT_CHAOS_CONFIG,
  beats: [...],
  dryRun: true,
});

console.log(`Score: ${result.scorecard.overallScore}/100`);
console.log(`Passed: ${result.passed}`);
```

---

## 📚 Documentation

- [RUNBOOK.md](../docs/sim/RUNBOOK.md) - How to run
- [ARCHITECTURE.md](../docs/sim/ARCHITECTURE.md) - System design
- [CHAOTIC_CLIENT_STORY.md](../docs/sim/CHAOTIC_CLIENT_STORY.md) - Full narrative
- [INVENTORY.md](../docs/sim/INVENTORY.md) - App inventory

---

## 🎓 Key Concepts

### 1. Determinism
Same seed = same chaos decisions = same results (reproducible)

### 2. Idempotency
Duplicate events → cached response (no duplicate side effects)

### 3. Circuit Breakers
Failures isolated → fast-fail → queue → recover

### 4. Chaos Injection
- 15% duplicates
- 10% out-of-order
- 5% timeouts
- 3% network failures
- Partial outages

---

## 🏗️ Architecture Highlights

```
Guard Rails → Chaos Engine → Idempotency → Circuit Breaker → App Adapter
     ↓             ↓              ↓              ↓              ↓
  [SAFE]      [SEEDED RNG]   [DEDUPE]      [ISOLATE]      [EXECUTE]
```

**Evidence Bundle:**
```
evidence/<runId>/
├── scorecard.json    # Final results
├── result.json       # Full output
├── logs.txt          # Execution logs
└── manifest.json     # Metadata
```

---

## 🔬 Development

```bash
# Run tests
npm run test:sim

# Validate environment
npm run sim:validate

# Clean evidence
npm run sim:clean

# Generate HTML report
npm run sim:report
```

---

## 🎯 Integration with CI/CD

```yaml
- name: Chaos Simulation
  env:
    SIM_MODE: 'true'
    SANDBOX_TENANT: 'ci-test'
  run: npm run sim:dry

- name: Check Results
  run: |
    SCORE=$(jq -r '.overallScore' evidence/latest/scorecard.json)
    if (( $(echo "$SCORE < 70" | bc -l) )); then
      exit 1
    fi
```

---

## 🚨 Troubleshooting

**Error: Guard Rail Violation**
```bash
export SIM_MODE=true
export SANDBOX_TENANT=test-$(date +%s)
```

**Error: Production URL detected**
```bash
export SUPABASE_URL=http://localhost:54321
```

**Simulation too slow**
```bash
npm run sim:dry  # 10x faster (no real calls)
```

---

## 📈 Performance

| Metric | Target | Typical |
|--------|--------|---------|
| Full simulation | <60s | 30-45s |
| Dry run | <10s | 5-8s |
| Quick test | <2s | 1s |
| Memory usage | <500MB | 200MB |

---

**Questions?** See docs/sim/RUNBOOK.md or file an issue.

**Status:** ✅ **COMPLETE & PRODUCTION READY**
