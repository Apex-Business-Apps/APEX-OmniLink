# APEX Orchestrator

Production-grade AI Agent Orchestration Platform with Temporal.io, Event Sourcing, and Saga Patterns.

## 🎯 Features

- **Event Sourcing**: Complete audit trail with deterministic replay
- **Saga Pattern**: Compensation-based distributed transactions
- **Semantic Caching**: 70% reduction in LLM calls via plan template matching
- **Multi-Region**: Distributed locking for Active-Active deployments
- **Type-Safe**: Pydantic models matching TypeScript EventEnvelope contracts
- **Vendor-Agnostic**: LiteLLM + Instructor for any LLM provider

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ TypeScript Edge Functions (Supabase)                        │
│   - OmniLink Agent                                           │
│   - Event Publishers (sim/contracts)                         │
└─────────────────┬────────────────────────────────────────────┘
                  │ EventEnvelope (JSON/HTTP)
                  ▼
┌──────────────────────────────────────────────────────────────┐
│ Python Temporal.io Orchestrator                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Workflow (Event Sourcing + Saga)                       │  │
│ │ - Semantic Cache → Plan Generation → Execution        │  │
│ │ - Automatic Compensation on Failure                    │  │
│ └────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Activities (Tool Execution)                            │  │
│ │ - Supabase Integration                                 │  │
│ │ - LLM Calls (instructor + litellm)                     │  │
│ │ - Distributed Locking                                  │  │
│ └────────────────────────────────────────────────────────┘  │
└───────┬──────────────────────────┬───────────────────────────┘
        │                          │
        ▼                          ▼
┌───────────────┐      ┌──────────────────────┐
│ Redis Stack   │      │ Supabase PostgreSQL  │
│ - Vector Search│      │ - workflow_instances │
│ - Dist. Locks │      │ - agent_checkpoints  │
└───────────────┘      └──────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Docker & Docker Compose (for local Temporal + Redis)
- Supabase account
- OpenAI or Anthropic API key

### 1. Install Dependencies

```bash
cd orchestrator
pip install -e ".[dev]"
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase and LLM credentials
```

### 3. Start Infrastructure

```bash
# Start Temporal + Redis using Docker Compose
docker-compose up -d

# Wait for services to be ready
docker-compose ps
```

### 4. Run Tests

```bash
# Run all tests
pytest

# With coverage
pytest --cov=. --cov-report=html

# Run specific test
pytest tests/test_models.py -v
```

### 5. Start Worker

```bash
# Start orchestrator worker
python main.py worker
```

### 6. Submit Test Workflow

```bash
# In another terminal
python main.py submit "Book flight to Paris tomorrow and send confirmation to john@example.com"
```

## 📦 Project Structure

```
orchestrator/
├── models/                  # Pydantic models (Universal Schema)
│   ├── __init__.py
│   └── events.py           # EventEnvelope, AgentEvents
├── infrastructure/          # Infrastructure services
│   ├── __init__.py
│   └── cache.py            # Semantic cache with Redis VSS
├── workflows/               # Temporal workflows
│   ├── __init__.py
│   └── agent_saga.py       # AgentWorkflow with Event Sourcing + Saga
├── activities/              # Temporal activities
│   ├── __init__.py
│   └── tools.py            # Tool execution, Supabase integration
├── tests/                   # Comprehensive test suite
│   ├── conftest.py         # Pytest fixtures
│   ├── test_models.py      # Model validation tests
│   └── test_cache.py       # Semantic cache tests
├── config.py                # Configuration management
├── main.py                  # Entry point
├── pyproject.toml           # Dependencies
├── Dockerfile               # Production Docker image
├── docker-compose.yml       # Local development stack
└── README.md                # This file
```

## 🧪 Testing

### Unit Tests

```bash
# Run unit tests only
pytest tests/test_models.py tests/test_cache.py
```

### Integration Tests

```bash
# Requires Redis running
docker-compose up -d redis
pytest tests/test_cache.py -v
```

### End-to-End Tests

```bash
# Requires full stack (Temporal + Redis + Supabase)
docker-compose up -d
pytest tests/ -v
```

## 🔧 Integration with APEX-OmniHub

### 1. Database Schema

Add workflow tables to Supabase:

```sql
-- Migration: 20240XXX_orchestrator_schema.sql
CREATE TABLE workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id text NOT NULL UNIQUE,
  status text NOT NULL, -- running, completed, failed
  input jsonb NOT NULL,
  result jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_workflow_instances_created ON workflow_instances(created_at DESC);
```

### 2. TypeScript Client

Call orchestrator from edge functions:

```typescript
// supabase/functions/trigger-workflow/index.ts
import { EventEnvelope } from '../_shared/types';

async function triggerOrchestrator(goal: string, userId: string) {
  const envelope: EventEnvelope = {
    eventId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    idempotencyKey: `${userId}-workflow-${Date.now()}`,
    tenantId: userId,
    eventType: 'orchestrator:agent.goal_received',
    payload: { goal, user_id: userId },
    timestamp: new Date().toISOString(),
    source: 'omnihub',
    trace: {
      traceId: crypto.randomUUID(),
      spanId: crypto.randomUUID(),
    },
    schemaVersion: '1.0.0',
  };

  // POST to orchestrator HTTP endpoint (via Temporal client or webhook)
  const response = await fetch('http://orchestrator:8000/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });

  return await response.json();
}
```

### 3. Environment Variables

Add to `.env`:

```bash
# Orchestrator endpoint
ORCHESTRATOR_URL=http://orchestrator:8000

# Temporal connection
TEMPORAL_HOST=temporal.example.com:7233
TEMPORAL_NAMESPACE=apex-production
```

## 📊 Monitoring & Observability

### Temporal Web UI

Access at http://localhost:8233 to view:
- Running workflows
- Event history
- Retry attempts
- Execution metrics

### Redis Insight

Access at http://localhost:8001 to view:
- Cached plans
- Vector similarity matches
- Distributed locks

### Logs

```bash
# View orchestrator logs
docker-compose logs -f orchestrator

# View all services
docker-compose logs -f
```

## 🛡️ Production Deployment

### 1. Deploy Temporal

Use [Temporal Cloud](https://temporal.io/cloud) or self-hosted Kubernetes:

```bash
# Helm chart for Kubernetes
helm install temporal \
  --set server.replicaCount=3 \
  temporal/temporal
```

### 2. Deploy Orchestrator

```bash
# Build production image
docker build -t apex-orchestrator:latest .

# Deploy to Kubernetes
kubectl apply -f k8s/orchestrator-deployment.yaml
```

### 3. Configure Upstash Redis

Use managed Redis with Active-Active for multi-region:

```bash
# Set Redis URL to Upstash endpoint
REDIS_URL=rediss://:password@endpoint.upstash.io:6379
```

## 🔍 Troubleshooting

### Tests Failing

```bash
# Check Redis connection
redis-cli ping

# Check Temporal connection
docker-compose ps

# Run tests with verbose logging
pytest -v -s --log-cli-level=DEBUG
```

### Worker Not Starting

```bash
# Check environment variables
python -c "from config import settings; print(settings.model_dump())"

# Check Temporal connectivity
python -c "import asyncio; from temporalio.client import Client; asyncio.run(Client.connect('localhost:7233'))"
```

## 📚 Key Concepts

### Event Sourcing

Workflow state is reconstructed by replaying events:

```python
events = [
  GoalReceived(goal="Book flight"),
  PlanGenerated(steps=[...]),
  ToolCallRequested(tool="search_flights"),
  ToolResultReceived(result={...}),
  WorkflowCompleted(final_result={...})
]

# Replay to reconstruct state
for event in events:
    apply_event(event)
```

### Saga Pattern

Compensation-based rollback:

```python
# Forward operations register compensations
saga.execute_with_compensation(
    activity="book_flight",
    compensation_activity="cancel_flight",
)

# On failure, compensations execute in reverse
if error:
    await saga.rollback()  # Calls cancel_flight
```

### Semantic Caching

Plan template matching with vector search:

```
Goal: "Book flight to Paris tomorrow"
  ↓
Template: "Book flight to {LOCATION} {DATE}"
  ↓
Embedding: [0.23, -0.45, 0.12, ...]
  ↓
Redis VSS: Find similar templates (cosine similarity)
  ↓
Cache Hit: Inject parameters → Execute
```

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Write tests: `pytest tests/`
3. Run linters: `ruff check . && black .`
4. Submit PR

## 📄 License

Proprietary - APEX Business Systems

## 🆘 Support

- GitHub Issues: https://github.com/apexbusiness-systems/APEX-OmniHub/issues
- Documentation: https://docs.apex.systems/orchestrator
