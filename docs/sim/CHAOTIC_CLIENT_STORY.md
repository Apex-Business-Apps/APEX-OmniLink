# Chaotic Client Story: "Sarah's Terrible, Horrible, No Good, Very Bad Day"
## Full-System Integration Test - All 12 APEX Apps

**Client:** Sarah Martinez (Sarah's Boutique)
**Date:** One chaotic business day
**Scenario:** Everything that can go wrong, does go wrong - testing system resilience
**Outcome:** System handles all chaos gracefully through autonomous isolation & recovery

---

## Story Arc

Sarah owns a small fashion boutique. She's non-technical, stressed, and today everything is breaking. She needs EVERY APEX app to work together flawlessly, despite chaos happening behind the scenes.

**The twist:** While Sarah sees smooth operation, the simulation is injecting:
- 15% duplicate requests
- 10% out-of-order processing
- 5% timeout scenarios
- 3% network failures
- 2% server errors
- Partial outages

The system **MUST** handle all of this transparently through:
- Idempotency (deduplication)
- Circuit breakers (isolation)
- Retries (resilience)
- Event ordering (consistency)

---

## Beat-by-Beat Story

### 🌅 Morning (7:00 AM - 9:00 AM)

#### Beat 1: **TradeLine 24/7** - Emergency Call Received
**Time:** 7:15 AM
**What Happens:** Customer calls about broken zipper on designer jacket
**Sarah's POV:** Phone rings, TradeLine AI answers professionally
**Behind the Scenes:** Duplicate call event injected, idempotency prevents double-logging

**Event:**
```typescript
{
  eventType: 'tradeline247:call.received',
  app: 'tradeline247',
  target: ['omnihub', 'jubeelove'], // Broadcast to dashboard + CRM
  payload: {
    callId: 'call-001',
    from: '+1-555-0123',
    to: '+1-555-BOUTIQUE',
    timestamp: '2026-01-03T07:15:00Z'
  },
  expectedOutcome: 'Call logged once despite duplicate',
  observability: 'agent_runs table shows single entry for call-001'
}
```

**Chaos Injected:**
- Duplicate: YES (idempotency key prevents duplicate)
- Delay: 50ms
- Circuit State: CLOSED

---

#### Beat 2: **AutoRepAi** - Repair Estimate Needed
**Time:** 7:20 AM
**What Happens:** Customer needs repair estimate for torn lining
**Sarah's POV:** AI generates instant quote
**Behind the Scenes:** Network timeout, retry succeeds

**Event:**
```typescript
{
  eventType: 'autorepai:repair.estimated',
  app: 'autorepai',
  target: 'flowbills', // Estimate feeds into billing
  payload: {
    estimateId: 'est-001',
    vehicleInfo: { make: 'Garment', model: 'Designer Jacket', year: 2024 },
    issues: ['Broken zipper', 'Torn lining'],
    estimatedCost: 75.00,
    estimatedDuration: '2 days'
  },
  expectedOutcome: 'Estimate created after retry',
  observability: 'Estimate appears in billing system'
}
```

**Chaos Injected:**
- Timeout: YES (first attempt fails, retry succeeds)
- Retries: 1
- Circuit State: CLOSED

---

#### Beat 3: **KeepSafe** - Safety Check Scheduled
**Time:** 7:30 AM
**What Happens:** Monthly fire safety inspection due
**Sarah's POV:** Reminder notification appears
**Behind the Scenes:** Out-of-order delivery (processed after delay)

**Event:**
```typescript
{
  eventType: 'keepsafe:safety_check.completed',
  app: 'keepsafe',
  target: ['omnihub', 'careconnect'], // Dashboard + compliance tracking
  payload: {
    checkId: 'safety-001',
    facility: 'Sarahs Boutique Main St',
    inspector: 'Fire Marshal Johnson',
    items: [
      { category: 'Fire Extinguishers', status: 'pass', notes: 'All operational' },
      { category: 'Emergency Exits', status: 'pass', notes: 'Clear and marked' }
    ],
    overallStatus: 'compliant',
    completedAt: '2026-01-03T07:30:00Z'
  },
  expectedOutcome: 'Safety check logged despite delay',
  observability: 'KeepSafe dashboard shows compliance'
}
```

**Chaos Injected:**
- Out-of-Order: YES (2 second delay)
- Delay: 2000ms
- Circuit State: CLOSED

---

### 📞 Mid-Morning (9:00 AM - 11:00 AM)

#### Beat 4: **FLOWBills** - Invoice Created
**Time:** 9:00 AM
**What Happens:** Generate invoice for repair estimate
**Sarah's POV:** Invoice auto-generated and sent to customer
**Behind the Scenes:** FlowC compliance check triggered silently

**Event:**
```typescript
{
  eventType: 'flowbills:invoice.created',
  app: 'flowbills',
  target: ['flowc', 'omnihub'], // Compliance + dashboard
  payload: {
    invoiceId: 'inv-001',
    clientId: 'client-123',
    amount: 75.00,
    currency: 'USD',
    dueDate: '2026-01-10',
    lineItems: [
      { description: 'Zipper repair', quantity: 1, unitPrice: 45.00, total: 45.00 },
      { description: 'Lining repair', quantity: 1, unitPrice: 30.00, total: 30.00 }
    ],
    taxRate: 0.08,
    totalAmount: 81.00
  },
  expectedOutcome: 'Invoice created and compliance checked',
  observability: 'Invoice in FLOWBills, compliance record in FlowC'
}
```

**Chaos Injected:**
- Duplicate: NO
- Delay: 0ms
- Circuit State: CLOSED

---

#### Beat 5: **FlowC** - Silent Compliance Validation
**Time:** 9:00 AM + 100ms
**What Happens:** Automatic compliance check on invoice
**Sarah's POV:** Nothing (silent background process)
**Behind the Scenes:** Validates tax calculations, pricing rules

**Event:**
```typescript
{
  eventType: 'flowc:compliance.validated',
  app: 'flowc',
  target: 'flowbills', // Send result back to billing
  payload: {
    checkId: 'compliance-001',
    invoiceId: 'inv-001',
    status: 'passed',
    violations: [],
    validatedAt: '2026-01-03T09:00:00.100Z'
  },
  expectedOutcome: 'Compliance passed silently',
  observability: 'Audit log shows compliance check'
}
```

**Chaos Injected:**
- Server Error: YES (retry succeeds)
- Retries: 1
- Circuit State: CLOSED

---

#### Beat 6: **Jubee.Love** - Relationship Coaching Session
**Time:** 10:00 AM
**What Happens:** Sarah has quick coaching session about work-life balance
**Sarah's POV:** 10-minute chat with AI coach
**Behind the Scenes:** Session tracked, progress metrics updated

**Event:**
```typescript
{
  eventType: 'jubeelove:session.started',
  app: 'jubeelove',
  target: 'omnihub', // Dashboard tracking
  payload: {
    sessionId: 'session-001',
    userId: 'sarah-martinez',
    relationshipGoal: 'work-life balance',
    sessionType: 'chat'
  },
  expectedOutcome: 'Session logged and tracked',
  observability: 'Session appears in Jubee dashboard'
}
```

**Chaos Injected:**
- Duplicate: YES (deduplicated)
- Delay: 0ms
- Circuit State: CLOSED

---

### 🍴 Lunch Rush (11:00 AM - 1:00 PM)

#### Beat 7: **TRU Talk** - Customer Verification
**Time:** 11:30 AM
**What Happens:** High-value customer wants to pay with check - verify trust
**Sarah's POV:** Quick trust verification passes
**Behind the Scenes:** Partial outage simulation starts (TRU Talk endpoint)

**Event:**
```typescript
{
  eventType: 'trutalk:trust.verified',
  app: 'trutalk',
  target: ['flowbills', 'omnihub'],
  payload: {
    verificationId: 'verify-001',
    customerId: 'client-456',
    trustScore: 85,
    verificationMethod: 'identity + payment history',
    passed: true
  },
  expectedOutcome: 'Trust verified despite outage (circuit opens, queues event)',
  observability: 'Circuit breaker opens, event queued'
}
```

**Chaos Injected:**
- Partial Outage: YES (TRU Talk endpoint down)
- Circuit State: OPENS (after 5 failures)
- Queue Depth: 1 event

---

#### Beat 8: **aSpiral** - Task Management
**Time:** 12:00 PM
**What Happens:** Sarah creates task: "Order more hangers"
**Sarah's POV:** Task appears in her dashboard
**Behind the Scenes:** Task created while TRU Talk circuit is open

**Event:**
```typescript
{
  eventType: 'aspiral:task.created',
  app: 'aspiral',
  target: 'omnihub',
  payload: {
    taskId: 'task-001',
    title: 'Order more hangers for spring inventory',
    status: 'pending',
    metadata: { priority: 'medium', dueDate: '2026-01-05' }
  },
  expectedOutcome: 'Task created successfully',
  observability: 'Task in aSpiral, appears in OmniHub dashboard'
}
```

**Chaos Injected:**
- Delay: 3000ms (out of order)
- Circuit State: CLOSED (aSpiral)
- TRU Talk Circuit: STILL OPEN

---

#### Beat 9: **OmniHub** - Dashboard Alert
**Time:** 12:15 PM
**What Happens:** Low inventory alert triggered
**Sarah's POV:** Gets notification about low stock
**Behind the Scenes:** OmniHub aggregates data from multiple apps

**Event:**
```typescript
{
  eventType: 'omnihub:alert.created',
  app: 'omnihub',
  target: ['aspiral', 'flowbills'], // Create task + prepare purchase order
  payload: {
    alertId: 'alert-001',
    type: 'inventory',
    severity: 'medium',
    message: 'Designer handbags below reorder threshold',
    actionRequired: true
  },
  expectedOutcome: 'Alert created, triggers automation',
  observability: 'Alert visible, tasks auto-created'
}
```

**Chaos Injected:**
- Duplicate: YES (deduplicated)
- Network Failure: YES (retry succeeds)
- Retries: 2
- Circuit State: CLOSED

---

### 🌆 Afternoon (1:00 PM - 5:00 PM)

#### Beat 10: **Bright Beginnings** - New Employee Onboarding
**Time:** 2:00 PM
**What Happens:** New part-time employee enrollment started
**Sarah's POV:** Onboarding checklist appears
**Behind the Scenes:** TRU Talk circuit recovers (half-open → closed)

**Event:**
```typescript
{
  eventType: 'bright:enrollment.started',
  app: 'bright',
  target: ['omnihub', 'keepsafe'], // Dashboard + safety training required
  payload: {
    enrollmentId: 'enroll-001',
    employeeName: 'Jessica Chen',
    position: 'Sales Associate',
    startDate: '2026-01-06',
    trainingModules: ['POS System', 'Fire Safety', 'Customer Service']
  },
  expectedOutcome: 'Enrollment created, triggers safety training',
  observability: 'Employee in Bright, safety training auto-scheduled'
}
```

**Chaos Injected:**
- Delay: 0ms
- Circuit State: CLOSED
- TRU Talk Circuit: HALF-OPEN (testing recovery)

---

#### Beat 11: **CareConnect** - Health Insurance Coordination
**Time:** 3:00 PM
**What Happens:** New employee needs health insurance setup
**Sarah's POV:** System auto-coordinates with insurance provider
**Behind the Scenes:** Cross-app coordination (Bright → CareConnect → FLOWBills)

**Event:**
```typescript
{
  eventType: 'careconnect:patient.registered',
  app: 'careconnect',
  target: ['flowbills', 'omnihub'],
  payload: {
    registrationId: 'reg-001',
    employeeId: 'enroll-001',
    insurancePlan: 'small-business-health-plus',
    coverage: 'medical, dental, vision',
    effectiveDate: '2026-02-01'
  },
  expectedOutcome: 'Insurance registered, premium invoiced',
  observability: 'CareConnect record, billing entry for premium'
}
```

**Chaos Injected:**
- Out-of-Order: YES (1500ms delay)
- Circuit State: CLOSED
- TRU Talk Circuit: CLOSED (recovered!)

---

#### Beat 12: **FLOWBills** - Payment Received
**Time:** 4:00 PM
**What Happens:** Customer pays invoice from morning
**Sarah's POV:** Payment notification, funds reconciled
**Behind the Scenes:** Reconciliation across multiple systems

**Event:**
```typescript
{
  eventType: 'flowbills:payment.received',
  app: 'flowbills',
  target: ['omnihub', 'flowc'], // Dashboard + compliance audit
  payload: {
    paymentId: 'pay-001',
    invoiceId: 'inv-001',
    amount: 81.00,
    method: 'card',
    paidAt: '2026-01-03T16:00:00Z',
    reference: 'CARD-XXXX-1234'
  },
  expectedOutcome: 'Payment recorded, invoice marked paid',
  observability: 'FLOWBills shows paid, audit trail in FlowC'
}
```

**Chaos Injected:**
- Duplicate: YES (critical - payment must NOT be double-charged!)
- Idempotency: CRITICAL SUCCESS - deduplicated
- Circuit State: CLOSED

---

#### Beat 13: **TradeLine 24/7** - Appointment Scheduled
**Time:** 4:30 PM
**What Happens:** Another customer calls to schedule pickup
**Sarah's POV:** AI schedules pickup for repaired jacket
**Behind the Scenes:** Final integration test - all systems working together

**Event:**
```typescript
{
  eventType: 'tradeline247:appointment.scheduled',
  app: 'tradeline247',
  target: ['omnihub', 'aspiral'], // Dashboard + create task
  payload: {
    appointmentId: 'appt-001',
    callId: 'call-002',
    clientName: 'John Doe',
    scheduledFor: '2026-01-05T10:00:00Z',
    serviceType: 'Pickup - Repaired Jacket',
    notes: 'Zipper and lining repair completed'
  },
  expectedOutcome: 'Appointment scheduled, task auto-created for prep',
  observability: 'Calendar entry, task in aSpiral'
}
```

**Chaos Injected:**
- Network Failure: YES (retry succeeds)
- Retries: 1
- Circuit State: CLOSED
- Final System Check: ALL CIRCUITS CLOSED (healthy)

---

## Beat Mapping Table

| Beat | Time | App | Event Type | Target | Chaos | Expected Outcome | Observability |
|------|------|-----|------------|--------|-------|------------------|---------------|
| 1 | 7:15 AM | TradeLine 24/7 | call.received | omnihub, jubeelove | Duplicate | Single call logged | agent_runs |
| 2 | 7:20 AM | AutoRepAi | repair.estimated | flowbills | Timeout + Retry | Estimate created | estimates table |
| 3 | 7:30 AM | KeepSafe | safety_check.completed | omnihub, careconnect | Out-of-order (2s) | Check logged | safety_checks |
| 4 | 9:00 AM | FLOWBills | invoice.created | flowc, omnihub | None | Invoice + compliance | invoices |
| 5 | 9:00 AM | FlowC | compliance.validated | flowbills | Server error + retry | Passed | audit_logs |
| 6 | 10:00 AM | Jubee.Love | session.started | omnihub | Duplicate | Session logged once | sessions |
| 7 | 11:30 AM | TRU Talk | trust.verified | flowbills, omnihub | **OUTAGE STARTS** | Circuit opens, queued | circuit_state |
| 8 | 12:00 PM | aSpiral | task.created | omnihub | Out-of-order (3s) | Task created | tasks |
| 9 | 12:15 PM | OmniHub | alert.created | aspiral, flowbills | Dup + network fail | Alert + automation | alerts |
| 10 | 2:00 PM | Bright Beginnings | enrollment.started | omnihub, keepsafe | None | **OUTAGE RECOVERS** | enrollments |
| 11 | 3:00 PM | CareConnect | patient.registered | flowbills, omnihub | Out-of-order (1.5s) | Insurance setup | registrations |
| 12 | 4:00 PM | FLOWBills | payment.received | omnihub, flowc | **CRITICAL DUPLICATE** | Deduped! | payments |
| 13 | 4:30 PM | TradeLine 24/7 | appointment.scheduled | omnihub, aspiral | Network fail + retry | Appointment booked | appointments |

---

## Success Criteria

### Must Pass (100% Required)

1. ✅ **Idempotency**: Beat 12 (payment) - NO double charge despite duplicate
2. ✅ **Circuit Breaker**: Beat 7-10 - TRU Talk outage isolated, system continues
3. ✅ **Recovery**: Beat 10 - Circuit closes after recovery
4. ✅ **Retries**: Beats 2, 5, 9, 13 - All retries succeed
5. ✅ **Out-of-Order**: Beats 3, 8, 11 - Events processed correctly despite delays
6. ✅ **Deduplication**: Beats 1, 6, 9, 12 - No duplicate side effects

### Should Pass (90% Target)

- ✅ All 13 beats execute successfully
- ✅ Average latency < 500ms p95
- ✅ Error rate < 10%
- ✅ Zero data corruption
- ✅ Circuit breakers isolate failures
- ✅ System recovers autonomously

---

## Chaos Configuration

```typescript
{
  seed: 42, // Deterministic
  duplicateRate: 0.15, // 15% duplicates
  outOfOrderRate: 0.10, // 10% delays
  timeoutRate: 0.05, // 5% timeouts
  networkFailureRate: 0.03, // 3% network errors
  serverErrorRate: 0.02, // 2% server errors
  maxDelayMs: 5000, // Max 5s delay
  timeoutMs: 30000, // 30s timeout
  maxRetries: 2, // 2 retries max
  baseBackoffMs: 500, // 500ms base backoff
  partialOutageApp: 'trutalk', // TRU Talk goes down
  outageStartSeq: 7, // Beat 7
  outageEndSeq: 10, // Recovers at Beat 10
}
```

---

## Evidence Requirements

Each beat MUST produce:
1. **Event Log**: EventEnvelope with correlationId + idempotencyKey
2. **Idempotency Receipt**: Proof of deduplication
3. **Circuit State**: Before/after state
4. **Latency Metric**: p50/p95/p99
5. **Retry Count**: Number of attempts
6. **Final Outcome**: Success/failure + data proof

Evidence Bundle: `evidence/<runId>.zip`
Contains:
- `events.jsonl` - All events
- `receipts.jsonl` - Idempotency receipts
- `metrics.json` - Latency histograms
- `circuits.json` - Circuit breaker states
- `scorecard.json` - Final results

---

## Real-World Lessons

This story tests:
- **Duplicate payments** - Common with retries, MUST be idempotent
- **Partial outages** - One service down shouldn't break everything
- **Recovery** - System must heal automatically
- **Out-of-order** - Network delays happen, handle gracefully
- **Cross-app coordination** - 12 apps must work as one
- **Non-technical users** - Sarah never knows chaos is happening

**This is production-ready chaos engineering.**
