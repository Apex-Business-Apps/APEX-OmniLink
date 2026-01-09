# MAN Mode: Manual Approval Node

## Overview

MAN Mode (Manual-Authorization-Needed) is a human-in-the-loop safety gate integrated into the APEX OmniHub Temporal Orchestrator. It provides automated risk classification and approval workflows for high-risk agent actions.

## Architecture

### Design Principles

1. **Non-blocking Isolation**: RED lane actions are isolated (not executed) while the workflow continues. This prioritizes throughput over synchronous approval.

2. **Stateless Policy Engine**: Risk classification is pure, deterministic, and has no side effects. The same input always produces the same output.

3. **Idempotent Operations**: All database operations use idempotency keys to prevent duplicate tasks on workflow replay.

4. **Separation of Concerns**: Models, policies, activities, and workflow integration are decoupled for testability and maintainability.

## Risk Classification Lanes

| Lane | Behavior | Requires Approval | Use Case |
|------|----------|-------------------|----------|
| GREEN | Auto-execute | No | Read-only operations, safe queries |
| YELLOW | Execute with audit | No | Unknown tools, single risk factor |
| RED | Isolate + notify | Yes | Sensitive operations, irreversible actions |
| BLOCKED | Reject immediately | N/A | Prohibited operations |

### Classification Logic

The policy engine evaluates actions in the following order:

1. **Blocked Check**: Tool in `BLOCKED_TOOLS` → BLOCKED
2. **Sensitive Check**: Tool in `SENSITIVE_TOOLS` → RED
3. **Irreversible Flag**: `irreversible=true` in intent → RED
4. **High-Risk Parameters**: 2+ risk params → RED, 1 param → YELLOW
5. **Safe Check**: Tool in `SAFE_TOOLS` → GREEN
6. **Default**: Unknown tools → YELLOW

## Tool Configuration

### Sensitive Tools (RED Lane)

```
Financial:    transfer_funds, process_payment, refund_payment, modify_subscription
Deletion:     delete_record, delete_user, purge_data, truncate_table, drop_table
Accounts:     deactivate_account, suspend_user, revoke_access, reset_credentials
System:       modify_config, update_secrets, deploy_code, restart_service
Communication: send_email, send_sms, send_notification, broadcast_message
```

### Blocked Tools (Never Execute)

```
execute_sql_raw, shell_execute, file_system_write, admin_override
```

### Safe Tools (GREEN Lane)

```
search_database, read_record, get_config, list_users, check_status, validate_input
```

### High-Risk Parameters

| Parameter | Risky Values | Risk Type |
|-----------|--------------|-----------|
| `amount` | 10000, 50000, 100000 | Financial threshold |
| `scope` | all, global, system | Broad impact |
| `force` | true, True, 1 | Override safety |
| `cascade` | true, True, 1 | Cascading changes |
| `admin` | true, True, 1 | Elevated privilege |

Numeric amounts ≥ 10,000 in `amount`, `value`, or `quantity` parameters also trigger risk elevation.

## Workflow Integration

### Non-Blocking Flow

```
Agent Step
    │
    ▼
risk_triage() ──► Lane?
    │
    ├── GREEN ────► Execute immediately
    │
    ├── YELLOW ───► Execute with audit logging
    │
    ├── RED ──────► Isolate action
    │                 │
    │                 ├── Create MAN task in database
    │                 ├── Return {status: "isolated", awaiting_approval: true}
    │                 └── Workflow continues (no pause)
    │
    └── BLOCKED ──► Raise ApplicationError (non-retryable)
```

### Return Value for Isolated Actions

```json
{
  "status": "isolated",
  "reason": "Tool 'delete_record' requires human approval",
  "man_task_id": "uuid-of-man-task",
  "step_id": "step-3",
  "tool_name": "delete_record",
  "awaiting_approval": true
}
```

## Database Schema

### man_tasks Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| idempotency_key | TEXT | Unique constraint: `{workflow_id}:{step_id}` |
| workflow_id | TEXT | Parent workflow reference |
| step_id | TEXT | Step within workflow |
| status | TEXT | PENDING, APPROVED, DENIED, EXPIRED |
| intent | JSONB | ActionIntent data |
| triage_result | JSONB | RiskTriageResult data |
| decision | JSONB | ManTaskDecision data |
| created_at | TIMESTAMPTZ | Task creation time |
| expires_at | TIMESTAMPTZ | Expiration time |
| decided_at | TIMESTAMPTZ | Decision time |
| decided_by | TEXT | Decision maker ID |

### Indexes

| Index | Type | Purpose |
|-------|------|---------|
| idx_man_tasks_pending | Partial B-tree | Fetch pending tasks (WHERE status='PENDING') |
| idx_man_tasks_workflow | B-tree | Lookup by workflow_id |
| idx_man_tasks_decided_by | Partial B-tree | Audit queries by decision maker |
| idx_man_tasks_expires | Partial B-tree | Expiration cron job |
| idx_man_tasks_intent_gin | GIN | JSONB search on intent |
| idx_man_tasks_tool_name | Functional | Query by tool_name in intent |

## Activities

### risk_triage

Evaluates risk level of proposed action. Pure policy logic with no side effects.

**Input**: `ActionIntent` as dict
**Output**: `RiskTriageResult` as dict
**Retryable**: No (validation errors are non-retryable)

### create_man_task

Persists approval task to database with idempotency.

**Input**: workflow_id, step_id, intent, triage_result, timeout_hours
**Output**: task_id, idempotency_key, status
**Retryable**: Yes (transient DB errors)

### resolve_man_task

Updates task with human decision (APPROVED/DENIED).

**Input**: task_id, status, reason, decided_by
**Output**: success, task_id, status, workflow_id
**Retryable**: Yes (transient DB errors)

### get_man_task / check_man_decision

Retrieve task status for polling or decision checking.

### notify_man_task

Standalone activity for manually triggering notifications.

**Input**: task_id, workflow_id, step_id, intent, triage_result, expires_at
**Output**: success, channels_attempted, channels_succeeded, errors
**Retryable**: Yes (transient network errors)

## Push Notifications

MAN Mode includes a multi-channel notification service for alerting operators when approval tasks are created.

### Supported Channels

| Channel | Description | Configuration |
|---------|-------------|---------------|
| `console` | Logs to stdout (development) | Default, always available |
| `slack` | Slack Block Kit messages | `MAN_SLACK_WEBHOOK_URL` |
| `webhook` | Generic HTTP POST | `MAN_NOTIFICATION_WEBHOOK_URL` |
| `email` | Email via HTTP endpoint | `MAN_EMAIL_NOTIFICATION_ENDPOINT` |

### Configuration

```bash
# Comma-separated list of enabled channels
MAN_NOTIFICATION_CHANNELS=slack,webhook,console

# Channel endpoints
MAN_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
MAN_NOTIFICATION_WEBHOOK_URL=https://your-api.com/webhooks/man
MAN_EMAIL_NOTIFICATION_ENDPOINT=https://your-email-service.com/send

# Dashboard URL for action buttons
MAN_DASHBOARD_URL=https://apex.app/man/tasks
```

### Design Principles

1. **Idempotent**: Notifications only sent on NEW task creation, not on activity retries
2. **Fire-and-Forget**: Notification failures are logged but don't block task creation
3. **Multi-Channel**: Sends to all enabled channels concurrently
4. **Graceful Degradation**: Missing channel configuration fails silently

### Slack Message Format

Slack notifications use Block Kit with:
- Header with risk lane emoji (🔴 RED, 🟡 YELLOW)
- Tool name and workflow context
- Risk factors list
- "Review in Dashboard" action button

## Test Coverage

**63 unit tests** covering:

- Enum validation (ManLane, ManTaskStatus)
- Model immutability and validation
- Policy triage for all 4 lanes
- Case-insensitive tool matching
- High-risk parameter detection
- Large amount detection (≥$10,000)
- Custom policy configuration
- Performance optimizations (cached lowercase sets)
- Edge cases (empty names, special characters, thresholds)
- Notification channel parsing and configuration
- Slack Block Kit message formatting
- Email payload formatting with priority
- Multi-channel concurrent notification delivery
- Idempotent notification behavior

## Performance Optimizations

1. **Cached Lowercase Sets**: Tool sets are converted to lowercase frozensets at initialization, avoiding repeated set creation during triage.

2. **Partial Indexes**: Database uses partial indexes for common query patterns (pending tasks, expiration checks).

3. **GIN Index**: JSONB GIN index enables efficient queries on intent data.

## Files

| File | Purpose |
|------|---------|
| `orchestrator/models/man_mode.py` | Pydantic data models |
| `orchestrator/policies/man_policy.py` | Stateless risk classification |
| `orchestrator/activities/man_mode.py` | Temporal activities |
| `orchestrator/workflows/agent_saga.py` | Workflow integration |
| `orchestrator/tests/test_man_mode.py` | Unit tests (38 tests) |
| `supabase/migrations/20260108120000_man_mode.sql` | Database schema |

## Future Considerations

1. **Re-execution Workflow**: Currently, approved isolated actions require manual re-execution. A dedicated workflow could automate this.

2. **Escalation Path**: Add ESCALATED status for tasks requiring higher-level approval.

3. **Configurable Thresholds**: Move financial thresholds to configuration instead of hardcoded values.

4. **Metrics/Telemetry**: Add observability hooks for approval latency, denial rates, etc.

## Changelog

- **v1.0.0**: Initial implementation with non-blocking isolation pattern
- **v1.0.1**: Performance optimization (cached lowercase sets), deprecated datetime.utcnow fix, additional GIN indexes
