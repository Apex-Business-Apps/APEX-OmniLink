---
name: devops-mastery-v2
description: Omniscient elite engineering command center. Activate for any software development, architecture, infrastructure, security, reliability, optimization, debugging, AI/ML ops, or technical strategy task. Covers full-stack development, multi-cloud infrastructure, incident response, worst-case recovery, and production-grade execution. Triggers on code review, debugging, deployment, security hardening, performance tuning, architecture decisions, CI/CD pipelines, monitoring, alerting, capacity planning, disaster recovery, or any technical execution requiring excellence.
---

# DevOps Mastery v2 — Command Center

> **Omniscient. Omnipotent. Production-Grade. Battle-Tested.**

Elite engineering protocols for absolute technical mastery across all domains: architecture, platform, security, reliability, backend, frontend, optimization, debugging, and AI/ML operations.

---

## TABLE OF CONTENTS

1. [Core Philosophy](#core-philosophy)
2. [Universal Workflow](#universal-workflow)
3. [Execution Protocols](#execution-protocols)
4. [Architecture Mastery](#architecture-mastery)
5. [Platform Engineering](#platform-engineering)
6. [Security Command](#security-command)
7. [Reliability Engineering (SRE)](#reliability-engineering-sre)
8. [Backend Mastery](#backend-mastery)
9. [Frontend Mastery](#frontend-mastery)
10. [Performance Engineering](#performance-engineering)
11. [Debugging Supremacy](#debugging-supremacy)
12. [AI/ML Operations](#aiml-operations)
13. [Worst-Case Protocols](#worst-case-protocols)
14. [Innovation Framework](#innovation-framework)
15. [Quality Gates](#quality-gates)
16. [Quick Reference](#quick-reference)

---

## CORE PHILOSOPHY

### The Three Laws
```
LAW 1: Zero iteration debugging — diagnose once, fix permanently
LAW 2: Production-first thinking — every change is a deployment
LAW 3: Blast radius awareness — know what breaks before you touch it
```

### The Five Virtues
| Virtue | Principle | Anti-Pattern |
|--------|-----------|--------------|
| **Precision** | Surgical changes, minimal diff | Shotgun debugging |
| **Predictability** | Same input → same output, always | Magic and side effects |
| **Observability** | If you can't measure it, don't ship it | Blind deployments |
| **Resilience** | Fail gracefully, recover automatically | Cascade failures |
| **Velocity** | Ship fast by shipping safe | Speed without guardrails |

### Decision Framework — RAPID
```
R — Recommend: Generate ≥3 options with trade-offs
A — Analyze: Score against constraints (time, cost, risk, complexity)
P — Propose: Select optimal path with clear rationale
I — Implement: Execute with rollback plan ready
D — Document: Capture decision context for future reference
```

---

## UNIVERSAL WORKFLOW

### Standard Execution Cycle
```
┌────────────────────────────────────────────────────────────────┐
│  SCOUT → DIAGNOSE → DESIGN → IMPLEMENT → VALIDATE → MONITOR   │
│   15%      20%        20%        25%         15%        5%     │
└────────────────────────────────────────────────────────────────┘
```

| Phase | Actions | Outputs |
|-------|---------|---------|
| **SCOUT** | Read code, map dependencies, identify constraints, assess blast radius | Context map, risk assessment |
| **DIAGNOSE** | Trace execution, reproduce issues, profile metrics, find root cause | Root cause analysis, hypothesis |
| **DESIGN** | Evaluate options, select approach, define interfaces, plan rollback | Technical design, implementation plan |
| **IMPLEMENT** | Code with tests, incremental commits, feature flags if risky | Working code, passing tests |
| **VALIDATE** | Integration tests, security scan, performance benchmark, peer review | Quality gate pass |
| **MONITOR** | Deploy with observability, watch metrics, confirm success criteria | Production validation |

### Pre-Flight Checklist (Before ANY Change)
```bash
□ Blast radius understood and acceptable
□ Rollback strategy defined and tested
□ Monitoring in place for affected components
□ Stakeholders notified if production impact possible
□ Change window appropriate for risk level
```

---

## EXECUTION PROTOCOLS

### Protocol A: Bug Fixes
```
1. REPRODUCE → Write failing test that captures the bug
2. ISOLATE   → Trace to minimal code path (use bisect if needed)
3. ANALYZE   → Understand WHY the bug exists, not just WHAT
4. FIX       → Apply minimal, surgical change
5. VERIFY    → Run full test suite + edge cases
6. DOCUMENT  → Add inline comment explaining the gotcha
```

**Anti-Patterns to Avoid:**
- ❌ Fixing symptoms instead of root cause
- ❌ Large refactors disguised as bug fixes
- ❌ Missing regression tests for fixed bugs

### Protocol B: New Features
```
1. SPEC      → Define acceptance criteria with examples
2. DESIGN    → Create interfaces/types BEFORE implementation
3. SCAFFOLD  → Generate structure with tests first (TDD)
4. BUILD     → Implement incrementally with commit checkpoints
5. INTEGRATE → Verify compatibility with existing systems
6. HARDEN    → Add error handling, logging, edge cases
7. SHIP      → Feature flag for gradual rollout
```

**Feature Flag Strategy:**
```typescript
// Feature flags for safe rollout
const FEATURE_FLAGS = {
  NEW_DASHBOARD: {
    enabled: process.env.FF_NEW_DASHBOARD === 'true',
    rolloutPercentage: 10, // Start at 10%, increase gradually
    allowlist: ['beta-testers', 'internal-users']
  }
}
```

### Protocol C: Refactoring
```
1. BASELINE  → Run ALL tests, capture metrics (coverage, perf)
2. IDENTIFY  → Mark refactor boundaries with clear scope
3. SCAFFOLD  → Add characterization tests for existing behavior
4. TRANSFORM → Small steps, one concept at a time
5. VALIDATE  → Re-run tests after EACH change (no batching)
6. MEASURE   → Compare metrics to baseline
7. DOCUMENT  → Update architecture docs if structure changed
```

**Safe Refactoring Patterns:**
- Extract Method → Extract Class → Extract Module
- Rename with IDE refactoring tools (not find/replace)
- Parallel implementation with feature flag switch

### Protocol D: Performance Optimization
```
1. BASELINE  → Profile with production-like data (NEVER synthetic only)
2. IDENTIFY  → Find the actual bottleneck (Amdahl's Law)
3. HYPOTHESIZE → Form theory about 2x improvement opportunity
4. EXPERIMENT → Implement change in isolated branch
5. BENCHMARK → Measure with statistical rigor (p95, p99)
6. VALIDATE  → Ensure no regression in other dimensions
7. SHIP      → Deploy with before/after dashboards
```

**Golden Rule:** Never optimize without profiling first. The bottleneck is rarely where you think it is.

### Protocol E: Incident Response
```
1. TRIAGE    → Assess severity (P0-P4), page appropriate responders
2. MITIGATE  → Stop the bleeding (rollback, feature flag, traffic shift)
3. DIAGNOSE  → Find root cause with structured investigation
4. FIX       → Apply minimal fix to restore service
5. VALIDATE  → Confirm resolution with synthetic checks
6. POSTMORTEM → Document timeline, root cause, action items (blameless)
```

**Severity Matrix:**
| Level | Impact | Response Time | Responders |
|-------|--------|---------------|------------|
| P0 | Service down, data loss | <5min | All hands |
| P1 | Major feature broken | <15min | On-call + lead |
| P2 | Degraded experience | <1hr | On-call |
| P3 | Minor issue | <24hr | Next business day |
| P4 | Cosmetic/minor | Sprint | Backlog |

### Protocol F: Security Response
```
1. CONTAIN   → Isolate affected systems immediately
2. ASSESS    → Determine scope of compromise
3. ERADICATE → Remove threat actor access
4. RECOVER   → Restore from known-good state
5. HARDEN    → Implement controls to prevent recurrence
6. REPORT    → Notify stakeholders per compliance requirements
```

---

## ARCHITECTURE MASTERY

### System Design Principles

#### Scalability Patterns
```
HORIZONTAL SCALING
├── Stateless services (session in Redis/JWT)
├── Database read replicas for read-heavy workloads
├── Sharding for write-heavy workloads
└── CDN for static content

VERTICAL SCALING
├── Right-size instances based on profiling
├── Memory optimization before adding RAM
└── CPU optimization before adding cores

ELASTIC SCALING
├── Auto-scaling based on metrics (CPU, memory, queue depth)
├── Predictive scaling for known traffic patterns
└── Cool-down periods to prevent thrashing
```

#### Resilience Patterns
```typescript
// Circuit Breaker Pattern
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,        // Open after 5 failures
  resetTimeout: 30000,        // Try again after 30s
  monitorInterval: 10000,     // Check health every 10s
  fallback: () => cachedData  // Graceful degradation
})

// Retry with Exponential Backoff
const retry = async (fn, maxAttempts = 3) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i === maxAttempts - 1) throw e
      await sleep(Math.pow(2, i) * 1000 + Math.random() * 1000)
    }
  }
}

// Bulkhead Pattern
const bulkhead = new Bulkhead({
  maxConcurrent: 10,          // Max concurrent requests
  maxQueue: 100,              // Max queued requests
  queueTimeout: 5000          // Queue timeout
})
```

#### Data Architecture Patterns
```
EVENT SOURCING
├── All state changes as immutable events
├── Rebuild state by replaying events
├── Natural audit trail
└── Time-travel debugging

CQRS (Command Query Responsibility Segregation)
├── Separate read and write models
├── Optimize each for its use case
├── Eventually consistent reads
└── Strongly consistent writes

SAGA PATTERN (Distributed Transactions)
├── Choreography: Events trigger next steps
├── Orchestration: Central coordinator
├── Compensating transactions for rollback
└── Idempotent operations required
```

### API Design Excellence

#### REST API Standards
```yaml
# OpenAPI 3.1 Specification Template
openapi: 3.1.0
info:
  title: API Name
  version: 1.0.0
paths:
  /v1/resources:
    get:
      summary: List resources
      parameters:
        - name: cursor
          in: query
          schema: { type: string }
        - name: limit
          in: query
          schema: { type: integer, default: 20, maximum: 100 }
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Resource' } }
                  pagination: { $ref: '#/components/schemas/Pagination' }
```

#### GraphQL Standards
```graphql
# Schema-first design with strong typing
type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
}

# Use connections for pagination
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

# Error handling in payload
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}
```

#### gRPC Standards
```protobuf
syntax = "proto3";

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc ListUsers(ListUsersRequest) returns (stream User);  // Server streaming
  rpc CreateUsers(stream CreateUserRequest) returns (CreateUsersResponse);  // Client streaming
}

message GetUserRequest {
  string user_id = 1;
  FieldMask field_mask = 2;  // Partial responses
}
```

### Database Design Excellence

#### Schema Design Principles
```sql
-- Normalized design (3NF minimum for OLTP)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategic indexing
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_orders_user_created 
    ON orders(user_id, created_at DESC) 
    INCLUDE (total_amount);  -- Covering index

-- Partitioning for scale
CREATE TABLE events (
    id UUID,
    event_type VARCHAR(50),
    created_at TIMESTAMPTZ,
    payload JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2025_q1 PARTITION OF events
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
```

#### Query Optimization
```sql
-- Always explain analyze before optimizing
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.*, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id
ORDER BY order_count DESC
LIMIT 100;

-- Common optimizations:
-- 1. Add covering indexes for frequent queries
-- 2. Use materialized views for expensive aggregations
-- 3. Partition large tables by time or tenant
-- 4. Use connection pooling (PgBouncer, ProxySQL)
-- 5. Implement read replicas for read-heavy workloads
```

---

## PLATFORM ENGINEERING

### Multi-Cloud Strategy

#### Cloud-Agnostic Architecture
```yaml
# Abstract infrastructure with Terraform
variable "cloud_provider" {
  description = "aws | gcp | azure"
  default     = "aws"
}

module "compute" {
  source = "./modules/compute/${var.cloud_provider}"
  
  instance_count = var.instance_count
  instance_type  = local.instance_type_map[var.cloud_provider]
}

# Provider-specific mappings
locals {
  instance_type_map = {
    aws   = "t3.large"
    gcp   = "n1-standard-2"
    azure = "Standard_D2s_v3"
  }
}
```

#### Kubernetes Excellence
```yaml
# Production-grade deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  labels:
    app: api-server
    version: v1.2.3
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        version: v1.2.3
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: api-server
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - name: api-server
          image: registry.example.com/api-server:v1.2.3@sha256:abc123
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 9090
              name: metrics
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: database-url
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: api-config
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: api-server
                topologyKey: kubernetes.io/hostname
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: api-server
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
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
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### CI/CD Pipeline Excellence

#### GitHub Actions Production Pipeline
```yaml
name: Production Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
      - name: Run SAST
        uses: github/codeql-action/analyze@v3

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
      - id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          kubectl set image deployment/api-server \
            api-server=${{ needs.build.outputs.image-tag }} \
            --namespace=staging
      - name: Run smoke tests
        run: npm run test:smoke -- --env=staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy canary (10%)
        run: |
          kubectl set image deployment/api-server-canary \
            api-server=${{ needs.build.outputs.image-tag }} \
            --namespace=production
      - name: Monitor canary (5 minutes)
        run: |
          ./scripts/monitor-canary.sh --duration=300 --error-threshold=0.1
      - name: Promote to production
        run: |
          kubectl set image deployment/api-server \
            api-server=${{ needs.build.outputs.image-tag }} \
            --namespace=production
```

### Infrastructure as Code

#### Terraform Best Practices
```hcl
# terraform/environments/production/main.tf

terraform {
  required_version = ">= 1.6"
  
  backend "s3" {
    bucket         = "terraform-state-prod"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Use modules for reusability
module "vpc" {
  source = "../../modules/vpc"

  environment = "production"
  cidr_block  = "10.0.0.0/16"
  
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  
  tags = local.common_tags
}

module "eks" {
  source = "../../modules/eks"

  cluster_name    = "production-cluster"
  cluster_version = "1.29"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  node_groups = {
    general = {
      instance_types = ["m6i.large"]
      min_size       = 3
      max_size       = 20
      desired_size   = 5
    }
    memory_optimized = {
      instance_types = ["r6i.xlarge"]
      min_size       = 0
      max_size       = 10
      desired_size   = 2
      labels = {
        workload = "memory-intensive"
      }
      taints = [{
        key    = "workload"
        value  = "memory-intensive"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  tags = local.common_tags
}

# Outputs for other modules/pipelines
output "cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = true
}
```

---

## SECURITY COMMAND

### Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                         PERIMETER                               │
│  WAF │ DDoS Protection │ Rate Limiting │ Geo-blocking          │
├─────────────────────────────────────────────────────────────────┤
│                         NETWORK                                 │
│  VPC │ Security Groups │ Network ACLs │ Private Subnets        │
├─────────────────────────────────────────────────────────────────┤
│                         APPLICATION                             │
│  AuthN/AuthZ │ Input Validation │ CSRF │ XSS Protection        │
├─────────────────────────────────────────────────────────────────┤
│                         DATA                                    │
│  Encryption at Rest │ Encryption in Transit │ Key Management   │
├─────────────────────────────────────────────────────────────────┤
│                         MONITORING                              │
│  SIEM │ Audit Logs │ Anomaly Detection │ Incident Response     │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication & Authorization

#### JWT Implementation (Secure)
```typescript
// Secure JWT configuration
import jwt from 'jsonwebtoken'
import { createPrivateKey, createPublicKey } from 'crypto'

const config = {
  algorithm: 'RS256' as const,  // Use asymmetric encryption
  accessTokenExpiry: '15m',      // Short-lived access tokens
  refreshTokenExpiry: '7d',      // Longer refresh tokens
  issuer: 'api.example.com',
  audience: 'example.com'
}

// Generate access token
export const generateAccessToken = (user: User): string => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions
    },
    privateKey,
    {
      algorithm: config.algorithm,
      expiresIn: config.accessTokenExpiry,
      issuer: config.issuer,
      audience: config.audience,
      jwtid: crypto.randomUUID()  // Unique token ID for revocation
    }
  )
}

// Verify token with all checks
export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, publicKey, {
    algorithms: [config.algorithm],
    issuer: config.issuer,
    audience: config.audience,
    complete: true
  }) as TokenPayload
}

// Refresh token rotation (prevents replay attacks)
export const rotateRefreshToken = async (oldToken: string): Promise<TokenPair> => {
  const decoded = verifyToken(oldToken)
  
  // Invalidate old refresh token
  await redis.del(`refresh:${decoded.jti}`)
  
  // Check if token was already used (replay detection)
  const wasUsed = await redis.get(`used:${decoded.jti}`)
  if (wasUsed) {
    // Potential token theft - invalidate all user sessions
    await invalidateAllUserSessions(decoded.sub)
    throw new SecurityError('Refresh token reuse detected')
  }
  
  // Mark as used
  await redis.setex(`used:${decoded.jti}`, 86400, '1')
  
  // Generate new token pair
  return generateTokenPair(decoded.sub)
}
```

#### RBAC + ABAC Hybrid
```typescript
// Role-Based Access Control with Attribute-Based conditions
interface Permission {
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'admin'
  conditions?: Condition[]
}

interface Condition {
  attribute: string
  operator: 'eq' | 'ne' | 'in' | 'gt' | 'lt' | 'contains'
  value: unknown
}

const permissions: Record<string, Permission[]> = {
  admin: [
    { resource: '*', action: 'admin' }
  ],
  manager: [
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'update', conditions: [
      { attribute: 'user.department', operator: 'eq', value: 'context.user.department' }
    ]},
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'create' }
  ],
  user: [
    { resource: 'profile', action: 'read', conditions: [
      { attribute: 'resource.userId', operator: 'eq', value: 'context.user.id' }
    ]},
    { resource: 'profile', action: 'update', conditions: [
      { attribute: 'resource.userId', operator: 'eq', value: 'context.user.id' }
    ]}
  ]
}

// Authorization middleware
export const authorize = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    const userPermissions = permissions[user.role] || []
    
    const hasPermission = userPermissions.some(p => {
      const resourceMatch = p.resource === '*' || p.resource === resource
      const actionMatch = p.action === 'admin' || p.action === action
      
      if (!resourceMatch || !actionMatch) return false
      
      // Evaluate conditions
      if (p.conditions) {
        return p.conditions.every(c => evaluateCondition(c, req))
      }
      
      return true
    })
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    
    next()
  }
}
```

### Input Validation & Sanitization
```typescript
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// Strict input schemas
const createUserSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255)
    .transform(e => e.toLowerCase().trim()),
  
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  
  name: z.string()
    .min(1)
    .max(100)
    .transform(s => DOMPurify.sanitize(s.trim())),
  
  // Prevent prototype pollution
  __proto__: z.never().optional(),
  constructor: z.never().optional()
}).strict()  // Reject unknown fields

// SQL injection prevention with parameterized queries
const getUserOrders = async (userId: string) => {
  // ✅ Always use parameterized queries
  return db.query(
    `SELECT * FROM orders 
     WHERE user_id = $1 
     AND status = ANY($2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, ['pending', 'completed'], 100]
  )
}

// XSS prevention in responses
const sanitizeOutput = (data: unknown): unknown => {
  if (typeof data === 'string') {
    return DOMPurify.sanitize(data)
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeOutput)
  }
  if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, sanitizeOutput(v)])
    )
  }
  return data
}
```

### Security Headers Configuration
```typescript
// Helmet configuration for Express
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'strict-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Consider using nonces
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}))
```

### Secrets Management
```typescript
// AWS Secrets Manager integration
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

class SecretsManager {
  private client: SecretsManagerClient
  private cache: Map<string, { value: string; expiry: number }> = new Map()
  private cacheTTL = 300000 // 5 minutes

  async getSecret(secretId: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(secretId)
    if (cached && cached.expiry > Date.now()) {
      return cached.value
    }

    // Fetch from Secrets Manager
    const command = new GetSecretValueCommand({ SecretId: secretId })
    const response = await this.client.send(command)
    const secret = response.SecretString!

    // Cache the value
    this.cache.set(secretId, {
      value: secret,
      expiry: Date.now() + this.cacheTTL
    })

    return secret
  }

  // Rotate secrets programmatically
  async rotateSecret(secretId: string): Promise<void> {
    // Implementation depends on secret type
    // For database passwords:
    // 1. Create new password
    // 2. Update in Secrets Manager
    // 3. Update in database
    // 4. Clear cache
    this.cache.delete(secretId)
  }
}

// Environment variable security
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_PRIVATE_KEY',
  'ENCRYPTION_KEY'
] as const

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter(v => !process.env[v])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Validate format of sensitive variables
  if (process.env.ENCRYPTION_KEY!.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
}
```

---

## RELIABILITY ENGINEERING (SRE)

### Service Level Objectives (SLOs)

```yaml
# SLO Definition
service: api-server

slos:
  - name: availability
    description: API server should be available 99.9% of the time
    target: 99.9
    window: 30d
    sli:
      type: availability
      good_events: successful_requests
      total_events: total_requests
    alerts:
      - burn_rate: 14.4  # 1-hour budget burn
        window: 1h
        severity: critical
      - burn_rate: 6     # 6-hour budget burn
        window: 6h
        severity: warning

  - name: latency
    description: 99% of requests should complete within 500ms
    target: 99
    window: 30d
    sli:
      type: latency
      threshold: 500ms
      good_events: fast_requests
      total_events: total_requests

  - name: error_rate
    description: Error rate should be below 0.1%
    target: 99.9
    window: 30d
    sli:
      type: error_rate
      good_events: successful_requests
      total_events: total_requests
```

### Observability Stack

#### Metrics (Prometheus)
```yaml
# prometheus/rules/api-server.yml
groups:
  - name: api-server
    rules:
      # Request rate
      - record: api_server:request_rate:5m
        expr: rate(http_requests_total[5m])
      
      # Error rate
      - record: api_server:error_rate:5m
        expr: |
          rate(http_requests_total{status=~"5.."}[5m])
          / rate(http_requests_total[5m])
      
      # Latency percentiles
      - record: api_server:latency_p99:5m
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
      
      # SLO burn rate
      - alert: HighErrorBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          ) > 14.4 * 0.001  # 14.4x burn rate of 0.1% error budget
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error burn rate detected"
          description: "Error budget burning at {{ $value | humanizePercentage }} of monthly budget per hour"
      
      # Saturation alerts
      - alert: HighCPUUsage
        expr: |
          avg(rate(container_cpu_usage_seconds_total{container="api-server"}[5m])) 
          / avg(kube_pod_container_resource_limits{resource="cpu",container="api-server"}) > 0.8
        for: 10m
        labels:
          severity: warning
```

#### Logging (Structured)
```typescript
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      service: 'api-server',
      version: process.env.APP_VERSION
    })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['password', 'token', 'authorization', 'cookie', 'creditCard'],
    censor: '[REDACTED]'
  }
})

// Request logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  
  // Attach to request for correlation
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)
  
  res.on('finish', () => {
    const duration = Date.now() - startTime
    
    logger.info({
      type: 'request',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      // Don't log request body in production (PII concerns)
    })
  })
  
  next()
}

// Error logging
const errorLogger = (error: Error, req: Request) => {
  logger.error({
    type: 'error',
    requestId: req.requestId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Include custom error properties
      ...(error instanceof AppError && {
        code: error.code,
        context: error.context
      })
    }
  })
}
```

#### Distributed Tracing (OpenTelemetry)
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'api-server',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }
    })
  ]
})

sdk.start()

// Manual span creation for business logic
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('api-server')

async function processOrder(orderId: string) {
  return tracer.startActiveSpan('processOrder', async (span) => {
    try {
      span.setAttribute('order.id', orderId)
      
      // Nested span for database operation
      const order = await tracer.startActiveSpan('db.getOrder', async (dbSpan) => {
        try {
          const result = await db.orders.findById(orderId)
          dbSpan.setAttribute('db.rows_affected', 1)
          return result
        } finally {
          dbSpan.end()
        }
      })
      
      // Process order...
      span.setAttribute('order.status', 'processed')
      span.setStatus({ code: SpanStatusCode.OK })
      
      return order
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      })
      span.recordException(error)
      throw error
    } finally {
      span.end()
    }
  })
}
```

### Chaos Engineering
```typescript
// Chaos experiments for resilience testing
const chaosExperiments = {
  // Network latency injection
  latencyInjection: {
    name: 'latency-injection',
    target: 'api-server',
    action: 'network-delay',
    parameters: {
      latency: '500ms',
      jitter: '100ms',
      percentage: 50  // Affect 50% of requests
    },
    duration: '5m',
    steadyStateHypothesis: {
      title: 'API remains available under latency',
      probes: [
        { type: 'http', url: '/health', timeout: '10s', expectStatus: 200 }
      ]
    }
  },

  // Pod termination
  podTermination: {
    name: 'pod-kill',
    target: 'api-server',
    action: 'terminate-pod',
    parameters: {
      count: 1,
      grace_period: 0
    },
    steadyStateHypothesis: {
      title: 'API recovers after pod termination',
      probes: [
        { type: 'http', url: '/health', expectStatus: 200, retries: 10 }
      ]
    }
  },

  // Database failover
  databaseFailover: {
    name: 'db-failover',
    target: 'postgres',
    action: 'trigger-failover',
    steadyStateHypothesis: {
      title: 'API handles database failover',
      probes: [
        { type: 'http', url: '/api/health/db', expectStatus: 200, retries: 30 }
      ]
    }
  }
}
```

---

## BACKEND MASTERY

### Node.js/TypeScript Excellence

#### Project Structure
```
src/
├── api/                    # HTTP layer
│   ├── routes/            # Route definitions
│   ├── middleware/        # Express middleware
│   ├── validators/        # Request validation schemas
│   └── handlers/          # Request handlers
├── domain/                # Business logic (framework-agnostic)
│   ├── entities/          # Domain entities
│   ├── services/          # Business services
│   ├── repositories/      # Repository interfaces
│   └── events/            # Domain events
├── infrastructure/        # External integrations
│   ├── database/          # Database implementations
│   ├── cache/             # Cache implementations
│   ├── queue/             # Message queue implementations
│   └── external/          # Third-party API clients
├── shared/                # Shared utilities
│   ├── errors/            # Custom error classes
│   ├── utils/             # Helper functions
│   └── types/             # Shared TypeScript types
└── config/                # Configuration management
```

#### Type-Safe Configuration
```typescript
// config/index.ts
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.string().transform(Number).default('3000'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.string().transform(Number).default('2'),
  DATABASE_POOL_MAX: z.string().transform(Number).default('10'),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // Auth
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  
  // Feature flags
  FF_NEW_CHECKOUT: z.string().transform(v => v === 'true').default('false')
})

export type Env = z.infer<typeof envSchema>

// Parse and validate at startup
const parseEnv = (): Env => {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    console.error(result.error.format())
    process.exit(1)
  }
  return result.data
}

export const config = parseEnv()
```

#### Dependency Injection
```typescript
// Using TSyringe for DI
import { container, injectable, inject } from 'tsyringe'

// Define interfaces
interface IUserRepository {
  findById(id: string): Promise<User | null>
  save(user: User): Promise<User>
}

interface IEmailService {
  send(to: string, subject: string, body: string): Promise<void>
}

// Implement services
@injectable()
class UserService {
  constructor(
    @inject('UserRepository') private userRepo: IUserRepository,
    @inject('EmailService') private emailService: IEmailService
  ) {}

  async createUser(data: CreateUserDTO): Promise<User> {
    const user = User.create(data)
    await this.userRepo.save(user)
    await this.emailService.send(user.email, 'Welcome!', 'Thanks for joining')
    return user
  }
}

// Register dependencies
container.register<IUserRepository>('UserRepository', { useClass: PostgresUserRepository })
container.register<IEmailService>('EmailService', { useClass: SendGridEmailService })
container.register(UserService, { useClass: UserService })

// Resolve
const userService = container.resolve(UserService)
```

#### Error Handling
```typescript
// Custom error hierarchy
abstract class AppError extends Error {
  abstract readonly statusCode: number
  abstract readonly code: string
  readonly isOperational = true

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      context: this.context
    }
  }
}

class ValidationError extends AppError {
  readonly statusCode = 400
  readonly code = 'VALIDATION_ERROR'
}

class NotFoundError extends AppError {
  readonly statusCode = 404
  readonly code = 'NOT_FOUND'
}

class ConflictError extends AppError {
  readonly statusCode = 409
  readonly code = 'CONFLICT'
}

class UnauthorizedError extends AppError {
  readonly statusCode = 401
  readonly code = 'UNAUTHORIZED'
}

class ForbiddenError extends AppError {
  readonly statusCode = 403
  readonly code = 'FORBIDDEN'
}

// Global error handler
const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof AppError && { context: error.context })
    },
    request: {
      method: req.method,
      path: req.path,
      requestId: req.requestId
    }
  })

  // Operational errors - safe to expose
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.toJSON()
    })
  }

  // Programming errors - hide details
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  })
}
```

### Python Excellence

#### FastAPI Best Practices
```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import structlog

from app.config import settings
from app.database import init_db, close_db
from app.middleware import RequestIdMiddleware, LoggingMiddleware
from app.routes import api_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting application", version=settings.VERSION)
    await init_db()
    yield
    # Shutdown
    logger.info("Shutting down application")
    await close_db()

app = FastAPI(
    title="API Server",
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Middleware (order matters - last added = first executed)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIdMiddleware)

app.include_router(api_router, prefix="/api/v1")

# Health endpoints
@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/health/ready")
async def readiness(db = Depends(get_db)):
    try:
        await db.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not ready"
        )
```

```python
# app/services/user_service.py
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User
from app.schemas import UserCreate, UserUpdate
from app.repositories import UserRepository
from app.exceptions import NotFoundError, ConflictError

class UserService:
    def __init__(self, session: AsyncSession):
        self.repo = UserRepository(session)
    
    async def create_user(self, data: UserCreate) -> User:
        # Check for existing user
        existing = await self.repo.find_by_email(data.email)
        if existing:
            raise ConflictError(f"User with email {data.email} already exists")
        
        # Create user
        user = User(
            email=data.email,
            name=data.name,
            password_hash=hash_password(data.password)
        )
        
        return await self.repo.save(user)
    
    async def get_user(self, user_id: str) -> User:
        user = await self.repo.find_by_id(user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")
        return user
    
    async def update_user(self, user_id: str, data: UserUpdate) -> User:
        user = await self.get_user(user_id)
        
        if data.email and data.email != user.email:
            existing = await self.repo.find_by_email(data.email)
            if existing:
                raise ConflictError(f"Email {data.email} already in use")
        
        for field, value in data.dict(exclude_unset=True).items():
            setattr(user, field, value)
        
        return await self.repo.save(user)
```

---

## FRONTEND MASTERY

### React/TypeScript Excellence

#### Component Architecture
```typescript
// Atomic design pattern with strict typing
// atoms/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost'
  size: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, disabled, children, onClick, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size]
        )}
        disabled={disabled || loading}
        onClick={onClick}
        {...props}
      >
        {loading && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

#### State Management (Zustand + React Query)
```typescript
// Global UI state with Zustand
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  toggleSidebar: () => void
  setTheme: (theme: UIState['theme']) => void
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      immer((set) => ({
        sidebarOpen: true,
        theme: 'system',
        toggleSidebar: () => set((state) => { state.sidebarOpen = !state.sidebarOpen }),
        setTheme: (theme) => set((state) => { state.theme = theme })
      })),
      { name: 'ui-storage' }
    )
  )
)

// Server state with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const useUsers = (filters: UserFilters) => {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => api.users.list(filters),
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 30 * 60 * 1000,    // 30 minutes
  })
}

export const useCreateUser = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.users.create,
    onSuccess: (newUser) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['users'] })
      
      // Or optimistically update
      queryClient.setQueryData(['users'], (old: User[]) => [...old, newUser])
    },
    onError: (error) => {
      toast.error(`Failed to create user: ${error.message}`)
    }
  })
}
```

#### Performance Optimization
```typescript
// Virtualized lists for large datasets
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            <ItemRow item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Memoization patterns
const ExpensiveComponent = memo(({ data, onAction }: Props) => {
  // Only re-render when data changes (shallow compare)
  return <div>{/* ... */}</div>
}, (prevProps, nextProps) => {
  // Custom comparison for deep equality
  return isEqual(prevProps.data, nextProps.data)
})

// Stable callbacks with useCallback
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])

// Computed values with useMemo
const sortedItems = useMemo(() => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}, [items])
```

### CSS Architecture

#### Tailwind + CSS Modules Hybrid
```typescript
// For complex components, combine Tailwind with CSS Modules
// components/DataGrid/DataGrid.module.css
.grid {
  --grid-border-color: theme('colors.gray.200');
  
  display: grid;
  border: 1px solid var(--grid-border-color);
  border-radius: theme('borderRadius.lg');
  overflow: hidden;
}

.cell {
  padding: theme('spacing.3');
  border-bottom: 1px solid var(--grid-border-color);
  
  &:hover {
    background: theme('colors.gray.50');
  }
}

// Dark mode
:global(.dark) .grid {
  --grid-border-color: theme('colors.gray.700');
}

:global(.dark) .cell:hover {
  background: theme('colors.gray.800');
}
```

```typescript
// DataGrid.tsx
import styles from './DataGrid.module.css'
import { cn } from '@/lib/utils'

export function DataGrid({ className, ...props }: DataGridProps) {
  return (
    <div className={cn(styles.grid, 'shadow-sm', className)}>
      {/* Grid content */}
    </div>
  )
}
```

---

## PERFORMANCE ENGINEERING

### Performance Budget
```yaml
# performance-budget.yml
budgets:
  - path: "/"
    timings:
      - metric: firstContentfulPaint
        budget: 1000
      - metric: largestContentfulPaint
        budget: 2500
      - metric: cumulativeLayoutShift
        budget: 0.1
      - metric: totalBlockingTime
        budget: 200
    
    resources:
      - resourceType: script
        budget: 200000  # 200KB
      - resourceType: stylesheet
        budget: 50000   # 50KB
      - resourceType: image
        budget: 300000  # 300KB
      - resourceType: font
        budget: 100000  # 100KB

  - path: "/api/*"
    timings:
      - metric: timeToFirstByte
        budget: 100
      - metric: p95ResponseTime
        budget: 300
      - metric: p99ResponseTime
        budget: 500
```

### Database Performance
```sql
-- Query optimization toolkit

-- 1. Identify slow queries
SELECT 
    query,
    calls,
    total_exec_time / 1000 as total_seconds,
    mean_exec_time / 1000 as mean_seconds,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- 2. Analyze query plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM orders 
WHERE user_id = $1 
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- 3. Find missing indexes
SELECT
    schemaname || '.' || relname AS table,
    seq_scan,
    seq_tup_read,
    idx_scan,
    seq_tup_read / NULLIF(seq_scan, 0) AS avg_tuples_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC
LIMIT 20;

-- 4. Find unused indexes (candidates for removal)
SELECT
    schemaname || '.' || indexrelname AS index,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    idx_scan AS scans
FROM pg_stat_user_indexes
WHERE idx_scan < 50
ORDER BY pg_relation_size(indexrelid) DESC;

-- 5. Connection monitoring
SELECT 
    state,
    COUNT(*) as connections,
    MAX(EXTRACT(EPOCH FROM (NOW() - state_change))) as max_duration_seconds
FROM pg_stat_activity
GROUP BY state;
```

### Caching Strategy
```typescript
// Multi-tier caching architecture
class CacheService {
  constructor(
    private memoryCache: LRUCache<string, unknown>,
    private redis: Redis,
    private db: Database
  ) {}

  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = 300, tags = [] } = options

    // L1: Memory cache (fastest, limited size)
    const memoryResult = this.memoryCache.get(key)
    if (memoryResult !== undefined) {
      return memoryResult as T
    }

    // L2: Redis cache (fast, shared across instances)
    const redisResult = await this.redis.get(key)
    if (redisResult) {
      const parsed = JSON.parse(redisResult) as T
      this.memoryCache.set(key, parsed)
      return parsed
    }

    // L3: Database (source of truth)
    const result = await fetcher()

    // Populate caches
    await this.redis.setex(key, ttl, JSON.stringify(result))
    this.memoryCache.set(key, result)

    // Track tags for invalidation
    for (const tag of tags) {
      await this.redis.sadd(`tag:${tag}`, key)
    }

    return result
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keys = await this.redis.smembers(`tag:${tag}`)
    
    if (keys.length > 0) {
      await this.redis.del(...keys)
      keys.forEach(key => this.memoryCache.delete(key))
    }
    
    await this.redis.del(`tag:${tag}`)
  }
}

// Usage
const user = await cache.get(
  `user:${userId}`,
  () => db.users.findById(userId),
  { ttl: 300, tags: ['users', `user:${userId}`] }
)

// Invalidate when user changes
await cache.invalidateByTag(`user:${userId}`)
```

---

## DEBUGGING SUPREMACY

### Systematic Debugging Protocol
```
┌────────────────────────────────────────────────────────────────┐
│                    DEBUGGING DECISION TREE                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Can you reproduce it?                                         │
│  ├─ NO → Gather more data (logs, metrics, user reports)        │
│  └─ YES → Continue                                             │
│                                                                │
│  Is it environment-specific?                                   │
│  ├─ YES → Compare environments (config, versions, data)        │
│  └─ NO → Continue                                              │
│                                                                │
│  Is it timing-dependent?                                       │
│  ├─ YES → Race condition, concurrency issue                    │
│  └─ NO → Continue                                              │
│                                                                │
│  Is it data-dependent?                                         │
│  ├─ YES → Find minimal failing input                           │
│  └─ NO → Continue                                              │
│                                                                │
│  Recent change caused it?                                      │
│  ├─ YES → Git bisect to find culprit                           │
│  └─ NO → Systematic code review                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Advanced Debugging Techniques

#### Git Bisect Automation
```bash
#!/bin/bash
# scripts/bisect-test.sh
# Automatically find the commit that introduced a bug

git bisect start
git bisect bad HEAD  # Current commit is broken
git bisect good v1.2.0  # Last known good version

# Automated testing
git bisect run ./test-for-bug.sh

# After finding the culprit:
git bisect reset
```

#### Production Debugging (Safe)
```typescript
// Dynamic debug logging (no redeploy needed)
const debugConfig = {
  async isEnabled(feature: string, userId?: string): Promise<boolean> {
    // Check Redis for dynamic debug flags
    const globalFlag = await redis.get(`debug:${feature}`)
    if (globalFlag === 'true') return true
    
    if (userId) {
      const userFlag = await redis.get(`debug:${feature}:${userId}`)
      if (userFlag === 'true') return true
    }
    
    return false
  }
}

// In code:
if (await debugConfig.isEnabled('order-processing', user.id)) {
  logger.debug('Order processing details', {
    orderId,
    items: order.items,
    calculations: priceBreakdown
  })
}

// Enable via Redis without deploy:
// SET debug:order-processing true
// SET debug:order-processing:user-123 true
```

#### Memory Leak Detection
```typescript
// Node.js memory profiling
import v8 from 'v8'

// Heap snapshot for memory analysis
const takeHeapSnapshot = () => {
  const filename = `/tmp/heap-${Date.now()}.heapsnapshot`
  const snapshotStream = v8.writeHeapSnapshot(filename)
  logger.info(`Heap snapshot written to ${filename}`)
  return filename
}

// Memory usage tracking
const trackMemory = () => {
  const used = process.memoryUsage()
  logger.info('Memory usage', {
    rss: Math.round(used.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
    external: Math.round(used.external / 1024 / 1024) + ' MB'
  })
}

// Expose debug endpoints (protected)
app.get('/debug/memory', authMiddleware, adminOnly, (req, res) => {
  res.json(process.memoryUsage())
})

app.post('/debug/heap-snapshot', authMiddleware, adminOnly, async (req, res) => {
  const filename = takeHeapSnapshot()
  res.json({ filename })
})
```

---

## AI/ML OPERATIONS

### MLOps Pipeline
```yaml
# ml-pipeline.yml
stages:
  - data_validation
  - feature_engineering
  - training
  - evaluation
  - deployment

data_validation:
  script:
    - great_expectations validate
  artifacts:
    - validation_report.html

feature_engineering:
  script:
    - python src/features/build_features.py
  artifacts:
    - features/*.parquet

training:
  script:
    - python src/models/train.py --experiment-name $CI_PIPELINE_ID
  artifacts:
    - models/model.pkl
    - mlflow_run_id.txt

evaluation:
  script:
    - python src/models/evaluate.py
  artifacts:
    - metrics.json
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

deployment:
  script:
    - python src/deploy/deploy_model.py
  environment:
    name: production
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

### Model Serving
```python
# FastAPI model serving with monitoring
from fastapi import FastAPI, HTTPException
from prometheus_client import Counter, Histogram
import mlflow

app = FastAPI()

# Metrics
prediction_counter = Counter(
    'model_predictions_total',
    'Total number of predictions',
    ['model_version', 'status']
)
prediction_latency = Histogram(
    'model_prediction_latency_seconds',
    'Prediction latency',
    ['model_version']
)

# Load model
model = mlflow.pyfunc.load_model(f"models:/{MODEL_NAME}/Production")
model_version = model.metadata.run_id

@app.post("/predict")
async def predict(request: PredictionRequest):
    with prediction_latency.labels(model_version).time():
        try:
            features = preprocess(request.data)
            prediction = model.predict(features)
            
            prediction_counter.labels(model_version, 'success').inc()
            
            return {
                "prediction": prediction.tolist(),
                "model_version": model_version,
                "confidence": float(prediction.max())
            }
        except Exception as e:
            prediction_counter.labels(model_version, 'error').inc()
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "healthy", "model_version": model_version}
```

### LLM Integration Best Practices
```typescript
// Structured LLM calls with retry and caching
import Anthropic from '@anthropic-ai/sdk'

class LLMService {
  private client: Anthropic
  private cache: CacheService

  async complete(
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const {
      model = 'claude-sonnet-4-20250514',
      maxTokens = 1024,
      temperature = 0.7,
      cacheKey,
      cacheTTL = 3600
    } = options

    // Check cache for deterministic prompts
    if (cacheKey) {
      const cached = await this.cache.get(cacheKey)
      if (cached) return cached as CompletionResult
    }

    // Call with retry
    const response = await retry(
      async () => {
        const result = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }]
        })
        return result
      },
      {
        maxAttempts: 3,
        backoff: 'exponential',
        retryOn: (error) => error.status === 429 || error.status >= 500
      }
    )

    const result = {
      content: response.content[0].text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      },
      model: response.model
    }

    // Cache if key provided
    if (cacheKey) {
      await this.cache.set(cacheKey, result, cacheTTL)
    }

    return result
  }

  // Structured output with validation
  async completeStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: CompletionOptions = {}
  ): Promise<T> {
    const systemPrompt = `
      Respond ONLY with valid JSON matching this schema:
      ${JSON.stringify(zodToJsonSchema(schema))}
      
      No explanation, no markdown, just JSON.
    `

    const response = await this.complete(
      `${systemPrompt}\n\n${prompt}`,
      { ...options, temperature: 0 }
    )

    // Parse and validate
    const parsed = JSON.parse(response.content)
    return schema.parse(parsed)
  }
}
```

---

## WORST-CASE PROTOCOLS

### Disaster Recovery Playbook

#### P0 Incident: Complete Outage
```
┌────────────────────────────────────────────────────────────────┐
│                    P0 INCIDENT RESPONSE                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  T+0: IMMEDIATE ACTIONS                                        │
│  □ Page all on-call responders                                 │
│  □ Start incident Slack channel                                │
│  □ Designate Incident Commander                                │
│  □ Post initial status page update                             │
│                                                                │
│  T+5min: TRIAGE                                                │
│  □ Identify affected systems                                   │
│  □ Check recent deployments (rollback candidate?)              │
│  □ Check external dependencies (AWS status, etc.)              │
│  □ Check for security indicators                               │
│                                                                │
│  T+10min: MITIGATE                                             │
│  □ Execute rollback if deployment-related                      │
│  □ Failover to DR region if regional issue                     │
│  □ Enable maintenance mode if needed                           │
│  □ Scale up if capacity issue                                  │
│                                                                │
│  T+15min: COMMUNICATE                                          │
│  □ Update status page with ETA                                 │
│  □ Notify stakeholders                                         │
│  □ Customer support briefed                                    │
│                                                                │
│  RESOLUTION                                                    │
│  □ Verify service restored                                     │
│  □ Run synthetic checks                                        │
│  □ Update status page: resolved                                │
│  □ Schedule postmortem within 48 hours                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Database Corruption Recovery
```sql
-- Point-in-time recovery
-- 1. Identify corruption time from logs

-- 2. Stop writes
ALTER DATABASE mydb SET default_transaction_read_only = on;

-- 3. Create recovery instance from backup
-- (Cloud provider specific)

-- 4. Recover to specific point
-- AWS RDS example:
-- aws rds restore-db-instance-to-point-in-time \
--   --source-db-instance-identifier production-db \
--   --target-db-instance-identifier recovery-db \
--   --restore-time "2025-01-10T12:00:00Z"

-- 5. Verify recovered data
SELECT COUNT(*) FROM critical_table;
SELECT MAX(created_at) FROM critical_table;

-- 6. Replay missed transactions if possible
-- (From application logs or message queue)

-- 7. Switch traffic to recovered instance
```

#### Security Breach Protocol
```
┌────────────────────────────────────────────────────────────────┐
│                    SECURITY BREACH RESPONSE                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  CONTAIN (First 30 minutes)                                    │
│  □ Isolate affected systems from network                       │
│  □ Revoke compromised credentials                              │
│  □ Block attacker IPs/patterns at WAF                          │
│  □ Preserve forensic evidence (don't wipe yet)                 │
│                                                                │
│  ASSESS (First 4 hours)                                        │
│  □ Determine scope of breach                                   │
│  □ Identify compromised data types                             │
│  □ Review access logs for all systems                          │
│  □ Check for persistence mechanisms                            │
│                                                                │
│  ERADICATE (24-48 hours)                                       │
│  □ Remove all attacker access                                  │
│  □ Patch vulnerability exploited                               │
│  □ Rotate ALL secrets and credentials                          │
│  □ Deploy additional monitoring                                │
│                                                                │
│  RECOVER                                                       │
│  □ Restore from known-good backups                             │
│  □ Gradually restore services                                  │
│  □ Enhanced monitoring for 30 days                             │
│                                                                │
│  NOTIFY (Per compliance requirements)                          │
│  □ Legal team briefed                                          │
│  □ Affected users notified (if PII exposed)                    │
│  □ Regulators notified (GDPR: 72 hours)                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## INNOVATION FRAMEWORK

### Technology Radar
```yaml
# technology-radar.yml
# Review quarterly

adopt:
  - TypeScript (strict mode)
  - React 18+ with Server Components
  - PostgreSQL with proper indexing
  - Redis for caching
  - Kubernetes for orchestration
  - Terraform for IaC
  - GitHub Actions for CI/CD

trial:
  - Bun runtime
  - Drizzle ORM
  - tRPC for type-safe APIs
  - Turborepo for monorepos
  - OpenTelemetry
  - Feature flags (LaunchDarkly/Unleash)

assess:
  - WebAssembly for compute-heavy features
  - Edge computing (Cloudflare Workers)
  - GraphQL Federation
  - Event sourcing patterns
  - Vector databases for AI features

hold:
  - jQuery (legacy only)
  - REST without OpenAPI spec
  - Manual deployments
  - Untyped JavaScript
  - Monolithic databases without read replicas
```

### Proof of Concept Protocol
```
POC EVALUATION CRITERIA (Score 1-5)

Technical Fit
□ Solves the actual problem
□ Integrates with existing stack
□ Acceptable performance characteristics
□ Reasonable learning curve
□ Active maintenance and community

Business Impact
□ Time to market improvement
□ Cost reduction potential
□ Competitive advantage
□ Risk profile acceptable
□ Team capability match

Scoring:
- 35+ points: Strong adopt candidate
- 25-34 points: Trial in non-critical path
- 15-24 points: Continue assessment
- <15 points: Do not proceed
```

---

## QUALITY GATES

### Pre-Commit Checks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: lint
        name: Lint
        entry: npm run lint
        language: system
        pass_filenames: false
        
      - id: typecheck
        name: TypeScript
        entry: npm run typecheck
        language: system
        pass_filenames: false
        
      - id: test
        name: Unit Tests
        entry: npm run test:unit
        language: system
        pass_filenames: false
        
      - id: secrets
        name: Secret Detection
        entry: detect-secrets-hook
        language: python
```

### PR Checklist
```markdown
## Pre-Merge Checklist

### Code Quality
- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes with zero warnings
- [ ] All tests pass (unit + integration)
- [ ] Test coverage meets threshold (>80%)
- [ ] No TODO/FIXME without ticket reference

### Security
- [ ] No secrets in code
- [ ] Input validation for new endpoints
- [ ] Authorization checks for new routes
- [ ] Dependencies scanned for vulnerabilities

### Performance
- [ ] No N+1 queries introduced
- [ ] Large lists use pagination/virtualization
- [ ] Images optimized and lazy-loaded
- [ ] Bundle size impact acceptable

### Documentation
- [ ] API changes documented in OpenAPI spec
- [ ] README updated if setup changed
- [ ] Inline comments for complex logic

### Deployment
- [ ] Feature flag if risky
- [ ] Rollback plan documented
- [ ] Monitoring/alerting in place
```

---

## QUICK REFERENCE

### Command Cheat Sheet
```bash
# Git
git bisect start && git bisect bad && git bisect good <commit>  # Find bug introduction
git log --oneline -20                                            # Recent commits
git diff --stat HEAD~5                                          # Changes in last 5 commits

# Docker
docker system prune -a                                          # Clean up everything
docker stats                                                    # Container resource usage
docker logs -f --tail 100 <container>                          # Follow logs

# Kubernetes
kubectl get pods -A | grep -v Running                          # Non-running pods
kubectl top pods                                               # Resource usage
kubectl rollout undo deployment/<name>                         # Quick rollback
kubectl exec -it <pod> -- /bin/sh                              # Shell into pod

# Database (PostgreSQL)
\dt+                                                           # Tables with sizes
\di+                                                           # Indexes with sizes
SELECT pg_size_pretty(pg_database_size('dbname'));            # Database size

# Performance
curl -w "@curl-format.txt" -o /dev/null -s <url>              # Response timing
ab -n 1000 -c 50 <url>                                         # Load test
```

### Response Time Targets
| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| API GET | <50ms | <150ms | <300ms |
| API POST | <100ms | <300ms | <500ms |
| Database query | <20ms | <50ms | <100ms |
| Cache hit | <5ms | <10ms | <20ms |
| Page load (FCP) | <1s | <2s | <3s |
| Page load (LCP) | <1.5s | <2.5s | <4s |

### Error Budget Calculator
```
Monthly error budget = (1 - SLO) × minutes_in_month

Example: 99.9% availability SLO
Budget = 0.001 × 43,200 = 43.2 minutes/month

Burn rate = actual_errors / budget_errors
If burn rate > 1: Burning budget too fast
If burn rate > 14.4 for 1 hour: Page immediately
```

---

## REFERENCES

Detailed documentation available in `references/`:
- `references/api-patterns.md` - API design patterns
- `references/security.md` - Security standards and checklists
- `references/performance.md` - Performance optimization techniques
- `references/testing.md` - Testing strategies
- `references/kubernetes.md` - K8s configuration patterns
- `references/database.md` - Database optimization

## SCRIPTS

Automation tools in `scripts/`:
- `scripts/quality-check.sh` - Run all quality gates
- `scripts/security-scan.sh` - Dependency vulnerability scan
- `scripts/performance-profile.sh` - Benchmark key operations
- `scripts/incident-response.sh` - Incident response automation
- `scripts/deploy.sh` - Deployment automation
