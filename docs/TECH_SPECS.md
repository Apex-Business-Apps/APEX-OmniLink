# 🛠️ TECHNICAL SPECIFICATIONS: Temporal Platform v1.0.0

## 1. Core Architecture (OMEGA Pattern)

The APEX OmniHub v1.0.0 operates on the **OMEGA Architecture**, a high-availability event-driven system designed for autonomous AI agent orchestration.

### 1.1 Orchestration Layer
*   **Engine**: Temporal.io Server (v1.24.2)
*   **Hosting**: Self-hosted Docker Containers (Primary), K8s (Target)
*   **Communication**: gRPC (Port 7233)
*   **Namespace**: `default`
*   **Task Queue**: `apex-orchestrator`

### 1.2 Data Persistence Layer
*   **Database**: PostgreSQL 15 (Alpine)
*   **Volume**: `orchestrator_temporal_data` (Local Driver)
*   **Schema**: Temporal Default (Visibility + History)
*   **Backup Strategy**: Volume Snapshots (Daily)

### 1.3 Application Interface
*   **Frontend**: React 18 + Vite (SPA)
*   **Gateway**: Supabase Edge Functions (Deno)
*   **Protocol**: `useOmniStream` (WebSocket/SSE)
*   **Security**: JWT + SHA-256 Signature Verification

---

## 2. Infrastructure Requirements

### 2.1 Minimum System Requirements (Host)
*   **CPU**: 4 vCPUs (x86_64/ARM64)
*   **RAM**: 8 GB
*   **Disk**: 20 GB SSD (NVMe recommended for Persistence)
*   **OS**: Linux (Kernel 5.4+) or Windows 10/11 (WSL2)

### 2.2 Network Topology
*   **VPC**: subnet `172.x.x.x` (Docker Internal)
*   **Public Ports**: `80` (HTTP), `443` (HTTPS)
*   **Private Ports**: `7233` (Temporal gRPC), `5433` (Postgres), `6379` (Redis)
*   **Egress**: `api.openai.com`, `api.anthropic.com`

---

## 3. Configuration Specifications

### 3.1 Environment Variables
All configuration is strictly 12-factor compliant via `.env`.

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMPORAL_HOST` | Orchestrator connection string | `temporal:7233` |
| `TEMPORAL_NAMESPACE` | Isolation namespace | `default` |
| `POSTGRES_USER` | DB Username | `temporal` |
| `POSTGRES_PWD` | DB Password | `[REDACTED]` |
| `LOG_LEVEL` | Application logging verbosity | `INFO` |

### 3.2 Performance SLA
*   **Workflow Start Latency**: < 50ms (p95)
*   **Activity Execution Overhead**: < 10ms
*   **Event History Limit**: 50,000 events/workflow
*   **Concurrent Executions**: 1,000+ per node

---

## 4. Updates & Maintenance
*   **Update Strategy**: Rolling Updates (Blue/Green)
*   **Migration Tool**: `tctl` (Temporal CLI)
*   **Monitoring**: Prometheus targets exposed at `:9090`
