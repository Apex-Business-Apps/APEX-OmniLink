# OmniTrace - Workflow Observability & Replay

**Module:** `orchestrator/observability/omnitrace.py`

## Overview

OmniTrace provides enterprise-grade workflow observability with built-in privacy controls and replay support. It enables real-time tracking of workflow execution while ensuring telemetry never impacts production reliability.

## Key Guarantees

1. **Zero-Impact Telemetry** - Telemetry failures never raise exceptions or break workflows
2. **Idempotent Writes** - Safe for Temporal retries via unique constraints and upserts
3. **Bounded Volume** - Event caps per run, payload size limits, and configurable sampling
4. **Privacy-First** - Allowlist-based redaction with sensitive data hashing

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OMNITRACE_ENABLED` | `true` | Enable/disable tracing |
| `OMNITRACE_SAMPLE_RATE` | `1.0` (dev) / `0.1` (prod) | Sampling rate (0.0-1.0) |
| `OMNITRACE_MAX_EVENTS_PER_RUN` | `200` | Maximum events per workflow |
| `OMNITRACE_MAX_EVENT_BYTES` | `8192` | Maximum payload size in bytes |

## Usage

```python
from observability.omnitrace import OmniTraceRecorder, get_omnitrace_recorder

# Get recorder for a workflow
recorder = get_omnitrace_recorder(workflow_id="wf-123", trace_id="trace-abc")

# Check if this run should be sampled
if recorder.should_record():
    # Record run start
    await recorder.record_run_start(user_id="user-456", input_data={"query": "..."})

    # Record events during execution
    await recorder.record_event(
        event_key="tool:step1:search_database:1",
        kind="tool",
        name="search_database",
        latency_ms=150,
        data={"query": "..."}
    )

    # Record completion
    await recorder.record_run_complete(output_data={"result": "..."})
```

## Data Redaction

OmniTrace uses an allowlist approach for data protection:

### Preserved Fields (Allowlist)
- Identifiers: `id`, `workflow_id`, `trace_id`, `step_id`, `run_id`
- Status: `status`, `success`, `error`, `type`, `name`
- Timing: `latency_ms`, `duration_ms`, `timestamp`
- Counts: `count`, `event_count`, `attempt`, `retry_count`

### Dropped Fields (Blocklist)
- Credentials: `password`, `secret`, `token`, `api_key`
- PII: `ssn`, `credit_card`, `private_key`

### Hashed Fields
All other fields are hashed to preserve correlation without exposing data.

## Database Schema

OmniTrace stores data in two tables:

### `omnitrace_runs`
| Column | Type | Description |
|--------|------|-------------|
| `workflow_id` | text | Primary key |
| `trace_id` | text | Distributed trace ID |
| `user_id` | text | User who initiated |
| `status` | text | running/completed/failed |
| `input_redacted` | jsonb | Redacted input |
| `output_redacted` | jsonb | Redacted output |
| `event_count` | int | Total events recorded |

### `omnitrace_events`
| Column | Type | Description |
|--------|------|-------------|
| `event_key` | text | Unique event identifier |
| `workflow_id` | text | Parent workflow |
| `kind` | text | tool/model/policy/cache |
| `name` | text | Event name |
| `latency_ms` | int | Duration in milliseconds |
| `data_redacted` | jsonb | Redacted event data |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Temporal Workflow                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Step 1    │→ │   Step 2    │→ │   Step 3    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              OmniTrace Recorder                      │   │
│  │  [Sampling] → [Redaction] → [Truncation] → [DB]     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Use Consistent Event Keys** - Format: `{kind}:{step_id}:{name}:{attempt}`
2. **Record Latency** - Always include `latency_ms` for performance analysis
3. **Clean Up** - Call `clear_recorder(workflow_id)` on workflow completion
4. **Sample in Production** - Use 10% sampling to control costs
