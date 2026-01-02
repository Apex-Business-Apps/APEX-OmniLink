# PORTABILITY MATRIX
**Multi-Cloud Swappable Components for OmniHub/TradeLine/APEX**

**Purpose:** This document defines the **contract boundaries** for every infrastructure component, showing how to swap providers without changing application code.

**Principle:** Universality First - No vendor lock-in permitted.

---

## PORTABILITY PHILOSOPHY

Every infrastructure component follows this pattern:

```
┌─────────────────────────────────────────────────────────┐
│ APPLICATION CODE (Provider-Agnostic)                    │
│ - Uses abstract interfaces only                        │
│ - No direct provider SDK calls                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ ADAPTER LAYER (Single Integration Port)                │
│ - Implements abstract interface                        │
│ - Loads provider-specific implementation via config    │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┬───────────────┐
         ▼                       ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ AWS IMPL        │  │ GCP IMPL        │  │ AZURE IMPL      │
│ (Swappable)     │  │ (Swappable)     │  │ (Swappable)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Design Rule:** If you can't swap the provider in < 1 day with config changes only, the abstraction is broken.

---

## COMPONENT MATRIX

### 1. COMPUTE RUNTIME

**Contract:**
```typescript
interface ComputeRuntime {
  deploy(service: ServiceDefinition): Promise<Deployment>;
  scale(deployment: string, replicas: number): Promise<void>;
  health(deployment: string): Promise<HealthStatus>;
  rollback(deployment: string, version: string): Promise<void>;
}
```

**Implementations:**

| Provider | Technology | Lock-In Risk | Migration Effort | Exit Strategy |
|----------|-----------|--------------|------------------|---------------|
| **Portable Default** | Kubernetes (CNCF) | ⬜ **Low** | N/A | Runs on any K8s platform |
| **AWS** | EKS (Kubernetes) | ⬜ Low | 1 week (Terraform change) | Export K8s manifests, deploy to GKE/AKS |
| **GCP** | GKE (Kubernetes) | ⬜ Low | 1 week (Terraform change) | Export K8s manifests, deploy to EKS/AKS |
| **Azure** | AKS (Kubernetes) | ⬜ Low | 1 week (Terraform change) | Export K8s manifests, deploy to EKS/GKE |
| **Serverless** | Vercel + Supabase Edge | 🟨 **High** | 3-6 months (rewrite) | Containerize edge functions, migrate to K8s |
| **On-Prem** | K3s, MicroK8s | ⬜ Low | 2 weeks (deploy K8s) | Same K8s manifests as cloud |

**Recommendation:** **Kubernetes as universal baseline.** If starting with serverless (Path A), containerize edge functions in parallel to preserve exit path.

**Terraform Interface Pattern:**
```hcl
# terraform/modules/compute/main.tf
module "compute" {
  source = "./providers/${var.provider}"  # aws, gcp, azure, on-prem

  cluster_name = var.cluster_name
  region       = var.region
  node_pools   = var.node_pools
}

# All providers must output:
output "cluster_endpoint" {
  value = module.compute.cluster_endpoint
}

output "cluster_ca_cert" {
  value = module.compute.cluster_ca_cert
}

output "kubeconfig" {
  value = module.compute.kubeconfig
}
```

**Migration Plan:**
1. Export Kubernetes manifests (`kubectl get all -o yaml`)
2. Update Terraform `var.provider` (e.g., `aws` → `gcp`)
3. Apply Terraform (creates new cluster)
4. Deploy manifests to new cluster
5. Blue-green traffic shift
6. Decommission old cluster

**Evidence:** Kubernetes is CNCF-hosted open source, runs identically across clouds ([CNCF Cloud Native Definition](https://github.com/cncf/toc/blob/main/DEFINITION.md))

---

### 2. DATABASE (PRIMARY DATA STORE)

**Contract:**
```typescript
interface Database {
  connect(connectionString: string): Promise<Connection>;
  query(sql: string, params: any[]): Promise<ResultSet>;
  transaction(fn: (tx: Transaction) => Promise<void>): Promise<void>;
  backup(): Promise<BackupMetadata>;
  restore(backupId: string): Promise<void>;
}
```

**Implementations:**

| Provider | Technology | Lock-In Risk | Migration Effort | Exit Strategy |
|----------|-----------|--------------|------------------|---------------|
| **Portable Default** | PostgreSQL (open source) | ⬜ **Low** | N/A | Standard pg_dump/pg_restore works everywhere |
| **AWS** | RDS PostgreSQL | 🟨 Medium | 1-2 weeks | `pg_dump` → Cloud SQL/Azure DB |
| **GCP** | Cloud SQL PostgreSQL | 🟨 Medium | 1-2 weeks | `pg_dump` → RDS/Azure DB |
| **Azure** | Azure Database for PostgreSQL | 🟨 Medium | 1-2 weeks | `pg_dump` → RDS/Cloud SQL |
| **Multi-Cloud** | CockroachDB (Postgres-compatible) | ⬜ Low | 2-3 weeks | Built-in multi-region, vendor-neutral |
| **Serverless** | Supabase (Postgres + API layer) | 🟥 **High** | 3-4 weeks | Migrate data + rewrite Supabase client calls |
| **On-Prem** | Self-hosted PostgreSQL | ⬜ Low | 1 week | Standard Postgres, no lock-in |

**Why PostgreSQL?**
- Open source (no licensing fees)
- Standard SQL (portable queries)
- Wire protocol compatibility (all tools work)
- pg_dump/pg_restore (universal backup/restore)

**Recommendation:** Use **PostgreSQL** as baseline. Avoid proprietary extensions (Aurora-specific features, Supabase RLS if migrating). Stick to standard Postgres features.

**Terraform Interface Pattern:**
```hcl
# terraform/modules/database/main.tf
module "database" {
  source = "./providers/${var.provider}"  # aws-rds, gcp-cloudsql, azure-db, cockroachdb

  database_name    = var.database_name
  postgres_version = var.postgres_version  # Must be same across all providers
  instance_class   = var.instance_class
  storage_gb       = var.storage_gb
}

# All providers must output standard PostgreSQL connection:
output "connection_string" {
  value     = "postgresql://${module.database.username}:${module.database.password}@${module.database.host}:5432/${module.database.database_name}"
  sensitive = true
}
```

**Application Code (Provider-Agnostic):**
```typescript
// src/lib/database.ts
import { Pool } from 'pg';  // Standard PostgreSQL client

// Load from env (same interface for all providers)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// No provider-specific APIs used
export async function query(sql: string, params: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}
```

**Migration Plan:**
1. Provision new database on target provider (Terraform)
2. Replicate data: `pg_dump source | psql target`
3. Verify data integrity (row counts, checksums)
4. Blue-green cutover (update connection string)
5. Monitor for query compatibility issues
6. Decommission old database

**Lock-In Avoidance Rules:**
- ❌ NO Aurora-specific features (Performance Insights, Serverless v2 autoscaling)
- ❌ NO Supabase-specific features (realtime, storage, auth) in application logic
- ❌ NO proprietary extensions (unless also available on target)
- ✅ YES to standard PostgreSQL features (JSON, full-text search, triggers, RLS)

---

### 3. CACHE / SESSION STORE

**Contract:**
```typescript
interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, delta: number): Promise<number>;
}
```

**Implementations:**

| Provider | Technology | Lock-In Risk | Migration Effort | Exit Strategy |
|----------|-----------|--------------|------------------|---------------|
| **Portable Default** | Redis (open source) | ⬜ **Low** | N/A | Redis protocol works everywhere |
| **AWS** | ElastiCache for Redis | 🟨 Medium | 1 week | Migrate data via `redis-cli --rdb` → target |
| **GCP** | Memorystore for Redis | 🟨 Medium | 1 week | Same as AWS |
| **Azure** | Azure Cache for Redis | 🟨 Medium | 1 week | Same as AWS |
| **Serverless** | Upstash (serverless Redis) | 🟨 Medium | 1 week | Export data, redeploy to self-hosted/cloud Redis |
| **On-Prem** | Self-hosted Redis | ⬜ Low | 1 week | Standard Redis, portable |

**Recommendation:** Use **Redis protocol** as interface. Any Redis-compatible cache can be swapped.

**Terraform Interface Pattern:**
```hcl
module "cache" {
  source = "./providers/${var.provider}"  # aws-elasticache, gcp-memorystore, upstash

  cluster_name = var.cluster_name
  redis_version = "7.0"  # Standardize version across providers
  node_type    = var.node_type
}

# Standard Redis connection output
output "redis_url" {
  value     = "redis://${module.cache.endpoint}:6379"
  sensitive = true
}
```

**Application Code (Provider-Agnostic):**
```typescript
// src/lib/cache.ts
import Redis from 'ioredis';  // Works with any Redis-compatible service

const redis = new Redis(process.env.REDIS_URL);

// Standard Redis commands (portable)
export async function rateLimit(userId: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `rate_limit:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  return count <= limit;
}
```

**Migration Plan:**
1. Provision new Redis on target provider
2. Dual-write to both old and new (for warm-up)
3. Switch reads to new Redis
4. Validate (no errors for missing keys)
5. Stop writes to old Redis, decommission

**Lock-In Avoidance:**
- ❌ NO ElastiCache Global Datastore (AWS-only)
- ❌ NO Upstash-specific APIs (use standard Redis)
- ✅ YES to standard Redis commands (GET, SET, INCR, EXPIRE, etc.)

---

### 4. MESSAGE QUEUE / EVENT BUS

**Contract:**
```typescript
interface MessageQueue {
  publish(topic: string, message: QueueMessage): Promise<void>;
  subscribe(topic: string, handler: (msg: QueueMessage) => Promise<void>): Promise<void>;
  ack(messageId: string): Promise<void>;
  nack(messageId: string): Promise<void>;
}

interface QueueMessage {
  id: string;
  body: Record<string, unknown>;
  trace_id: string;
  idempotency_key: string;
}
```

**Implementations:**

| Provider | Technology | Lock-In Risk | Migration Effort | Exit Strategy |
|----------|-----------|--------------|------------------|---------------|
| **Portable Default** | NATS (CNCF, open source) | ⬜ **Low** | N/A | NATS runs anywhere, no vendor protocol |
| **AWS** | SQS + SNS | 🟥 High | 3-4 weeks | Rewrite to use abstraction layer, migrate to NATS/RabbitMQ |
| **GCP** | Pub/Sub | 🟥 High | 3-4 weeks | Same as AWS |
| **Azure** | Service Bus | 🟥 High | 3-4 weeks | Same as AWS |
| **Multi-Cloud** | Apache Kafka (open source) | ⬜ Low | 2 weeks | Standard Kafka protocol |
| **Lightweight** | RabbitMQ (open source) | ⬜ Low | 1-2 weeks | AMQP protocol, portable |
| **Serverless** | Supabase Realtime | 🟥 High | 4 weeks | Complete rewrite to standard queue |

**Recommendation:** Use **NATS** (CNCF project) or **RabbitMQ** for portability. If using cloud-specific queues (SQS, Pub/Sub), wrap them behind abstraction layer NOW.

**Abstraction Layer Example:**
```typescript
// src/lib/queue/interface.ts
export interface Queue {
  publish(topic: string, message: QueueMessage): Promise<void>;
  subscribe(topic: string, handler: MessageHandler): Promise<void>;
}

// src/lib/queue/providers/aws-sqs.ts
export class SQSQueue implements Queue {
  async publish(topic: string, message: QueueMessage) {
    await sqs.sendMessage({
      QueueUrl: this.getQueueUrl(topic),
      MessageBody: JSON.stringify(message)
    });
  }
}

// src/lib/queue/providers/gcp-pubsub.ts
export class PubSubQueue implements Queue {
  async publish(topic: string, message: QueueMessage) {
    await pubsub.topic(topic).publishMessage({
      data: Buffer.from(JSON.stringify(message))
    });
  }
}

// src/lib/queue/providers/nats.ts
export class NATSQueue implements Queue {
  async publish(topic: string, message: QueueMessage) {
    await this.nc.publish(topic, JSON.stringify(message));
  }
}

// src/lib/queue/index.ts
// Load provider from config
const provider = process.env.QUEUE_PROVIDER || 'nats';
export const queue = createQueue(provider);  // Factory pattern
```

**Migration Plan:**
1. Wrap existing queue in abstraction layer (if not already done)
2. Deploy new queue provider (NATS/Kafka/RabbitMQ)
3. Dual-publish to both old and new
4. Start consuming from new queue
5. Validate message delivery
6. Stop publishing to old queue, drain, decommission

**Lock-In Avoidance:**
- ❌ NO SQS-specific features (FIFO queues, deduplication) unless abstracted
- ❌ NO Pub/Sub-specific features (snapshots, seek) unless abstracted
- ✅ YES to NATS JetStream (CNCF, portable)
- ✅ YES to Kafka (if need high throughput)

---

### 5. SECRETS MANAGEMENT

**Contract:**
```typescript
interface SecretsManager {
  get(secretName: string): Promise<string>;
  set(secretName: string, value: string): Promise<void>;
  delete(secretName: string): Promise<void>;
  rotate(secretName: string): Promise<void>;
}
```

**Implementations:**

| Provider | Technology | Lock-In Risk | Migration Effort | Exit Strategy |
|----------|-----------|--------------|------------------|---------------|
| **Portable Default** | HashiCorp Vault (open source) | ⬜ **Low** | N/A | Runs anywhere, API-based access |
| **AWS** | Secrets Manager | 🟨 Medium | 1-2 weeks | Export secrets, import to Vault/Doppler |
| **GCP** | Secret Manager | 🟨 Medium | 1-2 weeks | Same as AWS |
| **Azure** | Key Vault | 🟨 Medium | 1-2 weeks | Same as AWS |
| **SaaS** | Doppler, 1Password | 🟨 Medium | 1 week | API-based, easy export/import |

**Recommendation:** Use **HashiCorp Vault** for maximum portability. If using cloud-native secrets manager, wrap in abstraction layer.

**Terraform Interface Pattern:**
```hcl
module "secrets" {
  source = "./providers/${var.provider}"  # vault, aws-secrets-manager, gcp-secret-manager

  secrets = {
    "database_password" = var.database_password
    "api_key_openai"    = var.api_key_openai
  }
}

# Standardized output (all providers)
output "secret_endpoint" {
  value = module.secrets.endpoint  # Vault: vault.example.com, AWS: secretsmanager.us-east-1.amazonaws.com
}
```

**Application Code (Provider-Agnostic):**
```typescript
// src/lib/secrets.ts
interface SecretsClient {
  get(name: string): Promise<string>;
}

// Factory pattern
function createSecretsClient(): SecretsClient {
  const provider = process.env.SECRETS_PROVIDER || 'vault';

  switch (provider) {
    case 'vault':
      return new VaultClient(process.env.VAULT_ADDR!);
    case 'aws':
      return new AWSSecretsClient();
    case 'gcp':
      return new GCPSecretsClient();
    default:
      throw new Error(`Unknown secrets provider: ${provider}`);
  }
}

export const secrets = createSecretsClient();

// Usage (same everywhere)
const dbPassword = await secrets.get('database_password');
```

**Migration Plan:**
1. Provision new secrets manager (Vault or target cloud)
2. Export secrets from old provider (scripts/export-secrets.sh)
3. Import to new provider (scripts/import-secrets.sh)
4. Update app config (SECRETS_PROVIDER env var)
5. Restart services, validate secrets loaded
6. Decommission old secrets manager

**Lock-In Avoidance:**
- ❌ NO cloud-specific rotation lambdas (unless abstracted)
- ❌ NO IAM-based access without abstraction (use Vault AppRole or OIDC)
- ✅ YES to Vault (runs on K8s, cloud-agnostic)

---

### 6. OBSERVABILITY (LOGS / METRICS / TRACES)

**Contract:**
```typescript
interface Observability {
  log(level: string, message: string, context: Record<string, unknown>): void;
  metric(name: string, value: number, tags: string[]): void;
  trace(spanName: string, fn: () => Promise<void>): Promise<void>;
}
```

**Implementations:**

| Provider | Technology | Lock-In Risk | Migration Effort | Exit Strategy |
|----------|-----------|--------------|------------------|---------------|
| **Portable Default** | OpenTelemetry | ⬜ **Low** | N/A | Industry standard, vendor-neutral |
| **AWS** | CloudWatch | 🟥 High | 2-3 weeks | Rewrite to OpenTelemetry, export to Datadog/Grafana |
| **GCP** | Cloud Logging + Monitoring | 🟥 High | 2-3 weeks | Same as AWS |
| **Azure** | Azure Monitor | 🟥 High | 2-3 weeks | Same as AWS |
| **SaaS** | Datadog, New Relic | 🟨 Medium | 1-2 weeks | OpenTelemetry → new backend |
| **Open Source** | Prometheus + Grafana + Loki + Tempo | ⬜ Low | 2 weeks | Fully portable, runs on K8s |

**Recommendation:** Use **OpenTelemetry** (CNCF standard) as instrumentation layer. Backend (Datadog, Prometheus, etc.) is swappable.

**OpenTelemetry Setup (Vendor-Neutral):**
```typescript
// src/lib/observability.ts
import { trace, metrics, context } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

// Backend is configured via env vars (swappable)
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT  // Datadog, Grafana, Honeycomb, etc.
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    })
  })
});

sdk.start();

// Usage (backend-agnostic)
const tracer = trace.getTracer('omnihub');
const meter = metrics.getMeter('omnihub');

export function traceOperation(name: string, fn: () => Promise<void>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      await fn();
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

**Backend Migration:**
```bash
# Swap from Datadog to Grafana (config change only)
# Old:
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.datadoghq.com

# New:
export OTEL_EXPORTER_OTLP_ENDPOINT=https://tempo.grafana.example.com

# No code changes required
```

**Lock-In Avoidance:**
- ❌ NO direct CloudWatch SDK calls
- ❌ NO Datadog-specific agent features (use OTEL collector)
- ✅ YES to OpenTelemetry instrumentation
- ✅ YES to structured JSON logs (parsable by any log aggregator)

**Evidence:** OpenTelemetry is vendor-neutral observability standard ([OpenTelemetry Spec](https://opentelemetry.io/docs/specs/otel/))

---

### 7. BLOB STORAGE (FILES / BACKUPS)

**Contract:**
```typescript
interface BlobStorage {
  upload(bucket: string, key: string, data: Buffer): Promise<void>;
  download(bucket: string, key: string): Promise<Buffer>;
  delete(bucket: string, key: string): Promise<void>;
  list(bucket: string, prefix: string): Promise<string[]>;
}
```

**Implementations:**

| Provider | Technology | Lock-In Risk | Migration Effort | Exit Strategy |
|----------|-----------|--------------|------------------|---------------|
| **Portable Default** | S3-compatible API | ⬜ **Low** | N/A | S3 API is de facto standard |
| **AWS** | S3 | ⬜ Low | 1 week | S3 sync to GCS/Azure/MinIO |
| **GCP** | Cloud Storage (S3-compatible) | ⬜ Low | 1 week | gsutil rsync to S3/Azure |
| **Azure** | Blob Storage (S3-compatible via API) | ⬜ Low | 1 week | azcopy to S3/GCS |
| **Multi-Cloud** | Cloudflare R2 (S3-compatible, zero egress) | ⬜ Low | 1 week | S3 API, easy migration |
| **Self-Hosted** | MinIO (S3-compatible) | ⬜ Low | 1 week | Runs on K8s, S3 API |
| **Serverless** | Supabase Storage | 🟨 Medium | 2 weeks | Migrate to S3-compatible storage |

**Recommendation:** Use **S3 API** as standard. All major providers support it.

**Terraform Interface:**
```hcl
module "storage" {
  source = "./providers/${var.provider}"  # aws-s3, gcp-gcs, azure-blob, minio

  bucket_name = var.bucket_name
  region      = var.region
}

# Standardized output (S3-compatible endpoint)
output "s3_endpoint" {
  value = module.storage.endpoint  # AWS: s3.amazonaws.com, MinIO: minio.example.com
}

output "bucket_name" {
  value = module.storage.bucket_name
}
```

**Application Code (S3-Compatible):**
```typescript
// src/lib/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Works with AWS S3, GCS, Azure, MinIO, R2
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,  // Swappable
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  }
});

// Standard S3 API (portable)
export async function uploadFile(key: string, data: Buffer) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: data
  }));
}
```

**Migration Plan:**
1. Provision new storage (Terraform)
2. Sync data: `aws s3 sync s3://old-bucket s3://new-bucket --endpoint-url=...`
3. Update app config (S3_ENDPOINT env var)
4. Validate reads from new storage
5. Decommission old bucket

**Lock-In Avoidance:**
- ❌ NO S3-specific features (S3 Select, Object Lambda) unless abstracted
- ❌ NO Supabase Storage client (use S3-compatible API)
- ✅ YES to standard S3 API (PutObject, GetObject, DeleteObject, ListObjects)

---

## TERRAFORM STATE MANAGEMENT (MULTI-CLOUD)

**Problem:** Terraform state must be accessible across all cloud environments.

**Solution:** Use cloud-agnostic backend.

| Backend | Lock-In Risk | Pros | Cons |
|---------|--------------|------|------|
| **Terraform Cloud** | 🟨 Medium | Free tier, state locking, RBAC | SaaS dependency |
| **S3 + DynamoDB (AWS)** | 🟨 Medium | Cheap, reliable | AWS-specific |
| **GCS (GCP)** | 🟨 Medium | Cheap, reliable | GCP-specific |
| **Azure Blob** | 🟨 Medium | Cheap, reliable | Azure-specific |
| **Consul (self-hosted)** | ⬜ Low | Cloud-agnostic, runs on K8s | Requires management |

**Recommendation:** Use **Terraform Cloud** (free tier) or **S3 + DynamoDB** with cross-cloud access.

**Multi-Cloud State Strategy:**
```hcl
# terraform/backend.tf
terraform {
  backend "s3" {
    bucket         = "omnihub-terraform-state"  # Can be on ANY S3-compatible storage
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}

# Can use Cloudflare R2 (S3-compatible) for vendor-neutral state:
# terraform {
#   backend "s3" {
#     bucket   = "omnihub-terraform-state"
#     key      = "production/terraform.tfstate"
#     region   = "auto"
#     endpoint = "https://ACCOUNT_ID.r2.cloudflarestorage.com"
#     skip_credentials_validation = true
#     skip_region_validation = true
#   }
# }
```

---

## LOCK-IN SCORECARD (CURRENT STATE)

**VERIFIED** (from repository reconnaissance):

| Component | Current Technology | Lock-In Risk | Portable Alternative | Migration Effort |
|-----------|-------------------|--------------|---------------------|------------------|
| **Frontend Hosting** | Vercel | 🟥 High | Static CDN (S3/GCS/Azure + Cloudflare) | 1 week |
| **Backend Runtime** | Supabase Edge Functions (Deno) | 🟥 High | Docker containers on K8s | 3-6 months |
| **Database** | Supabase PostgreSQL | 🟨 Medium | Cloud SQL / RDS / self-hosted Postgres | 1-2 weeks (pg_dump) |
| **Auth** | Supabase Auth | 🟥 High | Keycloak / Auth0 / self-hosted | 2-3 weeks |
| **Storage** | Supabase Storage | 🟨 Medium | S3 / GCS / MinIO | 1 week (data sync) |
| **Realtime** | Supabase Realtime | 🟥 High | WebSocket server / NATS | 3-4 weeks |

**TOTAL LOCK-IN RISK:** 🟥 **HIGH** (5/6 components are Vercel/Supabase-specific)

**RECOMMENDATION:** Implement abstraction layers NOW for critical paths (database, storage, auth).

---

## MIGRATION ROADMAP (REDUCE LOCK-IN)

### Phase 1: Abstraction Layers (No Migration Yet)
**Timeline:** 2-4 weeks
**Goal:** Wrap current providers behind interfaces

- [ ] Wrap Supabase client behind `Database` interface
- [ ] Wrap Supabase Storage behind `BlobStorage` interface (S3-compatible)
- [ ] Wrap Supabase Auth behind `AuthProvider` interface
- [ ] Add feature flags to toggle providers (FEATURE_FLAG_DATABASE_PROVIDER=supabase)

### Phase 2: Add Portable Alternatives (Side-by-Side)
**Timeline:** 1-2 months
**Goal:** Run portable stack in parallel

- [ ] Deploy Kubernetes cluster (GKE/EKS/AKS)
- [ ] Containerize edge functions (Dockerfile per function)
- [ ] Deploy PostgreSQL (Cloud SQL/RDS) as alternative
- [ ] Dual-write to both Supabase + new Postgres
- [ ] Validate data consistency

### Phase 3: Traffic Migration (Blue-Green)
**Timeline:** 1 month
**Goal:** Shift traffic to portable stack

- [ ] Deploy containerized services to K8s
- [ ] Blue-green deployment (10% → 50% → 100% to K8s)
- [ ] Monitor error rates, latency
- [ ] Rollback to Supabase if issues

### Phase 4: Decommission Legacy (if successful)
**Timeline:** 1 month
**Goal:** Remove Vercel/Supabase

- [ ] Stop writes to Supabase
- [ ] Archive Supabase data (backup)
- [ ] Decommission Supabase project
- [ ] Celebrate universality 🎉

**TOTAL MIGRATION TIME:** 4-6 months (if needed)

---

## DECISION MATRIX: WHEN TO MIGRATE

| Trigger | Action | Timeline |
|---------|--------|----------|
| **User base < 100K** | Stay on Vercel/Supabase, add abstraction layers | Immediate (2-4 weeks) |
| **User base 100K-1M** | Start Phase 2 (deploy portable stack in parallel) | 3-6 months |
| **User base > 1M** | Complete migration to portable stack | 6-12 months |
| **Enterprise customer requires on-prem** | Force migration to K8s immediately | 3-6 months |
| **Supabase pricing becomes prohibitive** | Migrate to self-hosted Postgres + K8s | 2-3 months |
| **Multi-cloud becomes hard requirement** | Migrate to containerized multi-cloud | 6-12 months |

---

## SUMMARY

**Current State (VERIFIED):**
- 🟥 **HIGH lock-in risk** to Vercel + Supabase (5/6 components)
- Migration to portable stack: 4-6 months effort

**Recommendation:**
1. **SHORT TERM (now):** Add abstraction layers (2-4 weeks)
2. **MEDIUM TERM (if growth continues):** Deploy portable stack in parallel (3-6 months)
3. **LONG TERM (if needed):** Complete migration to Kubernetes + multi-cloud (6-12 months)

**Guiding Principle:** **Start with speed (Vercel/Supabase OK for now), but preserve exit paths.**

---

**Document Status:** ✅ COMPLETE
**Next:** SRE Package, CI/CD Pipeline Design
