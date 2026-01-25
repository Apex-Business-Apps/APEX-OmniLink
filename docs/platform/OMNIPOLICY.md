# OmniPolicy Plane - Deterministic Policy Evaluation

**Module:** `orchestrator/security/omni_policy.py`

## Overview

OmniPolicy provides cached, deterministic policy evaluation for tool execution within Temporal workflows. It enforces security policies with explainable decisions and full audit trail integration.

## Key Features

1. **Cached Evaluation** - In-memory policy cache with configurable TTL
2. **Deterministic Ordering** - Priority-based matching (lowest priority wins)
3. **Bounded Matching** - O(P) complexity with exact string matching (no regex/exec)
4. **Audit Integration** - Every decision logged with context hash

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OMNIPOLICY_CACHE_TTL_SECONDS` | `60` | Policy cache TTL |

## Policy Structure

```python
@dataclass(frozen=True)
class PolicyRecord:
    name: str       # Policy identifier
    version: int    # Policy version
    priority: int   # Lower = higher priority
    match: dict     # Matching criteria
    decision: str   # ALLOW | DEFER | DENY
    lane: str       # GREEN | YELLOW | RED | BLOCKED
    reason: str     # Human-readable explanation
```

## Decision Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Tool Execution Request                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 OmniPolicy Evaluator                        │
├─────────────────────────────────────────────────────────────┤
│  1. Check cache (TTL: 60s default)                          │
│  2. Load policies from DB if cache miss                     │
│  3. Sort by priority ASC, name ASC, version DESC            │
│  4. Match against context (tool, action, resource, etc.)    │
│  5. Return first matching policy decision                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Decision Payload                         │
├─────────────────────────────────────────────────────────────┤
│  {                                                          │
│    "decision": "ALLOW|DEFER|DENY",                         │
│    "lane": "GREEN|YELLOW|RED|BLOCKED",                     │
│    "reason": "Policy explanation",                          │
│    "policy_name": "policy_id",                             │
│    "policy_version": 1                                      │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## Usage

```python
from security.omni_policy import evaluate_policy

# Evaluate a tool execution request
decision = await evaluate_policy({
    "user_id": "user-123",
    "tool": "bank_transfer",
    "action": "execute",
    "resource": "checking_account",
    "data_class": "financial",
    "amount": 500.00
})

# Check decision
if decision["decision"] == "ALLOW":
    await execute_tool(...)
elif decision["decision"] == "DEFER":
    await escalate_to_human(decision["reason"])
else:  # DENY
    await reject_request(decision["reason"])
```

## Matching Rules

Policies use exact string matching via `*_in` suffix fields:

```json
{
  "name": "block_high_value_transfers",
  "priority": 10,
  "match": {
    "tool_in": ["bank_transfer", "wire_transfer"],
    "action_in": ["execute"],
    "data_class_in": ["financial"]
  },
  "decision": "DEFER",
  "lane": "YELLOW",
  "reason": "High-value financial operations require human approval"
}
```

### Match Fields

| Field | Description |
|-------|-------------|
| `tool_in` | List of tool names |
| `action_in` | List of action types |
| `resource_in` | List of resource identifiers |
| `data_class_in` | List of data classifications |

## MAN Mode Integration

OmniPolicy decisions integrate with MAN Mode lanes:

| Lane | Decision | Action |
|------|----------|--------|
| `GREEN` | `ALLOW` | Proceed automatically |
| `YELLOW` | `DEFER` | Require human approval |
| `RED` | `DENY` | Block with warning |
| `BLOCKED` | `DENY` | Hard block, no override |

## Database Schema

### `omni_policies` Table

```sql
CREATE TABLE omni_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 100,
    match JSONB DEFAULT '{}',
    decision TEXT NOT NULL,
    lane TEXT NOT NULL,
    reason TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (name, version)
);
```

## Audit Trail

Every policy evaluation is logged via OmniTrace:

```python
await log_audit_event(
    actor_id=ctx.get("user_id", "unknown"),
    action=AuditAction.CONFIG_CHANGE,
    resource_type=AuditResourceType.SECURITY_POLICY,
    resource_id=f"{decision['policy_name']}@{decision['policy_version']}",
    status=AuditStatus.SUCCESS,
    custom_fields={
        "ctx_hash": _hash_ctx(ctx),
        "policy_decision": decision["decision"]
    }
)
```

## Best Practices

1. **Use Low Priority Numbers for Critical Policies** - Priority 1-10 for security-critical rules
2. **Version Policies** - Increment version when updating, never modify in place
3. **Test Policies** - Use simulation mode to validate before enabling
4. **Monitor Cache** - Adjust TTL based on policy change frequency
5. **Default Allow** - System defaults to ALLOW if no policies match
