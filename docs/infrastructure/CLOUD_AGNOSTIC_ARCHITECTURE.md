# OMNIHUB CLOUD-AGNOSTIC ARCHITECTURE
**Global-Grade Infrastructure Blueprint for OmniHub/TradeLine/APEX**

**Document Version:** 1.0
**Created:** 2026-01-02
**Status:** Architecture Design (Awaiting Operator Approval)

---

## EXECUTIVE SUMMARY

This document defines a **cloud-agnostic reference architecture** for OmniHub/TradeLine/APEX as a universal "intent → verified execution" platform. The architecture prioritizes:

- **Operator Supremacy:** Human-in-the-loop controls, emergency stop mechanisms
- **Zero Trust Security:** No implicit trust, least privilege, network segmentation
- **Reliability by Default:** SRE discipline with SLIs/SLOs, fault isolation, continuous testing
- **Reversibility:** All changes rollback-safe, infrastructure as code
- **Optional by Default:** OmniHub port can be disabled, system degrades gracefully

---

## ARCHITECTURE PRINCIPLES

### 1. OPERATOR SUPREMACY (Non-Negotiable)

**Emergency Controls (Global Kill Switches):**

| Control | Purpose | Implementation | Location |
|---------|---------|----------------|----------|
| `OMNIHUB_KILL_SWITCH` | Disable integration port globally | Environment flag, circuit breaker | Edge/API Gateway |
| `EXECUTION_SAFE_MODE` | Advisory-only, no side effects | Feature flag + decorator pattern | Application layer |
| `OPERATOR_TAKEOVER` | Require approval for all executions | Approval queue + manual gates | Orchestrator service |

**Approval Checkpoints:**
- Production deploys (canary/blue-green)
- Traffic shifting (> 10% traffic)
- DNS changes
- IAM/policy changes
- Database failover/migrations
- Key/encryption rotation
- Resource deletion
- Enabling new egress paths
- Installing infrastructure agents

### 2. ZERO TRUST SECURITY

**Identity & Access:**
- No implicit trust between services
- Mutual TLS (mTLS) for service-to-service communication
- Short-lived tokens (< 1 hour TTL)
- Least privilege IAM roles

**Network Segmentation:**
```
┌─────────────────────────────────────────────────────────┐
│ PUBLIC INTERNET                                         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ EDGE LAYER (CDN + WAF + DDoS Protection)               │
│ - Cloudflare / AWS CloudFront / GCP Cloud CDN          │
│ - Rate limiting, bot detection                         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ FRONTEND DMZ (Public Subnet)                           │
│ - Static assets (React SPA)                            │
│ - No direct backend access                             │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ API GATEWAY (Policy Decision/Enforcement Point)        │
│ - Authentication (JWT verification)                    │
│ - Authorization (scope/tenant checks)                  │
│ - Rate limiting (distributed, Redis-backed)            │
│ - Request logging (trace IDs)                          │
└───────────────────┬─────────────────────────────────────┘
                    │
            ┌───────┴────────┐
            ▼                ▼
┌─────────────────┐  ┌──────────────────┐
│ ORCHESTRATOR    │  │ READ-ONLY API    │
│ (Private Subnet)│  │ (Public Subnet)  │
│ - Intent parsing│  │ - Query endpoints│
│ - Approval queue│  │ - Analytics      │
│ - Workflow mgmt │  │                  │
└────────┬────────┘  └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ EXECUTION LAYER (Private Subnet - NO INTERNET ACCESS)  │
│ - Workers/executors                                     │
│ - Egress via NAT Gateway (allowlist-only)             │
│ - Network policies: deny-all-by-default                │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ DATA LAYER (Private Subnet - Isolated)                 │
│ - PostgreSQL (primary data store)                      │
│ - Redis (cache, rate limiting, queues)                 │
│ - Secrets Manager (KMS-encrypted)                      │
│ - No public endpoints                                   │
└─────────────────────────────────────────────────────────┘
```

**Egress Control:**
- Executor subnet: No internet access by default
- Approved egress: NAT Gateway with domain allowlist
- Audit all outbound connections

### 3. LLM/AGENT SAFETY AT INFRASTRUCTURE LEVEL

**Prompt Injection Blast Radius Reduction:**

1. **Constrained Permissions:**
   - Executors run with minimal IAM roles
   - Read-only access by default
   - Write operations require approval escalation

2. **Isolation:**
   - Each execution in isolated sandbox (container/function)
   - No shared state between executions
   - Ephemeral compute (destroyed after execution)

3. **Approval Gates:**
   - High-risk operations (DELETE, DROP, transfer funds) → approval queue
   - Approval metadata: who, what, why, risk score
   - Timeout on pending approvals (auto-reject after 1 hour)

4. **Audit Trail:**
   - All inputs logged (sanitized for PII)
   - All outputs logged
   - Correlation ID end-to-end
   - Immutable append-only log storage

**Safety Layers:**
```
User Input → Content Filter → Intent Parser → Risk Scorer → Approval Queue
                                                                  │
                                                                  ▼
                                                        (if approved)
                                                                  │
                                                                  ▼
           Executor (sandboxed) → Action → Verification → Commit/Rollback
```

---

## SERVICE ARCHITECTURE (Cloud-Agnostic)

### Core Services

#### 1. EDGE / API GATEWAY
**Responsibilities:**
- TLS termination
- Authentication (JWT validation, Web3 signature verification)
- Authorization (tenant isolation, scope checks)
- Rate limiting (distributed, SLO-aware)
- Request routing
- Audit logging (all requests)

**Technology Options:**
- **Serverless:** Cloudflare Workers, AWS API Gateway, GCP Cloud Endpoints
- **Containerized:** Kong, Envoy Proxy, NGINX + Lua
- **Managed:** AWS App Runner, GCP Cloud Run with Cloud Load Balancing

**Health Endpoints:**
- `GET /health` → 200 OK (basic liveness)
- `GET /health/deep` → 200 OK + dependency checks (DB, Redis, secrets manager)
- `GET /health/omn` → OmniHub port status (disabled/ok/error, last sync, queue depth)

**Metrics:**
- Request rate (req/sec)
- Error rate (4xx, 5xx as % of total)
- P50/P95/P99 latency
- Rate limit rejections
- Auth failures (by reason)

#### 2. ORCHESTRATOR SERVICE
**Responsibilities:**
- Intent parsing (user input → structured workflow)
- Approval queue management
- Workflow state machine
- Executor dispatching
- Result aggregation

**State Management:**
- Workflow state: PostgreSQL (durable)
- Active workflows: Redis (fast access)
- Event sourcing pattern (append-only log of state changes)

**Approval Queue:**
```sql
CREATE TABLE approval_queue (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,  -- JSON: what will be executed
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  blast_radius TEXT NOT NULL,  -- affected resources
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  audit_log JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

**Emergency Controls:**
```typescript
// Global feature flags (checked on every execution)
interface EmergencyControls {
  OMNIHUB_KILL_SWITCH: boolean;        // If true, reject all workflows
  EXECUTION_SAFE_MODE: boolean;        // If true, advisory only (no side effects)
  OPERATOR_TAKEOVER: boolean;          // If true, require manual approval for ALL
  ALLOWED_OPERATIONS: string[];        // Allowlist of permitted operations
}

// Loaded from secrets manager, cached for 60 seconds
const controls = await getEmergencyControls();

if (controls.OMNIHUB_KILL_SWITCH) {
  throw new Error("OMNIHUB_KILL_SWITCH enabled - all operations disabled");
}
```

**Technology Options:**
- **Serverless:** AWS Lambda + Step Functions, GCP Cloud Functions + Workflows
- **Containerized:** Node.js/Python app on K8s, Temporal workflow engine

#### 3. EXECUTOR / WORKER POOL
**Responsibilities:**
- Execute individual actions (API calls, blockchain transactions, file operations)
- Idempotency enforcement (via idempotency keys)
- Retry with exponential backoff
- Timeout enforcement
- Result reporting

**Isolation Model:**
- Each execution in separate process/container
- No shared memory
- No persistent state (stateless)
- Max execution time: 5 minutes (configurable)

**Idempotency:**
```typescript
interface ExecutionRequest {
  idempotency_key: string;  // UUID, unique per action
  action: string;           // e.g., "transfer_nft", "send_email"
  params: Record<string, unknown>;
  trace_id: string;         // Correlation ID
}

// Before execution, check if already processed
const existing = await redis.get(`exec:${idempotency_key}`);
if (existing) {
  return JSON.parse(existing);  // Return cached result
}

// Execute action
const result = await executeAction(action, params);

// Cache result for 24 hours
await redis.set(`exec:${idempotency_key}`, JSON.stringify(result), 'EX', 86400);
```

**Retry Strategy:**
- Transient errors (network timeout): Retry up to 3 times, exponential backoff (1s, 2s, 4s)
- Permanent errors (400 Bad Request): No retry, mark as failed
- DLQ: After max retries, send to Dead Letter Queue for manual investigation

**Technology Options:**
- **Serverless:** AWS Lambda (isolated by design), GCP Cloud Run Jobs
- **Containerized:** Kubernetes Jobs, AWS ECS Fargate Tasks

#### 4. EVENT BUS / MESSAGE QUEUE
**Responsibilities:**
- Decouple orchestrator from executors
- Guarantee at-least-once delivery
- Preserve message ordering (where needed)
- Dead Letter Queue for failures
- Replay capability (for debugging/recovery)

**Queue Structure:**
```
┌─────────────────┐
│ Orchestrator    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Primary Queue                   │
│ - workflow_events               │
│ - executor_tasks                │
│ - approval_notifications        │
└────────┬────────────────────────┘
         │
         ├─────────────────────┐
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│ Executor Pool   │   │ Notification    │
│ (Workers)       │   │ Service         │
└────────┬────────┘   └─────────────────┘
         │
         ▼ (on failure after max retries)
┌─────────────────────────────────┐
│ Dead Letter Queue (DLQ)         │
│ - Manual investigation required │
│ - Alerting triggers             │
└─────────────────────────────────┘
```

**Message Schema:**
```typescript
interface QueueMessage {
  message_id: string;          // UUID
  trace_id: string;            // Correlation ID (flows through entire system)
  idempotency_key: string;     // For deduplication
  timestamp: string;           // ISO 8601
  event_type: string;          // e.g., "execute_action", "approval_needed"
  payload: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
}
```

**Exactly-Once-Like Semantics:**
- **Outbox Pattern (for message publishing):**
  ```sql
  -- Transaction: Insert into DB + outbox
  BEGIN;
    INSERT INTO workflows (...) VALUES (...);
    INSERT INTO outbox (message_id, queue_name, payload) VALUES (...);
  COMMIT;

  -- Background worker polls outbox, publishes to queue, marks as sent
  ```

- **Inbox Pattern (for message consumption):**
  ```typescript
  // Before processing, check if already processed
  const processed = await db.query(
    'SELECT 1 FROM inbox WHERE message_id = $1',
    [message.message_id]
  );

  if (processed.rows.length > 0) {
    return; // Already processed, skip
  }

  // Process message + insert into inbox (in transaction)
  await db.transaction(async (tx) => {
    await processMessage(message, tx);
    await tx.query(
      'INSERT INTO inbox (message_id, processed_at) VALUES ($1, NOW())',
      [message.message_id]
    );
  });
  ```

**Technology Options:**
- **Cloud-Native:** AWS SQS + SNS, GCP Pub/Sub, Azure Service Bus
- **Self-Hosted:** RabbitMQ, Apache Kafka, NATS
- **Serverless:** Upstash (Redis-based)

#### 5. DATA STORES

**Primary Database: PostgreSQL**
- Relational data (users, profiles, workflows, audit logs)
- ACID guarantees
- Row-level security (RLS) for tenant isolation
- Read replicas for scaling read-heavy workloads

**Cache Layer: Redis**
- Session storage
- Rate limiting state (distributed counters)
- Idempotency key cache
- Execution result cache
- Queue backend (optional)

**Secrets Manager**
- KMS-encrypted at rest
- Audit log of all access
- Automatic rotation (90-day cycle)
- Version history (rollback capability)

**Blob Storage**
- User uploads
- Backups
- Audit logs (long-term retention)

**Blockchain State Cache**
- NFT ownership cache (5-minute TTL)
- Transaction status cache

**Technology Options:**

| Store Type | Serverless | Containerized | Multi-Cloud |
|------------|-----------|---------------|-------------|
| PostgreSQL | Supabase, AWS RDS Serverless, GCP Cloud SQL | Self-hosted on K8s, Crunchy Data | CockroachDB, YugabyteDB |
| Redis | Upstash, AWS ElastiCache Serverless | Redis on K8s | Redis Enterprise |
| Secrets | AWS Secrets Manager, GCP Secret Manager | HashiCorp Vault | 1Password, Doppler |
| Blob | Supabase Storage, AWS S3, GCP Cloud Storage | MinIO on K8s | Cloudflare R2 |

#### 6. OBSERVABILITY STACK

**Logs:**
- Structured JSON logs (trace_id, user_id, workflow_id, timestamp, level, message)
- Centralized aggregation
- PII redaction (automatic)
- Retention: 30 days hot, 1 year cold

**Metrics:**
- Time-series data (Prometheus format)
- Custom metrics (workflow success rate, approval queue depth, DLQ size)
- Infrastructure metrics (CPU, memory, disk, network)

**Traces:**
- Distributed tracing (OpenTelemetry)
- Trace ID flows through: API Gateway → Orchestrator → Queue → Executor
- Span tags: user_id, tenant_id, operation_name

**Dashboards:**
- SLO dashboard (error budget burn rate)
- Operator dashboard (approval queue, active workflows, emergency controls status)
- Infrastructure dashboard (resource utilization)

**Alerting:**
- SLO-based alerts (error budget burn rate > threshold)
- Anomaly detection (sudden traffic spikes, error rate increases)
- Dead Letter Queue alerts (non-empty DLQ)
- Security alerts (auth failures > threshold, WAF blocks)

**Technology Options:**
- **All-in-One:** Datadog, New Relic, Dynatrace
- **Open Source:** Prometheus + Grafana + Loki + Tempo, Elastic Stack
- **Cloud-Native:** AWS CloudWatch, GCP Cloud Monitoring + Logging, Azure Monitor

---

## DEPLOYMENT TOPOLOGY (CLOUD-AGNOSTIC)

### STAGING ENVIRONMENT (Production-Parity)

**Requirements:**
- Identical topology to production
- Same SLOs (availability, latency)
- Synthetic data (no real customer data)
- Isolated from production (separate accounts/projects)

**Deployment:**
```
┌─────────────────────────────────────────────────────────┐
│ STAGING ENVIRONMENT (Production-Parity)                │
│                                                         │
│ ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│ │ Edge/CDN    │  │ API Gateway  │  │ Orchestrator  │  │
│ │ (Cloudflare)│→ │ (Same as Prod)│→│ (Same as Prod)│  │
│ └─────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Executor Pool (2 workers, prod has 10+)        │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│ │ PostgreSQL  │  │ Redis        │  │ Secrets Mgr   │  │
│ │ (smaller)   │  │ (smaller)    │  │ (same keys)   │  │
│ └─────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│ Observability: Same stack, separate dashboards        │
└─────────────────────────────────────────────────────────┘
```

**Smoke Tests (Run on Every Deploy to Staging):**
1. Health check endpoints return 200 OK
2. Auth flow: Get JWT token, validate
3. Web3 flow: Verify wallet signature
4. Workflow flow: Submit simple intent, verify execution
5. Approval flow: Submit high-risk intent, verify approval required
6. Emergency controls: Set KILL_SWITCH, verify rejection
7. Observability: Check logs, metrics, traces appear

**Promotion Criteria (Staging → Prod):**
- All smoke tests pass
- No critical security vulnerabilities (Snyk scan)
- No failing unit/integration tests
- Performance benchmarks within SLO (p95 latency < 500ms)
- Manual QA sign-off
- Change request approved (for prod-impacting changes)

### PRODUCTION ENVIRONMENT (Blue-Green Deployment)

**Blue-Green Strategy:**
```
┌─────────────────────────────────────────────────────────┐
│ PRODUCTION ENVIRONMENT                                  │
│                                                         │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Router (DNS or Load Balancer)                   │    │
│ │ - Routes 100% traffic to ACTIVE environment     │    │
│ └────────┬────────────────────────────────────────┘    │
│          │                                              │
│          ├──────────────────────┬────────────────────── │
│          ▼                      ▼                       │
│ ┌─────────────────┐    ┌─────────────────┐            │
│ │ BLUE (ACTIVE)   │    │ GREEN (STANDBY) │            │
│ │ Version: v1.2.3 │    │ Version: v1.2.4 │            │
│ │                 │    │                 │            │
│ │ API Gateway     │    │ API Gateway     │            │
│ │ Orchestrator    │    │ Orchestrator    │            │
│ │ Executors (10)  │    │ Executors (10)  │            │
│ └─────────────────┘    └─────────────────┘            │
│          │                      │                       │
│          └──────────────────────┘                       │
│                     │                                   │
│                     ▼                                   │
│          ┌────────────────────┐                        │
│          │ Shared Data Layer  │                        │
│          │ - PostgreSQL       │                        │
│          │ - Redis            │                        │
│          └────────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

**Deployment Process:**

1. **Pre-Deploy Validation (Automated):**
   - All staging smoke tests passed
   - Security scan clean
   - Database migrations tested on staging
   - Rollback plan documented

2. **Deploy to GREEN (Standby):**
   - Deploy new version to GREEN environment
   - Run smoke tests against GREEN
   - Validate health endpoints
   - **Checkpoint:** Operator approval required to proceed

3. **Canary Traffic (5% for 15 minutes):**
   - Route 5% of traffic to GREEN
   - Monitor error rates, latency, success metrics
   - Compare to BLUE (baseline)
   - **Automated Rollback Trigger:** If error rate > 2x baseline OR p95 latency > 1.5x baseline

4. **Progressive Rollout (if canary succeeds):**
   - 10% → 25% → 50% → 100% traffic to GREEN
   - Each step: 15-minute observation period
   - **Checkpoint:** Operator can pause or rollback at any step

5. **Finalize:**
   - 100% traffic on GREEN
   - Mark GREEN as ACTIVE, BLUE as STANDBY
   - Keep BLUE running for 24 hours (quick rollback capability)
   - After 24 hours, tear down BLUE (or repurpose as staging)

**Emergency Rollback:**
```bash
# One-command rollback (routes all traffic back to BLUE)
./scripts/emergency-rollback.sh

# Expected time: < 60 seconds
# No database rollback (migrations must be backward-compatible)
```

### PRODUCTION ENVIRONMENT (Canary Deployment - Alternative)

**Canary Strategy (for smaller changes):**
```
┌─────────────────────────────────────────────────────────┐
│ Load Balancer (Weighted Routing)                       │
│ - 95% → STABLE (v1.2.3)                                │
│ -  5% → CANARY (v1.2.4)                                │
└────────┬──────────────────────────────────────────┬────┘
         │                                          │
         ▼                                          ▼
┌─────────────────┐                      ┌─────────────────┐
│ STABLE POOL     │                      │ CANARY POOL     │
│ (10 instances)  │                      │ (1 instance)    │
│ Version: v1.2.3 │                      │ Version: v1.2.4 │
└─────────────────┘                      └─────────────────┘
```

**Use Canary When:**
- Small code changes (bug fixes, minor features)
- Low-risk deployments
- Gradual validation needed

**Use Blue-Green When:**
- Major version changes
- Database schema changes
- Infrastructure changes (new services, dependencies)

---

## DISASTER RECOVERY & BUSINESS CONTINUITY

### Backup Strategy

**Database Backups:**
- **Frequency:** Continuous (point-in-time recovery)
- **Retention:** 30 days
- **Storage:** Cross-region (separate from primary)
- **Verification:** Automated restore test weekly
- **RPO:** 15 minutes (max data loss)

**Configuration Backups:**
- Infrastructure as Code (Terraform state)
- Application configs (Git-versioned)
- Secrets (encrypted backups in separate vault)

**Audit Log Backups:**
- Immutable append-only storage
- 7-year retention (compliance)
- Write-once-read-many (WORM) storage

### Restore Procedures

**Database Restore:**
```bash
# Restore to point-in-time (15 minutes ago)
terraform apply -var="restore_to_time=2026-01-02T10:30:00Z"

# Estimated time: 10-30 minutes (depends on DB size)
# RTO target: < 1 hour
```

**Full Environment Restore (Disaster Recovery):**
```bash
# 1. Restore infrastructure (Terraform)
cd terraform/production
terraform init
terraform apply -auto-approve

# 2. Restore database from backup
./scripts/restore-database.sh --backup-id=latest

# 3. Restore secrets from backup vault
./scripts/restore-secrets.sh

# 4. Deploy latest application code
./scripts/deploy-production.sh

# 5. Validate
./scripts/smoke-tests.sh --env=production

# Total RTO: < 2 hours (target)
```

### Region Failure Strategy

**Multi-Region Architecture (Optional - for global scale):**

```
┌──────────────────┐          ┌──────────────────┐
│ US-EAST-1        │          │ EU-WEST-1        │
│ (PRIMARY)        │◄────────►│ (STANDBY)        │
│                  │          │                  │
│ PostgreSQL       │  Async   │ PostgreSQL       │
│ (Read-Write)     │  Replic. │ (Read-Only)      │
└──────────────────┘          └──────────────────┘
         │                             │
         └──────────┬──────────────────┘
                    │
                    ▼
         ┌────────────────────┐
         │ Global DNS (Route53/CloudDNS) │
         │ - Health checks                │
         │ - Automatic failover           │
         └────────────────────┘
```

**Failover Process:**
1. Primary region failure detected (health check fails for 2 minutes)
2. DNS automatically routes to standby region
3. Promote standby database to read-write
4. Alert on-call engineer
5. Investigate primary region, restore when healthy

**RTO:** < 10 minutes (automated failover)
**RPO:** < 5 minutes (replication lag)

**Failover Test:** Quarterly chaos engineering drill

---

## SECURITY BASELINE

### WAF (Web Application Firewall)

**Rules:**
- OWASP Top 10 protection
- SQL injection detection
- XSS detection
- Rate limiting (per IP, per user)
- Bot detection (challenge on suspicious patterns)
- Geographic restrictions (if needed)

**Technology:** Cloudflare WAF, AWS WAF, GCP Cloud Armor

### TLS Configuration

**Minimum TLS Version:** 1.2 (prefer 1.3)
**Cipher Suites:** Modern ciphers only (no RC4, 3DES)
**HSTS:** Enabled (max-age=31536000, includeSubDomains)
**Certificate:** Automated renewal (Let's Encrypt or cloud-native)

### Network Security

**Segmentation:**
- Public subnet: CDN, load balancer
- Private subnet (API Gateway): Can talk to orchestrator
- Private subnet (Orchestrator): Can talk to queue, database
- Private subnet (Executors): No internet, only via NAT (allowlist-only)
- Private subnet (Data): No internet, only service-to-service

**Firewall Rules:**
- Default deny all
- Allow only required ports (443 for HTTPS, 5432 for PostgreSQL, etc.)
- Service-to-service: mTLS or VPC peering

### Supply Chain Security

**Dependency Scanning:**
- Snyk, Dependabot, or Trivy
- Scan on every PR
- Block merge if critical vulnerabilities

**Container Image Scanning:**
- Scan base images
- No secrets in images
- Minimal base images (distroless or Alpine)

**Signed Artifacts:**
- Sign container images (Cosign)
- Verify signatures before deployment

### Backup Verification

**Automated Restore Drills:**
- Weekly: Restore database to isolated environment
- Monthly: Full environment restore drill
- Alerts if restore fails

**Backup Monitoring:**
- Alert if backup job fails
- Alert if backup size changes > 20% (data loss or corruption)

---

## COST OPTIMIZATION (OPTIONAL)

**Right-Sizing:**
- Monitor resource utilization
- Downsize over-provisioned instances
- Auto-scaling policies (scale to zero when idle)

**Reserved Capacity:**
- Reserve 1-year or 3-year instances for steady-state workload (30-50% cost savings)

**Spot Instances / Preemptible VMs:**
- Use for non-critical batch jobs
- Not for production API services

**Data Transfer Costs:**
- Use CDN to reduce origin load
- Compress assets (gzip, Brotli)
- Minimize cross-region data transfer

---

## COMPLIANCE & GOVERNANCE (OPTIONAL)

**GDPR Compliance (if EU users):**
- Data residency controls (EU data in EU region)
- Right to erasure (automated user data deletion)
- Data processing agreements

**SOC 2 Type II (if enterprise customers):**
- Audit logging
- Access controls
- Incident response procedures
- Regular security audits

**PCI-DSS (if handling payments):**
- Tokenize card data
- No storage of CVV
- Network segmentation
- Quarterly vulnerability scans

---

## OPERATOR CONTROLS (ENFORCEMENT)

### Emergency Control Panel (Admin UI)

**Features:**
- View emergency control states (KILL_SWITCH, SAFE_MODE, TAKEOVER)
- Toggle controls with reason + audit log
- View approval queue
- View active workflows
- Force-cancel workflows
- View DLQ messages
- Manually retry DLQ messages

**Access Control:**
- MFA required
- Role: `operator` or `admin`
- Audit log of all actions

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│ OMNIHUB OPERATOR CONTROL PANEL                          │
├─────────────────────────────────────────────────────────┤
│ EMERGENCY CONTROLS                                      │
│ ┌───────────────────────────────────────────────────┐   │
│ │ ⛔ OMNIHUB_KILL_SWITCH      [ OFF ]  [ENABLE]    │   │
│ │ ⚠️  EXECUTION_SAFE_MODE     [ OFF ]  [ENABLE]    │   │
│ │ 🚨 OPERATOR_TAKEOVER        [ OFF ]  [ENABLE]    │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ SYSTEM STATUS                                           │
│ ┌───────────────────────────────────────────────────┐   │
│ │ Active Workflows: 142                             │   │
│ │ Approval Queue: 7 pending                         │   │
│ │ DLQ Messages: 2 (⚠️ investigate)                  │   │
│ │ Error Rate: 0.12% (✅ within SLO)                │   │
│ │ P95 Latency: 342ms (✅ within SLO)               │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ RECENT AUDIT LOG                                        │
│ [2026-01-02 10:45] operator@apex.dev enabled SAFE_MODE │
│ [2026-01-02 10:30] user@example.com approved workflow  │
│ [2026-01-02 10:15] system auto-rejected expired request│
└─────────────────────────────────────────────────────────┘
```

### Audit Trail

**All Operations Logged:**
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  trace_id UUID NOT NULL,
  actor_id UUID NOT NULL,  -- who performed the action
  actor_type TEXT NOT NULL,  -- 'user', 'operator', 'system'
  action TEXT NOT NULL,      -- 'workflow_created', 'approval_granted', 'emergency_control_enabled'
  resource_type TEXT NOT NULL,  -- 'workflow', 'approval', 'emergency_control'
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,  -- action-specific details
  ip_address INET,
  user_agent TEXT
);

-- Immutable (append-only)
CREATE POLICY audit_log_insert_only ON audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY audit_log_no_delete ON audit_log
  FOR DELETE USING (false);
```

---

## NEXT: IMPLEMENTATION PATHS

See separate documents:
- [PATH A: Enhanced Serverless](./PATH_A_ENHANCED_SERVERLESS.md)
- [PATH B: Containerized Multi-Cloud](./PATH_B_CONTAINERIZED_MULTICLOUD.md)
- [SRE Package (SLIs/SLOs)](./SRE_PACKAGE.md)
- [CI/CD Pipeline Design](./CICD_PIPELINE_DESIGN.md)

---

**Document Status:** ✅ COMPLETE - Awaiting operator review
**Next Step:** Operator selects implementation path (A or B) for IaC generation
