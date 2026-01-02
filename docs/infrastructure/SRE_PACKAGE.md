# SRE PACKAGE
**Site Reliability Engineering for OmniHub/TradeLine/APEX**

**Purpose:** Define SLIs, SLOs, error budgets, dashboards, alerts, and runbooks for operating OmniHub at production scale.

**Philosophy:** Reliability is a feature. We measure it, monitor it, and improve it systematically.

---

## SLI / SLO DEFINITIONS

### Service Level Indicators (SLIs)

**What We Measure:**

| SLI | Definition | Measurement Method | Target |
|-----|------------|-------------------|--------|
| **Availability** | % of requests that return 2xx/3xx (not 5xx) | (successful_requests / total_requests) * 100 | > 99.9% |
| **Latency (P50)** | 50th percentile request duration | Histogram, median | < 200ms |
| **Latency (P95)** | 95th percentile request duration | Histogram, 95th percentile | < 500ms |
| **Latency (P99)** | 99th percentile request duration | Histogram, 99th percentile | < 1000ms |
| **Workflow Success Rate** | % of workflows that complete successfully | (completed_workflows / total_workflows) * 100 | > 95% |
| **Approval Queue Depth** | Number of pending approvals | Count of `status='pending'` in approval_queue | < 50 |
| **DLQ Depth** | Number of messages in Dead Letter Queue | Count of messages in DLQ | < 10 |
| **Error Rate** | % of requests returning 5xx errors | (5xx_requests / total_requests) * 100 | < 0.1% |

### Service Level Objectives (SLOs)

**28-Day Rolling Window:**

| Service | SLO | Error Budget | Impact if Breached |
|---------|-----|--------------|---------------------|
| **API Gateway** | 99.9% availability | 0.1% = 40 minutes/month downtime | Page on-call, freeze deploys |
| **API Gateway** | P95 latency < 500ms | 5% of requests can exceed | Investigate performance issues |
| **Orchestrator** | 99.5% workflow success rate | 0.5% = 150 failed workflows/month | Review failed workflows, improve error handling |
| **Executors** | 99% execution success rate | 1% = 300 failed executions/month | Investigate transient errors, add retries |
| **Database** | 99.95% availability | 0.05% = 20 minutes/month downtime | Escalate to database admin, check replicas |

**Error Budget Policy:**

| Error Budget Remaining | Action |
|------------------------|--------|
| **> 50%** | ✅ Normal operations, deploy freely |
| **25-50%** | ⚠️ Caution: slow down deploy velocity, prioritize reliability work |
| **10-25%** | 🟥 Deploy freeze (emergency fixes only), all hands on reliability |
| **< 10%** | 🚨 Full incident response, cancel all feature work |

**Error Budget Burn Rate Alerts:**

| Burn Rate | Time to Exhaustion | Alert Severity | Action |
|-----------|-------------------|----------------|--------|
| **14.4x** | 2 hours | 🚨 Page | Immediate incident response |
| **6x** | 5 hours | ⚠️ Alert | On-call investigates within 30 min |
| **3x** | 10 hours | ⚠️ Alert | On-call investigates within 1 hour |
| **1x** | 28 days | ℹ️ Info | Normal, no action |

**Formula:**
```
Burn Rate = (Error Rate in Last Hour / SLO Error Budget) * 28 days
```

Example: If SLO is 99.9% (0.1% error budget) and current error rate is 1.44%, burn rate is 14.4x.

---

## DASHBOARDS

### 1. SLO Dashboard (Primary)

**Purpose:** Real-time view of SLO compliance and error budget burn.

**Widgets:**

**Row 1: SLO Status**
- Availability (last 28 days): 99.95% ✅ (Target: 99.9%)
- Error Budget Remaining: 75% ✅
- Burn Rate (1h): 0.5x ✅ (Target: < 1x)

**Row 2: Latency SLIs**
- P50 Latency: 120ms ✅ (Target: < 200ms)
- P95 Latency: 380ms ✅ (Target: < 500ms)
- P99 Latency: 850ms ✅ (Target: < 1000ms)

**Row 3: Workflow Health**
- Workflow Success Rate: 97.2% ✅ (Target: > 95%)
- Approval Queue Depth: 12 ✅ (Target: < 50)
- DLQ Depth: 3 ✅ (Target: < 10)

**Row 4: Error Rate Trend**
- Time series graph: 5xx error rate (last 7 days)
- Breakdown by endpoint

**Grafana Dashboard JSON:** (See `dashboards/slo-dashboard.json`)

### 2. Operator Dashboard (Control Panel)

**Purpose:** Emergency controls, approval queue, active workflows.

**Widgets:**

**Row 1: Emergency Controls Status**
- OMNIHUB_KILL_SWITCH: ⬜ OFF
- EXECUTION_SAFE_MODE: ⬜ OFF
- OPERATOR_TAKEOVER: ⬜ OFF

**Row 2: Approval Queue**
- Pending approvals: 7 (oldest: 15 minutes ago)
- Approved today: 42
- Rejected today: 3
- Expired today: 1

**Row 3: Active Workflows**
- In progress: 142
- Queued: 28
- Failed (last hour): 2 ⚠️

**Row 4: Recent Audit Log**
- Last 10 operator actions (enable kill switch, approve workflow, etc.)

### 3. Infrastructure Dashboard (Resource Utilization)

**Purpose:** CPU, memory, disk, network for capacity planning.

**Widgets:**

**Row 1: Compute**
- K8s node CPU utilization (avg, max)
- K8s node memory utilization (avg, max)
- Pod count by namespace

**Row 2: Database**
- PostgreSQL connection count (current, max)
- PostgreSQL query duration (P95, P99)
- Database disk utilization (%)

**Row 3: Cache (Redis)**
- Redis memory utilization (%)
- Redis hit rate (%)
- Redis commands/sec

**Row 4: Cost Estimation**
- Estimated monthly cost (if supported by provider)

---

## ALERTING

### Alert Routing

```
┌─────────────────────────────────────────────────────────┐
│ Alert Manager                                           │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┬────────────────┐
         │                       │                │
         ▼                       ▼                ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ PagerDuty       │  │ Slack           │  │ Email           │
│ (Critical only) │  │ (All alerts)    │  │ (Daily digest)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Alert Definitions

**Critical Alerts (Page On-Call):**

| Alert Name | Condition | Threshold | Duration | Runbook |
|------------|-----------|-----------|----------|---------|
| **HighErrorBudgetBurnRate** | Burn rate > 14.4x | 14.4x | 5 minutes | `runbooks/high-error-rate.md` |
| **ServiceDown** | Availability < 90% | 90% | 2 minutes | `runbooks/service-down.md` |
| **DatabaseDown** | DB health check fails | N/A | 2 minutes | `runbooks/database-down.md` |
| **DLQBacklog** | DLQ depth > 100 | 100 | 10 minutes | `runbooks/dlq-backlog.md` |
| **KillSwitchEnabled** | OMNIHUB_KILL_SWITCH = true | N/A | Immediate | `runbooks/kill-switch-active.md` |

**Warning Alerts (Slack Only):**

| Alert Name | Condition | Threshold | Duration |
|------------|-----------|-----------|----------|
| **ElevatedErrorRate** | Error rate > 0.5% | 0.5% | 5 minutes |
| **HighLatency** | P95 latency > 1000ms | 1000ms | 5 minutes |
| **ApprovalQueueBacklog** | Approval queue > 50 | 50 | 10 minutes |
| **HighDatabaseConnections** | DB connections > 80% max | 80% | 5 minutes |
| **LowErrorBudget** | Error budget < 25% | 25% | N/A |

**Prometheus Alert Rules (Example):**

```yaml
# prometheus/alerts.yml
groups:
  - name: omnihub_slo
    interval: 30s
    rules:
      - alert: HighErrorBudgetBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          ) > (0.001 * 14.4)  # 14.4x burn rate for 99.9% SLO
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error budget burn rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}, burning error budget 14.4x faster than sustainable rate. Investigate immediately."
          runbook_url: "https://runbooks.omnihub.dev/high-error-rate"

      - alert: ServiceDown
        expr: up{job="api-gateway"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.instance }} is down"
          description: "API Gateway instance {{ $labels.instance }} has been down for more than 2 minutes."
          runbook_url: "https://runbooks.omnihub.dev/service-down"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P95 latency detected"
          description: "P95 latency is {{ $value }}s (> 1s threshold). Users may be experiencing slow responses."

      - alert: DLQBacklog
        expr: rabbitmq_queue_messages{queue="dead_letter_queue"} > 100
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Dead Letter Queue has {{ $value }} messages"
          description: "Large backlog of failed messages. Investigate failed executions."
          runbook_url: "https://runbooks.omnihub.dev/dlq-backlog"
```

---

## RUNBOOKS

### Runbook Template

Every alert must have a runbook. Format:

```markdown
# [Alert Name]

## Severity
[Critical / Warning / Info]

## Summary
[What this alert means in plain English]

## Impact
[User impact: What are users experiencing?]

## Diagnosis
**Step 1:** Check [dashboard/metric]
**Step 2:** Run command: `kubectl logs ...`
**Step 3:** Query database: `SELECT ...`

## Resolution
**Option 1 (Quick Fix):** [Temporary mitigation]
**Option 2 (Root Cause):** [Permanent fix]

## Escalation
If not resolved in [X minutes], escalate to [team/person]

## Post-Incident
- [ ] Write incident report
- [ ] Identify root cause
- [ ] Create Jira ticket for permanent fix
- [ ] Update runbook with lessons learned
```

### Example Runbook: High Error Rate

**File:** `runbooks/high-error-rate.md`

```markdown
# High Error Rate

## Severity
🚨 **CRITICAL** (Page on-call immediately)

## Summary
The API Gateway is returning > 1% 5xx errors, burning through error budget 14.4x faster than sustainable.

## Impact
Users are experiencing failed requests. Workflows may be failing. Data integrity may be at risk.

## Diagnosis

### Step 1: Identify which endpoints are failing
```bash
# Query Prometheus for error rate by endpoint
curl -G 'http://prometheus:9090/api/v1/query' \
  --data-urlencode 'query=sum by (endpoint) (rate(http_requests_total{status=~"5.."}[5m]))'
```

### Step 2: Check recent deployments
```bash
# Check if error spike correlates with deployment
kubectl rollout history deployment/api-gateway -n omnihub-prod
```

### Step 3: Check upstream dependencies
```bash
# Check database health
kubectl exec -it postgres-0 -n omnihub-data -- pg_isready

# Check Redis health
redis-cli -h redis.omnihub-prod.svc.cluster.local ping
```

### Step 4: Check logs for error patterns
```bash
kubectl logs -n omnihub-prod deployment/api-gateway --tail=100 | grep ERROR
```

## Resolution

### Option 1: Rollback (if recent deployment)
```bash
# Rollback to previous version
kubectl rollout undo deployment/api-gateway -n omnihub-prod

# Verify error rate decreases
watch -n 5 'curl -s prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[1m])'
```

### Option 2: Scale up (if resource exhaustion)
```bash
# Check resource utilization
kubectl top pods -n omnihub-prod

# Scale up if CPU/memory maxed out
kubectl scale deployment/api-gateway -n omnihub-prod --replicas=10
```

### Option 3: Enable SAFE_MODE (if cause unknown)
```sql
-- Disable all side effects until issue is resolved
UPDATE emergency_controls
SET EXECUTION_SAFE_MODE = true,
    reason = 'High error rate incident',
    updated_by = '[your_user_id]';
```

## Escalation
- **0-15 min:** On-call engineer investigates
- **15-30 min:** If not resolved, escalate to Senior SRE
- **30-60 min:** If still not resolved, activate incident commander, notify CTO

## Post-Incident
- [ ] Write incident report (template: `docs/incidents/YYYY-MM-DD-high-error-rate.md`)
- [ ] Identify root cause (database overload, code bug, DDoS attack, etc.)
- [ ] Create Jira ticket for permanent fix
- [ ] Schedule postmortem meeting (blameless)
- [ ] Update this runbook with lessons learned
```

### Additional Runbooks (Create These)

1. `runbooks/service-down.md` - Service health check failing
2. `runbooks/database-down.md` - Database unavailable
3. `runbooks/dlq-backlog.md` - Dead Letter Queue filling up
4. `runbooks/kill-switch-active.md` - Emergency kill switch was enabled
5. `runbooks/high-latency.md` - P95 latency exceeds SLO
6. `runbooks/approval-queue-backlog.md` - Approvals pending too long
7. `runbooks/deployment-failure.md` - Canary deployment failing health checks
8. `runbooks/database-migration-failure.md` - Schema migration failed
9. `runbooks/blockchain-rpc-down.md` - Alchemy/Infura unavailable
10. `runbooks/data-corruption.md` - Database integrity check failed

---

## ON-CALL ROTATION

### Schedule
- **Primary on-call:** 7-day rotation
- **Secondary on-call:** 7-day rotation (offset by 3.5 days)
- **Escalation:** Manager on-call (for critical incidents only)

### On-Call Responsibilities
- Respond to pages within **5 minutes**
- Acknowledge alert within **10 minutes**
- Provide status update within **30 minutes**
- Resolve or escalate within **1 hour**
- Write incident report within **24 hours** of resolution

### On-Call Checklist (Start of Shift)
- [ ] Verify PagerDuty is configured correctly (phone, SMS, push)
- [ ] Verify access to production systems (kubectl, database, dashboards)
- [ ] Review open incidents from previous shift
- [ ] Check error budget status (any budgets < 50%?)
- [ ] Review recent deployments (any canaries in progress?)

### On-Call Checklist (End of Shift)
- [ ] Hand off any open incidents to next on-call
- [ ] Update incident reports
- [ ] Log any toil (repetitive manual work) for automation backlog

---

## INCIDENT RESPONSE PROCESS

### Severity Levels

| Severity | Definition | Response Time | Escalation |
|----------|-----------|---------------|------------|
| **SEV-1 (Critical)** | Total service outage, data loss risk | Page immediately | Incident commander within 15 min |
| **SEV-2 (Major)** | Partial outage, degraded performance | Alert on-call | Escalate if not resolved in 1 hour |
| **SEV-3 (Minor)** | Minor issue, workaround available | Slack notification | Create ticket, fix in next sprint |

### Incident Response Roles

**Incident Commander (IC):**
- Coordinates response
- Declares incidents resolved
- Ensures incident report is written
- Schedules postmortem

**Technical Lead (TL):**
- Investigates root cause
- Implements fixes
- Communicates technical details to IC

**Communications Lead (CL):**
- Updates status page
- Notifies stakeholders (customers, sales, exec team)
- Prepares external communications

### Incident Timeline

```
0 min:  Alert fires → Page on-call
5 min:  On-call acknowledges, begins investigation
15 min: If SEV-1, activate incident commander
30 min: Status update (Slack #incidents, status page)
60 min: Escalate if not resolved
---
Resolution: Incident resolved, services restored
+1 hour: Preliminary incident report (root cause, timeline, resolution)
+24 hours: Full incident report published
+1 week: Blameless postmortem meeting
```

---

## DISASTER RECOVERY DRILLS

### Quarterly DR Drill Schedule

**Q1:** Database failure + restore from backup
**Q2:** Regional outage + failover to standby region
**Q3:** Full environment restore from scratch (Terraform + backups)
**Q4:** Chaos engineering (kill random pods, simulate network partition)

### Database Restore Drill Runbook

**File:** `runbooks/dr-drill-database-restore.md`

```markdown
# DR Drill: Database Restore

## Objective
Validate that we can restore the database from backup within our RPO/RTO targets.

## Pre-Drill Checklist
- [ ] Notify team (this is a drill, not a real incident)
- [ ] Take fresh backup before drill
- [ ] Prepare isolated environment (do NOT touch production)

## Drill Steps

### 1. Simulate Database Failure
```bash
# Terminate database instance (in test environment only!)
kubectl delete pod postgres-0 -n omnihub-staging
```

### 2. Identify Latest Backup
```bash
# List backups
gcloud sql backups list --instance=omnihub-db-staging

# Or AWS:
aws rds describe-db-snapshots --db-instance-identifier omnihub-db-staging
```

### 3. Restore from Backup
```bash
# GCP
gcloud sql backups restore BACKUP_ID \
  --backup-instance=omnihub-db-staging \
  --backup-instance=omnihub-db-staging

# AWS
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier omnihub-db-restored \
  --db-snapshot-identifier SNAPSHOT_ID
```

### 4. Verify Data Integrity
```sql
-- Connect to restored database
psql -h restored-db-endpoint -U omnihub

-- Check row counts
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'workflows', COUNT(*) FROM workflows
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;

-- Check latest records
SELECT MAX(created_at) FROM audit_logs;
```

### 5. Measure RPO/RTO
- **RPO (Recovery Point Objective):** How much data was lost? (difference between backup timestamp and "failure" timestamp)
- **RTO (Recovery Time Objective):** How long did restore take? (from step 1 to step 4 completion)

### 6. Document Results
- Actual RPO: [X minutes]
- Actual RTO: [Y minutes]
- Target RPO: 15 minutes
- Target RTO: 1 hour
- Pass/Fail: [PASS if within targets]

## Post-Drill
- [ ] Tear down restored environment
- [ ] Document any issues encountered
- [ ] Update restore procedure if needed
- [ ] Report results to SRE team
```

---

## CAPACITY PLANNING

### Growth Projections

| Metric | Current | 6 Months | 12 Months | Scaling Trigger |
|--------|---------|----------|-----------|-----------------|
| **Users** | 10,000 | 50,000 | 200,000 | At 80% capacity, add resources |
| **Requests/sec** | 100 | 500 | 2,000 | At 70% CPU, scale horizontally |
| **Database Size** | 10 GB | 50 GB | 200 GB | At 80% disk, increase storage |
| **Workflows/day** | 1,000 | 5,000 | 20,000 | At 80% executor capacity, scale workers |

### Autoscaling Policies

**Kubernetes HPA (Horizontal Pod Autoscaler):**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

**Database Autoscaling:**
- AWS RDS: Enable storage autoscaling (max 500 GB)
- GCP Cloud SQL: Enable automatic storage increase
- Monitor IOPS utilization, upgrade instance class if > 80%

---

## TOIL REDUCTION

**Toil:** Repetitive, manual, automatable work that doesn't provide enduring value.

### Current Toil Inventory (VERIFIED from Recon)

| Toil Task | Frequency | Time per Occurrence | Automation Opportunity |
|-----------|-----------|---------------------|------------------------|
| Manual edge function deployment | 5x/week | 10 min | ✅ Add to CI/CD pipeline |
| Checking approval queue manually | Daily | 5 min | ✅ Add dashboard widget + alert |
| Investigating DLQ messages | 2x/week | 30 min | ✅ Add DLQ replay tool |
| Database migration on staging | Weekly | 15 min | ✅ Automate in CD pipeline |
| Checking blockchain sync status | Daily | 5 min | ✅ Add blockchain health dashboard |

### Toil Reduction Goals
- **Target:** < 30% of SRE time spent on toil (Google SRE standard)
- **Measure:** Track toil hours in each sprint
- **Action:** Prioritize automation for highest-frequency toil

---

## SUMMARY

**SLO Targets:**
- 99.9% availability (40 min/month downtime budget)
- P95 latency < 500ms
- 95% workflow success rate

**Alert Philosophy:**
- Page only for SLO violations or imminent violations
- Slack for warnings
- Email for daily summaries

**Runbooks:**
- Every critical alert must have a runbook
- Runbooks must be tested during drills
- Update runbooks after every incident

**DR Drills:**
- Quarterly drills
- RPO target: 15 minutes
- RTO target: 1 hour

**Next Steps:**
1. Implement Prometheus + Grafana (or Datadog)
2. Create dashboards (SLO, operator, infrastructure)
3. Configure alerts (error budget burn rate, service down, etc.)
4. Write runbooks for all critical alerts
5. Schedule first DR drill

---

**Document Status:** ✅ COMPLETE
**Next:** CI/CD Pipeline Design, Disaster Recovery Plan, Terraform IaC
