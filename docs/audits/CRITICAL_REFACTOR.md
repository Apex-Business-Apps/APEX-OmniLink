# 🚨 CRITICAL ARCHITECTURAL REFACTOR

**Issue:** "Fat Edge" Anti-Pattern Detected
**Status:** 🔴 BLOCKING LAUNCH
**Priority:** P0 - Must fix before production

---

## Problem Statement

### Current State (BROKEN)

```
User Request
    ↓
Edge Function (omnilink-agent/index.ts)
    ↓
Guardian Check (LLM)
    ↓
Planner (LLM) ← ❌ SHOULD NOT BE HERE!
    ↓
Executor (DAG) ← ❌ SHOULD NOT BE HERE!
    ↓
Response (within 60s timeout)
```

**Issue:** Edge Function doing ALL the work locally

**Problems:**
1. ⏱️ **60-second timeout** - Long workflows fail
2. 💰 **No durable execution** - Crashes lose state
3. 🔄 **No retry/recovery** - Failures are terminal
4. 📊 **No workflow history** - No audit trail
5. 🚫 **Ignores Python orchestrator** - Enterprise code unused!

---

### Target State (CORRECT)

```
User Request
    ↓
Edge Function (SKINNY PRODUCER)
    ├─ Fast Guardian Check (input validation)
    ├─ Create EventEnvelope
    └─ POST to Python Orchestrator
             ↓
    Python/Temporal Worker
    ├─ Event Sourcing (audit trail)
    ├─ Saga Pattern (rollback)
    ├─ Semantic Cache (70% cost savings)
    ├─ Durable Execution (crash recovery)
    └─ Temporal Workflows
             ↓
    Response (async, can take hours)
```

**Benefits:**
- ✅ No timeout limits
- ✅ Durable execution
- ✅ Auto-retry/recovery
- ✅ 100% audit trail
- ✅ Uses enterprise orchestrator!

---

## Refactor Plan

### Phase 1: Skinny Edge Function

**File:** `supabase/functions/omnilink-agent/index.ts`

**KEEP:**
```typescript
// Fast rejection (< 100ms)
1. Authentication (JWT validation)
2. Input sanitization (PII redaction)
3. Basic Guardian check (regex patterns only)
4. Rate limiting
```

**REMOVE:**
```typescript
// ❌ DELETE THESE:
- LLM Guardian check (move to orchestrator)
- Planner logic
- Executor/DAG traversal
- Tool execution
- Result aggregation
```

**ADD:**
```typescript
// New: Async delegation
import { createEventEnvelope } from '@/lib/events'

async function handleRequest(request) {
  // 1. Fast validation
  const validation = await fastGuardianCheck(request.input)
  if (!validation.safe) {
    return { error: 'Input rejected by security policy' }
  }

  // 2. Create event envelope
  const envelope = createEventEnvelope({
    eventType: 'omnilink:agent.goal_received',
    payload: {
      goal: request.input,
      user_id: request.user.id,
      context: request.context,
    },
    source: 'omnihub',
    correlationId: generateUUID(),
    idempotencyKey: createIdempotencyKey(),
  })

  // 3. POST to orchestrator (async)
  const response = await fetch(ORCHESTRATOR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ORCHESTRATOR_API_KEY}`,
    },
    body: JSON.stringify(envelope),
  })

  // 4. Return workflow ID (user polls for result)
  const { workflow_id } = await response.json()

  return {
    status: 'accepted',
    workflow_id,
    poll_url: `/api/workflows/${workflow_id}/status`,
  }
}
```

---

### Phase 2: Orchestrator HTTP Endpoint

**File:** `orchestrator/main.py`

**ADD:**
```python
from fastapi import FastAPI, HTTPException
from temporalio.client import Client

app = FastAPI()

@app.post("/workflows/agent")
async def start_agent_workflow(envelope: EventEnvelope):
    """
    Receive EventEnvelope from Edge Function
    Start Temporal workflow
    Return workflow_id for polling
    """
    client = await Client.connect("localhost:7233")

    # Start workflow
    handle = await client.start_workflow(
        "AgentSagaWorkflow",
        args=[envelope],
        task_queue="agent-orchestrator",
        id=envelope.idempotency_key,  # Idempotent!
    )

    return {
        "workflow_id": handle.id,
        "status": "running",
        "poll_url": f"/workflows/{handle.id}/status",
    }

@app.get("/workflows/{workflow_id}/status")
async def get_workflow_status(workflow_id: str):
    """Poll for workflow completion"""
    client = await Client.connect("localhost:7233")

    handle = client.get_workflow_handle(workflow_id)

    # Non-blocking status check
    status = await handle.describe()

    if status.status == "COMPLETED":
        result = await handle.result()
        return {"status": "completed", "result": result}
    elif status.status == "FAILED":
        return {"status": "failed", "error": str(status.failure)}
    else:
        return {"status": "running", "progress": status.history_length}
```

---

### Phase 3: Frontend Polling

**File:** `src/hooks/useAgentWorkflow.ts`

```typescript
export function useAgentWorkflow() {
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle')
  const [result, setResult] = useState(null)

  async function submitGoal(goal: string) {
    // 1. Submit to Edge Function
    const response = await fetch('/functions/v1/omnilink-agent', {
      method: 'POST',
      body: JSON.stringify({ goal }),
    })

    const { workflow_id, poll_url } = await response.json()
    setStatus('running')

    // 2. Poll for completion
    const pollInterval = setInterval(async () => {
      const statusResponse = await fetch(poll_url)
      const data = await statusResponse.json()

      if (data.status === 'completed') {
        setResult(data.result)
        setStatus('completed')
        clearInterval(pollInterval)
      } else if (data.status === 'failed') {
        setStatus('failed')
        clearInterval(pollInterval)
      }
    }, 2000)  // Poll every 2 seconds
  }

  return { status, result, submitGoal }
}
```

---

## Deployment Architecture

### Before (BROKEN)

```
Vercel Edge
    ↓
Supabase Edge Function (does everything)
    └─ Python orchestrator (unused)
```

### After (CORRECT)

```
Vercel Edge (UI)
    ↓
Supabase Edge Function (skinny producer)
    ↓
HTTP POST
    ↓
Python FastAPI (orchestrator endpoint)
    ↓
Temporal Cloud (workflow execution)
    ↓
Redis (semantic cache)
    ↓
Supabase (event store)
```

---

## Rollout Plan

### Step 1: Add Orchestrator HTTP Server

```bash
cd orchestrator
pip install fastapi uvicorn

# Create server.py with FastAPI endpoints
python server.py  # Runs on localhost:8000
```

### Step 2: Deploy Orchestrator

**Options:**

**A. Fly.io (Recommended for MVP)**
```bash
fly launch --name apex-orchestrator
fly deploy
# URL: https://apex-orchestrator.fly.dev
```

**B. Railway**
```bash
railway init
railway up
# Auto-generates URL
```

**C. Render**
```yaml
# render.yaml
services:
  - type: web
    name: apex-orchestrator
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn server:app --host 0.0.0.0
```

### Step 3: Refactor Edge Function

```typescript
// Update omnilink-agent/index.ts
const ORCHESTRATOR_URL = Deno.env.get('ORCHESTRATOR_URL')  // From secrets

// Replace entire workflow logic with HTTP POST
const response = await fetch(`${ORCHESTRATOR_URL}/workflows/agent`, ...)
```

### Step 4: Update Frontend

```typescript
// src/hooks/useAgentWorkflow.ts
// Add polling logic
```

### Step 5: Test End-to-End

```bash
# 1. Start orchestrator
cd orchestrator && python server.py

# 2. Submit test request
curl -X POST https://your-supabase.functions.supabase.co/omnilink-agent \
  -d '{"goal": "Book a flight to NYC"}'

# 3. Poll for result
curl https://apex-orchestrator.fly.dev/workflows/{workflow_id}/status
```

---

## Success Criteria

- [ ] Edge Function returns in <500ms (just creates envelope)
- [ ] Orchestrator receives POST and starts Temporal workflow
- [ ] Frontend polls successfully
- [ ] Workflows complete without timeout
- [ ] Event sourcing captures all steps
- [ ] Saga rollback works on failure

---

## Timeline

- **Day 1:** Add FastAPI server to orchestrator
- **Day 2:** Deploy orchestrator to Fly.io/Railway
- **Day 3:** Refactor Edge Function to skinny producer
- **Day 4:** Update frontend with polling
- **Day 5:** End-to-end testing

**Total:** 1 week to production-ready

---

## Risk Mitigation

**Risk:** Orchestrator goes down
- **Mitigation:** Auto-restart in Fly.io/Railway
- **Fallback:** Edge Function returns 503 + retry header

**Risk:** Network latency
- **Mitigation:** Edge Function in same region as orchestrator
- **Monitoring:** Alert if latency >1s

**Risk:** Polling overhead
- **Mitigation:** Use WebSockets or Server-Sent Events (future)

---

## Conclusion

**Current State:** Edge Function doing everything = 60s timeout, no durability
**Target State:** Edge Function → Orchestrator → Temporal = unlimited time, full durability

**This is a CRITICAL refactor to unlock the full power of your enterprise architecture.**

**Status:** Ready to implement immediately.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-04
**Classification:** CRITICAL - Blocking Launch
