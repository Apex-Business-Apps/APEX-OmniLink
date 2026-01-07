# MAN. Mode Operator Runbook

## Overview
MAN (Manual Assistance Needed) Mode is a safety valve that intercepts high-risk actions (e.g., deletions, payments) and forces a human review before execution.

## 🚦 Lanes
| Lane | Meaning | Action |
| :--- | :--- | :--- |
| **GREEN** | Safe | Auto-execute |
| **YELLOW** | Warning | Auto-execute + Log Warning |
| **RED** | Critical | **BLOCK** & Wait for Decision |
| **BLOCKED** | Prohibited | Auto-Deny |

## 🛠 Operator Actions

### 1. View Pending Tasks
Pending tasks are stored in the `man_tasks` database table.

**API:**
`GET /api/v1/man/tasks?tenant_id=default`

### 2. Submit Decision
To unblock a workflow, send a decision to the API.

**API:**
`POST /api/v1/man/tasks/{task_id}/decision`

**Payloads:**

**Approve:**
```json
{
  "status": "APPROVED",
  "reason": "Verified by phone",
  "operator_id": "ops-jane"
}
```

**Deny:**
```json
{
  "status": "DENIED",
  "reason": "Suspicious activity detected",
  "operator_id": "ops-jane"
}
```

**Modify Parameters (e.g., change payment amount):**
```json
{
  "status": "MODIFIED",
  "modified_input": { "amount": 500 },
  "reason": "Reduced amount to limit",
  "operator_id": "ops-jane"
}
```

## 🚨 Emergency Override
If Temporal is down or the API is unresponsive, you can manually resolve tasks in the Database.

**SQL:**
```sql
UPDATE man_tasks 
SET status = 'APPROVED', 
    decision = '{"status": "APPROVED", "reason": "Emergency SQL Override"}'::jsonb 
WHERE id = 'uuid-here';
```
*Note: The workflow will pick this up on the next retry/poll.*
