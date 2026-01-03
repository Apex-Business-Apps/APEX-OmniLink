# Chaos Simulation Architecture
## OmniLink-APEX Integrated System Testing

**Version:** 1.0
**Date:** 2026-01-03

---

## 🎯 System Overview

```mermaid
graph TB
    subgraph "Simulation Framework"
        Runner[Simulation Runner]
        Guards[Guard Rails]
        Chaos[Chaos Engine]
        Idempotency[Idempotency Engine]
        Circuit[Circuit Breakers]
        Metrics[Metrics Collector]
    end

    subgraph "APEX Ecosystem"
        TL[TradeLine 24/7]
        AR[AutoRepAi]
        FB[FLOWBills]
        FC[FlowC]
        AS[aSpiral]
        JL[Jubee.Love]
        TT[TRU Talk]
        KS[KeepSafe]
        BB[Bright Beginnings]
        CC[CareConnect]
        OH[OmniHub]
        OL[OmniLink]
    end

    Runner --> Guards
    Guards --> Chaos
    Chaos --> Idempotency
    Idempotency --> Circuit
    Circuit --> Metrics

    Runner --> TL
    Runner --> AR
    Runner --> FB
    Runner --> FC
    Runner --> AS
    Runner --> JL
    Runner --> TT
    Runner --> KS
    Runner --> BB
    Runner --> CC
    Runner --> OH
    Runner --> OL
```

---

## 🔄 Event Flow Architecture

```mermaid
sequenceDiagram
    participant R as Runner
    participant G as Guard Rails
    participant C as Chaos Engine
    participant I as Idempotency
    participant CB as Circuit Breaker
    participant A as App Adapter
    participant M as Metrics

    R->>G: Check Safety
    G-->>R: ✅ Safe to proceed

    R->>C: Make chaos decision
    C-->>R: Inject 15% duplicate

    R->>I: Check idempotency key
    I-->>R: Not seen before

    R->>CB: Execute through circuit
    CB->>CB: Check state (CLOSED)

    CB->>A: Call app adapter
    A-->>CB: Response

    CB-->>R: Success
    R->>I: Store receipt
    R->>M: Record metrics

    Note over R,M: Duplicate arrives

    R->>I: Check idempotency key
    I-->>R: Already processed! ♻️
    I-->>R: Return cached response
    R->>M: Record dedupe hit
```

---

## 🛡️ Guard Rails Architecture

```mermaid
flowchart TD
    Start([Simulation Start]) --> CheckSIM{SIM_MODE=true?}
    CheckSIM -->|No| BlockSIM[❌ BLOCK: SIM_MODE required]
    CheckSIM -->|Yes| CheckTenant{SANDBOX_TENANT set?}

    CheckTenant -->|No| BlockTenant[❌ BLOCK: Tenant required]
    CheckTenant -->|Yes| CheckURL{Check URLs}

    CheckURL --> ProdPattern{Matches production<br/>pattern?}
    ProdPattern -->|Yes| BlockProd[❌ BLOCK: Production URL detected]
    ProdPattern -->|No| AllowPattern{Matches allowed<br/>pattern?}

    AllowPattern -->|No| Warn[⚠️ WARN: No sandbox indicators]
    AllowPattern -->|Yes| Pass[✅ PASS]
    Warn --> Pass

    Pass --> Execute([Execute Simulation])

    BlockSIM --> Halt([HALT])
    BlockTenant --> Halt
    BlockProd --> Halt

    style BlockSIM fill:#ff6b6b
    style BlockTenant fill:#ff6b6b
    style BlockProd fill:#ff6b6b
    style Pass fill:#51cf66
    style Execute fill:#51cf66
```

---

## 🎲 Chaos Injection Flow

```mermaid
stateDiagram-v2
    [*] --> CheckDuplicate

    CheckDuplicate --> Duplicate: 15% chance
    CheckDuplicate --> CheckDelay: 85% chance

    Duplicate --> CreateCopy: Generate duplicate event
    CreateCopy --> CheckDelay

    CheckDelay --> Delay: 10% chance
    CheckDelay --> CheckTimeout: 90% chance

    Delay --> AddDelay: Inject 0-5000ms delay
    AddDelay --> CheckTimeout

    CheckTimeout --> Timeout: 5% chance
    CheckTimeout --> CheckNetwork: 95% chance

    Timeout --> SimulateTimeout: Throw timeout error

    CheckNetwork --> NetworkFail: 3% chance
    CheckNetwork --> CheckServer: 97% chance

    NetworkFail --> SimulateNetwork: Throw network error

    CheckServer --> ServerError: 2% chance
    CheckServer --> Execute: 98% chance

    ServerError --> SimulateServer: Throw 500 error

    Execute --> [*]: Normal execution
    SimulateTimeout --> [*]: Retry logic
    SimulateNetwork --> [*]: Retry logic
    SimulateServer --> [*]: Retry logic
```

---

## 🔁 Circuit Breaker State Machine

```mermaid
stateDiagram-v2
    [*] --> Closed

    Closed --> Open: ≥5 consecutive failures
    Closed --> Closed: Success (reset counter)

    Open --> HalfOpen: After 30 seconds
    Open --> Open: Request rejected (fast-fail)

    HalfOpen --> Closed: ≥3 consecutive successes
    HalfOpen --> Open: Any failure

    note right of Closed
        Normal operation
        Failures counted
    end note

    note right of Open
        Fast-fail mode
        Queue events
        30s timeout
    end note

    note right of HalfOpen
        Testing recovery
        Limited requests
    end note
```

---

## 💾 Idempotency Architecture

```mermaid
flowchart LR
    Event[Event Arrives] --> GenKey{Generate<br/>Idempotency Key}

    GenKey --> Format[Format:<br/>tenant-eventType-ts-nonce]

    Format --> Check{Key exists<br/>in store?}

    Check -->|Yes| GetReceipt[Get Receipt]
    GetReceipt --> CheckExpiry{Expired?}

    CheckExpiry -->|Yes| Delete[Delete Receipt]
    Delete --> Execute

    CheckExpiry -->|No| Increment[Increment attempt count]
    Increment --> Return[Return cached response ♻️]

    Check -->|No| Execute[Execute Operation]

    Execute --> Store[Store Receipt]
    Store --> SetTTL[Set 24h TTL]
    SetTTL --> ReturnNew[Return new response]

    style Return fill:#51cf66
    style ReturnNew fill:#51cf66
```

---

## 📊 Metrics Collection Flow

```mermaid
flowchart TD
    Start([Beat Execution Start]) --> Record1[Record Start Time]

    Record1 --> Execute[Execute Beat]

    Execute --> Success{Success?}

    Success -->|Yes| RecordSuccess[Record Latency<br/>success=true]
    Success -->|No| RecordFail[Record Latency<br/>success=false]

    RecordSuccess --> RecordApp1[Record App Event<br/>success=true]
    RecordFail --> RecordApp2[Record App Event<br/>success=false]

    RecordApp1 --> Retry{Was retry?}
    RecordApp2 --> Retry

    Retry -->|Yes| IncRetry[Increment retry count]
    Retry -->|No| Dedupe{Was dedupe?}

    IncRetry --> Dedupe

    Dedupe -->|Yes| IncDedupe[Increment dedupe count]
    Dedupe -->|No| Next

    IncDedupe --> Next([Next Beat])

    Next --> AllDone{All beats<br/>complete?}

    AllDone -->|No| Start
    AllDone -->|Yes| Calculate[Calculate Statistics]

    Calculate --> GenerateScore[Generate Scorecard]
    GenerateScore --> End([Simulation Complete])
```

---

## 🏗️ Component Architecture

### Core Components

| Component | Responsibility | Dependencies | State |
|-----------|---------------|--------------|-------|
| **Guard Rails** | Production protection | Environment variables | Stateless |
| **Chaos Engine** | Deterministic chaos injection | Seeded RNG | Stateful (sequence) |
| **Idempotency Engine** | Deduplication | In-memory store | Stateful (receipts) |
| **Circuit Breaker** | Failure isolation | Timers | Stateful (state machine) |
| **Metrics Collector** | Performance tracking | In-memory arrays | Stateful (metrics) |
| **Simulation Runner** | Orchestration | All above | Stateful (run state) |

### Data Flow

```mermaid
graph LR
    Config[Configuration] --> Runner
    Runner --> Event[Event Envelope]
    Event --> Chaos[Chaos Decision]
    Chaos --> EventWithChaos[Event + Chaos Metadata]
    EventWithChaos --> Idempotency[Idempotency Check]
    Idempotency --> Circuit[Circuit Breaker]
    Circuit --> Adapter[App Adapter]
    Adapter --> Response[Response]
    Response --> Receipt[Idempotency Receipt]
    Receipt --> Metric[Latency Metric]
    Metric --> Scorecard[Final Scorecard]
```

---

## 🔐 Security Architecture

### Isolation Layers

```mermaid
graph TB
    subgraph "Layer 1: Environment"
        E1[SIM_MODE=true]
        E2[SANDBOX_TENANT]
    end

    subgraph "Layer 2: Guard Rails"
        G1[URL Validation]
        G2[Production Detection]
    end

    subgraph "Layer 3: Execution"
        X1[Dry Run Mode]
        X2[Mock Adapters]
    end

    subgraph "Layer 4: Data"
        D1[Sandbox Schema]
        D2[Test Tenant Isolation]
    end

    E1 --> G1
    E2 --> G2
    G1 --> X1
    G2 --> X2
    X1 --> D1
    X2 --> D2

    style E1 fill:#ff6b6b
    style E2 fill:#ff6b6b
    style G1 fill:#ffa500
    style G2 fill:#ffa500
    style X1 fill:#51cf66
    style X2 fill:#51cf66
    style D1 fill:#51cf66
    style D2 fill:#51cf66
```

---

## 📈 Scalability Architecture

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Simulation Coordinator"
        Coord[Coordinator Process]
    end

    subgraph "Worker Pool"
        W1[Worker 1<br/>Seed: 42]
        W2[Worker 2<br/>Seed: 43]
        W3[Worker 3<br/>Seed: 44]
        WN[Worker N<br/>Seed: 42+N]
    end

    subgraph "Results Aggregator"
        Agg[Aggregator]
        Report[Combined Report]
    end

    Coord --> W1
    Coord --> W2
    Coord --> W3
    Coord --> WN

    W1 --> Agg
    W2 --> Agg
    W3 --> Agg
    WN --> Agg

    Agg --> Report
```

### Burst Mode Architecture

- **Rate Limiting**: Token bucket per worker
- **Load Distribution**: Round-robin to workers
- **Metrics Aggregation**: Merge histograms
- **Failure Isolation**: Worker failures don't stop test

---

## 🎯 Determinism Guarantees

### Same Seed → Same Results

```mermaid
flowchart LR
    Seed[Seed: 42] --> RNG[Seeded RNG]

    RNG --> D1[Decision 1:<br/>Duplicate]
    RNG --> D2[Decision 2:<br/>Delay 1500ms]
    RNG --> D3[Decision 3:<br/>No failure]

    D1 --> E1[Event 1<br/>duplicated]
    D2 --> E2[Event 2<br/>delayed]
    D3 --> E3[Event 3<br/>normal]

    E1 --> R1[Result 1]
    E2 --> R2[Result 2]
    E3 --> R3[Result 3]

    R1 --> Score[Score: 87.5]
    R2 --> Score
    R3 --> Score

    Score --> Replay{Replay with<br/>Seed: 42}
    Replay --> Score2[Score: 87.5<br/>✅ IDENTICAL]
```

---

## 📦 Evidence Bundle Structure

```
evidence/
└── <runId>/
    ├── scorecard.json          # Final results
    ├── events.jsonl            # All events (newline-delimited JSON)
    ├── receipts.jsonl          # Idempotency receipts
    ├── metrics.json            # Latency histograms + stats
    ├── circuits.json           # Circuit breaker state history
    ├── chaos-decisions.jsonl   # Chaos decisions per event
    ├── logs.txt                # Execution logs
    └── manifest.json           # Bundle metadata
```

---

## 🔄 Retry & Recovery Architecture

```mermaid
sequenceDiagram
    participant R as Runner
    participant CB as Circuit Breaker
    participant A as App Adapter

    R->>CB: Execute operation
    CB->>A: Attempt 1
    A--xCB: ❌ Timeout

    Note over CB: Failure 1/5

    CB->>CB: Calculate backoff<br/>500ms + jitter
    CB->>CB: Wait 523ms

    CB->>A: Attempt 2 (retry)
    A--xCB: ❌ Network error

    Note over CB: Failure 2/5

    CB->>CB: Calculate backoff<br/>1000ms + jitter
    CB->>CB: Wait 1147ms

    CB->>A: Attempt 3 (retry)
    A-->>CB: ✅ Success

    Note over CB: Success!<br/>Reset counter

    CB-->>R: Return response
```

---

## 🎓 Key Design Decisions

### 1. In-Memory vs Database

**Decision:** In-memory for simulation, with DB stub for production

**Rationale:**
- Fast execution in tests
- No external dependencies for CI
- Easy to reset between runs
- Future-ready (DB persistence stubbed)

### 2. Deterministic Chaos

**Decision:** Seeded RNG for reproducibility

**Rationale:**
- Debugging failures requires replay
- Regression tests need consistency
- Audit trails need determinism

### 3. Circuit Breakers Per App

**Decision:** One circuit breaker per target app

**Rationale:**
- Isolate failures to specific services
- Prevent cascading outages
- Independent recovery

### 4. Idempotency Keys Include Timestamp

**Decision:** `tenant-eventType-timestamp-nonce`

**Rationale:**
- Globally unique across runs
- Time-based expiration
- Collision-resistant

---

## 🚀 Performance Characteristics

| Metric | Target | Typical | Notes |
|--------|--------|---------|-------|
| Beat Execution | <100ms | 50-150ms | Without chaos |
| Full Simulation (13 beats) | <60s | 30-45s | With chaos |
| Dry Run Mode | <10s | 5-8s | No real API calls |
| Burst Mode (50 req/s) | Sustained | 45-55 req/s | With chaos |
| Memory Usage | <500MB | 200-300MB | In-memory stores |
| Evidence Bundle | <10MB | 2-5MB | Per run |

---

## 🔮 Future Enhancements

1. **Database Persistence**
   - Store idempotency receipts in Supabase
   - Survive process restarts
   - Cross-instance deduplication

2. **Distributed Tracing**
   - OpenTelemetry integration
   - Span propagation across apps
   - Jaeger/Zipkin export

3. **Real-Time Dashboard**
   - WebSocket live updates
   - Circuit breaker visualization
   - Latency heatmaps

4. **Machine Learning**
   - Anomaly detection
   - Failure prediction
   - Adaptive chaos rates

---

## 📚 References

- CloudEvents Specification: https://cloudevents.io/
- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Idempotency Patterns: https://stripe.com/docs/api/idempotent_requests
- Chaos Engineering: https://principlesofchaos.org/

---

**Architecture Status:** ✅ **COMPLETE**
**Last Review:** 2026-01-03
**Next Review:** 2026-02-01
