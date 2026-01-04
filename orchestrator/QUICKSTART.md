# APEX Orchestrator - Quick Start Guide

Get up and running in 5 minutes.

## Prerequisites

✅ Python 3.11+
✅ Docker & Docker Compose
✅ Git
✅ Supabase account (or local instance)
✅ OpenAI or Anthropic API key

## Step 1: Clone & Setup (2 min)

```bash
# Navigate to orchestrator directory
cd APEX-OmniHub/orchestrator

# Install dependencies
pip install -e ".[dev]"

# Copy environment template
cp .env.example .env
```

## Step 2: Configure Environment (1 min)

Edit `.env` with your credentials:

```bash
# Required: Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Required: LLM (choose one)
OPENAI_API_KEY=sk-...           # OR
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Customize defaults
DEFAULT_LLM_MODEL=gpt-4-turbo-preview
CACHE_SIMILARITY_THRESHOLD=0.85
```

## Step 3: Start Infrastructure (1 min)

```bash
# Start Temporal + Redis using Docker
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                  STATUS
temporal              running
postgres              running
redis                 running
```

## Step 4: Verify Setup (30 sec)

```bash
# Run quick tests
python main.py test
```

Expected output:
```
--- Testing Entity Extraction ---
Goal: Book flight to Paris tomorrow and send confirmation to john@example.com
Template: Book flight to {LOCATION} {DATE} and send confirmation to {EMAIL}
Parameters: {'LOCATION': 'Paris', 'DATE': 'tomorrow', 'EMAIL': 'john@example.com'}

--- Testing Semantic Cache ---
✓ Stored plan: a1b2c3d4
✓ Cache hit: similarity=0.950

✅ All tests passed!
```

## Step 5: Start Worker (30 sec)

```bash
# Terminal 1: Start orchestrator worker
python main.py worker
```

Expected output:
```
🚀 Starting APEX Orchestrator Worker...
Environment: development
Temporal: localhost:7233 (namespace=default)
Task Queue: apex-orchestrator
✓ Connected to Redis: redis://localhost:6379
✓ Semantic cache initialized
✓ Connected to Temporal
✅ Worker started - polling for tasks...
Press Ctrl+C to stop
```

## Step 6: Submit Test Workflow (30 sec)

```bash
# Terminal 2: Submit a test workflow
python main.py submit "Book flight to Paris tomorrow and email confirmation to test@example.com"
```

Expected output:
```
Submitting workflow: Book flight to Paris tomorrow and email confirmation to test@example.com
✓ Workflow started: agent-workflow-1234-5678
Waiting for result...
✅ Workflow completed: {
  "status": "completed",
  "plan_id": "plan_20240115_abc123",
  "steps_executed": 3,
  "results": {...}
}
```

## 🎉 Success!

Your orchestrator is now running. Check the web UIs:

- **Temporal Web UI**: http://localhost:8233
  - View workflow executions
  - Inspect event history
  - Debug failures

- **Redis Insight**: http://localhost:8001
  - View cached plans
  - Inspect vector embeddings
  - Monitor performance

## Next Steps

### 1. Integrate with TypeScript Edge Functions

Create a workflow trigger in your edge function:

```typescript
// supabase/functions/trigger-workflow/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { goal, user_id } = await req.json()

  // POST to orchestrator
  const response = await fetch('http://orchestrator:8000/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      idempotencyKey: `${user_id}-${Date.now()}`,
      tenantId: user_id,
      eventType: 'orchestrator:agent.goal_received',
      payload: { goal, user_id },
      timestamp: new Date().toISOString(),
      source: 'omnihub',
      trace: {
        traceId: crypto.randomUUID(),
        spanId: crypto.randomUUID(),
      },
      schemaVersion: '1.0.0',
    }),
  })

  return new Response(JSON.stringify(await response.json()), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### 2. Add Database Schema

Run this migration in Supabase SQL Editor:

```sql
-- workflow_instances table
CREATE TABLE workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input jsonb NOT NULL,
  result jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_workflow_instances_created ON workflow_instances(created_at DESC);

-- Enable RLS
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own workflows
CREATE POLICY "Users can view own workflows"
ON workflow_instances FOR SELECT
USING (auth.uid()::text = (input->>'user_id'));
```

### 3. Run Production Tests

```bash
# Full test suite with coverage
make test

# Type checking
make type-check

# Linting
make lint

# All quality checks
make quality
```

### 4. Monitor Performance

Watch key metrics in Temporal Web UI:

1. **Workflow Success Rate**: Should be >99%
2. **Average Duration**: Should be <5s for cached plans
3. **Cache Hit Rate**: Check Redis Insight for cache statistics

### 5. Deploy to Production

See `README.md` deployment section for:
- Kubernetes configuration
- Multi-region setup
- Monitoring & alerting
- Disaster recovery

## Troubleshooting

### Problem: "redis.exceptions.ConnectionError"

**Solution**: Ensure Redis is running
```bash
docker-compose up -d redis
redis-cli ping  # Should return "PONG"
```

### Problem: "temporalio.exceptions.RPCError"

**Solution**: Ensure Temporal is running
```bash
docker-compose up -d temporal
curl http://localhost:8233  # Should return Temporal UI
```

### Problem: "ModuleNotFoundError: No module named 'temporalio'"

**Solution**: Reinstall dependencies
```bash
pip install -e ".[dev]"
```

### Problem: Tests fail with "Supabase connection error"

**Solution**: Update `.env` with valid Supabase credentials or use mock mode
```bash
# In .env, use local Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-key
```

### Problem: Worker starts but no workflows execute

**Solution**: Check task queue name matches
```bash
# In .env
TEMPORAL_TASK_QUEUE=apex-orchestrator  # Must match worker and client

# Verify in Temporal Web UI (http://localhost:8233)
# Navigate to: Workflows → View running workers
```

## Common Commands

```bash
# Development
make install          # Install dependencies
make docker-up        # Start infrastructure
make run-worker       # Start worker
make run-test-workflow # Submit test workflow

# Testing
make test             # Run all tests with coverage
make test-fast        # Run tests without coverage
make test-unit        # Run unit tests only

# Quality
make lint             # Check code style
make format           # Auto-format code
make type-check       # Run mypy
make security-scan    # Security vulnerability scan

# Docker
make docker-build     # Build Docker image
make docker-logs      # View logs
make docker-down      # Stop all services

# Production
make prod-check       # Pre-deployment checklist
make ci               # Full CI pipeline
```

## Example Workflows

### Simple: Search Database

```python
python main.py submit "Search profiles table for users with email ending in @example.com"
```

### Medium: Multi-Step Process

```python
python main.py submit "Find all invoices from last month, generate PDF report, and email to admin@example.com"
```

### Complex: With Compensations

```python
python main.py submit "Reserve hotel room in Paris for Dec 25-30, book airport transfer, and send itinerary. If any step fails, cancel all bookings."
```

## Learning Resources

- **Architecture Deep Dive**: See `ARCHITECTURE.md`
- **API Reference**: See `README.md`
- **Temporal Docs**: https://docs.temporal.io/
- **Redis VSS Guide**: https://redis.io/docs/stack/search/reference/vectors/

## Getting Help

- **GitHub Issues**: https://github.com/apexbusiness-systems/APEX-OmniHub/issues
- **Documentation**: https://docs.apex.systems/orchestrator
- **Community**: APEX Slack #orchestrator channel

## Next: Production Deployment

Ready for production? See:
1. `README.md` → Production Deployment section
2. `ARCHITECTURE.md` → Deployment Topology
3. `.github/workflows/orchestrator-ci.yml` → CI/CD pipeline

🚀 Happy orchestrating!
