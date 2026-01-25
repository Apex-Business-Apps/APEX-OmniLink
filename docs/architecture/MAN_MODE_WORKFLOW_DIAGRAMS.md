# MAN Mode Workflow Diagrams

> Manual Assistance Needed (MAN) Mode - Visual Architecture Reference

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Risk Classification Flow](#risk-classification-flow)
3. [Approval Task State Machine](#approval-task-state-machine)
4. [Temporal Workflow Integration](#temporal-workflow-integration)
5. [Database Interaction Flow](#database-interaction-flow)
6. [Component Dependencies](#component-dependencies)

---

## System Architecture Overview

```mermaid
flowchart TB
    subgraph Agent["Agent Workflow"]
        A[Agent Action Request]
    end

    subgraph MAN["MAN Mode Safety Gate"]
        B[Policy Engine]
        C{Risk Classification}
        D[Task Manager]
    end

    subgraph Storage["Persistence Layer"]
        E[(man_tasks table)]
        F[Audit Log]
    end

    subgraph Human["Human Review"]
        G[Approval Dashboard]
        H[Operator Decision]
    end

    A --> B
    B --> C
    C -->|GREEN| I[Execute Immediately]
    C -->|YELLOW| J[Execute + Audit]
    C -->|RED| D
    C -->|BLOCKED| K[Reject]

    D --> E
    D --> G
    G --> H
    H --> E

    J --> F
    I --> F
```

---

## Risk Classification Flow

```mermaid
flowchart TD
    START([ActionIntent Received]) --> CHECK_BLOCKED

    subgraph Classification["Risk Classification Pipeline"]
        CHECK_BLOCKED{Tool in<br/>BLOCKED_TOOLS?}
        CHECK_SENSITIVE{Tool in<br/>SENSITIVE_TOOLS?}
        CHECK_IRREVERSIBLE{irreversible<br/>= true?}
        CHECK_PARAMS{High-risk<br/>params count?}
        CHECK_SAFE{Tool in<br/>SAFE_TOOLS?}
    end

    CHECK_BLOCKED -->|Yes| BLOCKED[/"BLOCKED Lane<br/>Reject Immediately"/]
    CHECK_BLOCKED -->|No| CHECK_SENSITIVE

    CHECK_SENSITIVE -->|Yes| RED1[/"RED Lane<br/>Requires Approval"/]
    CHECK_SENSITIVE -->|No| CHECK_IRREVERSIBLE

    CHECK_IRREVERSIBLE -->|Yes| RED2[/"RED Lane<br/>Requires Approval"/]
    CHECK_IRREVERSIBLE -->|No| CHECK_PARAMS

    CHECK_PARAMS -->|"≥ 2"| RED3[/"RED Lane<br/>Requires Approval"/]
    CHECK_PARAMS -->|"= 1"| YELLOW[/"YELLOW Lane<br/>Execute + Audit"/]
    CHECK_PARAMS -->|"= 0"| CHECK_SAFE

    CHECK_SAFE -->|Yes| GREEN[/"GREEN Lane<br/>Auto-Execute"/]
    CHECK_SAFE -->|No| YELLOW2[/"YELLOW Lane<br/>Unknown Tool"/]

    style BLOCKED fill:#1a1a1a,stroke:#ef4444,color:#ef4444
    style RED1 fill:#1a1a1a,stroke:#ef4444,color:#ef4444
    style RED2 fill:#1a1a1a,stroke:#ef4444,color:#ef4444
    style RED3 fill:#1a1a1a,stroke:#ef4444,color:#ef4444
    style YELLOW fill:#1a1a1a,stroke:#eab308,color:#eab308
    style YELLOW2 fill:#1a1a1a,stroke:#eab308,color:#eab308
    style GREEN fill:#1a1a1a,stroke:#22c55e,color:#22c55e
```

---

## Approval Task State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: create_man_task()

    PENDING --> APPROVED: resolve_man_task(APPROVED)
    PENDING --> DENIED: resolve_man_task(DENIED)
    PENDING --> EXPIRED: expiration_cron()
    PENDING --> ESCALATED: escalate_task()

    APPROVED --> [*]: Action can be re-executed
    DENIED --> [*]: Action permanently blocked
    EXPIRED --> [*]: Timeout reached
    ESCALATED --> PENDING: Higher-level review

    note right of PENDING
        Task awaiting human decision
        - Stored in man_tasks table
        - Visible in approval dashboard
        - Has configurable timeout
    end note

    note right of APPROVED
        Human approved the action
        - decision.status = APPROVED
        - decision.reason recorded
        - decided_by = operator ID
    end note

    note right of DENIED
        Human rejected the action
        - decision.status = DENIED
        - decision.reason recorded
        - Action will not execute
    end note
```

---

## Temporal Workflow Integration

```mermaid
sequenceDiagram
    participant W as Workflow
    participant RT as risk_triage Activity
    participant P as ManPolicy
    participant CT as create_man_task Activity
    participant DB as Supabase
    participant H as Human Operator
    participant GT as get_man_task Activity

    W->>RT: Execute risk_triage(intent)
    RT->>P: triage(ActionIntent)
    P-->>RT: RiskTriageResult
    RT-->>W: {lane, reason, requires_approval}

    alt lane == GREEN
        W->>W: Execute action immediately
    else lane == YELLOW
        W->>W: Execute action + log audit
    else lane == RED
        W->>CT: create_man_task(intent, triage)
        CT->>DB: INSERT INTO man_tasks
        DB-->>CT: task_id
        CT-->>W: {task_id, status: PENDING}
        W->>W: Continue workflow (non-blocking)

        Note over H,DB: Async: Human reviews in dashboard
        H->>DB: UPDATE man_tasks SET status=APPROVED

        Note over W,GT: Later: Check decision
        W->>GT: get_man_task(task_id)
        GT->>DB: SELECT * FROM man_tasks
        DB-->>GT: task record
        GT-->>W: {status: APPROVED}
    else lane == BLOCKED
        W->>W: Raise ApplicationError
    end
```

---

## Database Interaction Flow

```mermaid
flowchart LR
    subgraph Activities["Temporal Activities"]
        A1[create_man_task]
        A2[resolve_man_task]
        A3[get_man_task]
        A4[check_man_decision]
    end

    subgraph Database["Supabase / PostgreSQL"]
        subgraph Table["man_tasks"]
            T1[id: UUID]
            T2[idempotency_key: TEXT]
            T3[workflow_id: TEXT]
            T4[status: ENUM]
            T5[intent: JSONB]
            T6[decision: JSONB]
        end

        subgraph Indexes["Indexes"]
            I1[idx_pending - Partial B-tree]
            I2[idx_workflow - B-tree]
            I3[idx_intent_gin - GIN]
            I4[idx_tool_name - Functional]
        end
    end

    A1 -->|"UPSERT<br/>(idempotency_key)"| Table
    A2 -->|"UPDATE<br/>(task_id)"| Table
    A3 -->|"SELECT<br/>(task_id)"| Table
    A4 -->|"SELECT<br/>(workflow_id, step_id)"| Table

    Table --> Indexes
```

---

## Component Dependencies

```mermaid
flowchart BT
    subgraph Models["models/man_mode.py"]
        M1[ManLane]
        M2[ManTaskStatus]
        M3[ActionIntent]
        M4[RiskTriageResult]
        M5[ManTaskDecision]
        M6[ManTask]
    end

    subgraph Policy["policies/man_policy.py"]
        P1[ManPolicy]
        P2[SENSITIVE_TOOLS]
        P3[BLOCKED_TOOLS]
        P4[SAFE_TOOLS]
    end

    subgraph Activities["activities/man_mode.py"]
        A1[risk_triage]
        A2[create_man_task]
        A3[resolve_man_task]
        A4[get_man_task]
    end

    subgraph Workflow["workflows/agent_saga.py"]
        W1[AgentSagaWorkflow]
    end

    subgraph DB["Database Migration"]
        D1[man_tasks table]
        D2[Indexes]
        D3[RLS Policies]
    end

    P1 --> M1
    P1 --> M3
    P1 --> M4

    A1 --> P1
    A2 --> M3
    A2 --> M4
    A3 --> M5
    A4 --> M6

    W1 --> A1
    W1 --> A2
    W1 --> A3
    W1 --> A4

    A2 --> D1
    A3 --> D1
    A4 --> D1
```

---

## High-Risk Parameter Detection

```mermaid
flowchart TD
    PARAMS[ActionIntent.params] --> SCAN{Scan Parameters}

    SCAN --> CHK_AMT{amount/value/quantity<br/>≥ 10,000?}
    SCAN --> CHK_SCOPE{scope =<br/>all/global/system?}
    SCAN --> CHK_FORCE{force = true?}
    SCAN --> CHK_CASCADE{cascade = true?}
    SCAN --> CHK_ADMIN{admin = true?}

    CHK_AMT -->|Yes| RF1[Risk Factor +1]
    CHK_SCOPE -->|Yes| RF2[Risk Factor +1]
    CHK_FORCE -->|Yes| RF3[Risk Factor +1]
    CHK_CASCADE -->|Yes| RF4[Risk Factor +1]
    CHK_ADMIN -->|Yes| RF5[Risk Factor +1]

    RF1 --> COUNT
    RF2 --> COUNT
    RF3 --> COUNT
    RF4 --> COUNT
    RF5 --> COUNT

    COUNT{Total Risk<br/>Factors} -->|"≥ 2"| RED[RED Lane]
    COUNT -->|"= 1"| YELLOW[YELLOW Lane]
    COUNT -->|"= 0"| CONTINUE[Continue to<br/>Safe Check]

    style RED fill:#1a1a1a,stroke:#ef4444,color:#ef4444
    style YELLOW fill:#1a1a1a,stroke:#eab308,color:#eab308
```

---

## Non-Blocking Isolation Pattern

```mermaid
flowchart LR
    subgraph Workflow["Agent Workflow Timeline"]
        S1[Step 1<br/>GREEN] --> S2[Step 2<br/>RED] --> S3[Step 3<br/>GREEN] --> S4[Step 4<br/>YELLOW]
    end

    subgraph Execution["Execution"]
        E1[Execute]
        E2[Isolate]
        E3[Execute]
        E4[Execute + Audit]
    end

    subgraph MAN["MAN Task Queue"]
        M1[Task Created<br/>PENDING]
        M2[Awaiting<br/>Approval]
    end

    S1 -.-> E1
    S2 -.-> E2
    S3 -.-> E3
    S4 -.-> E4

    E2 --> M1
    M1 --> M2

    style S2 fill:#1a1a1a,stroke:#ef4444,color:#ef4444
    style E2 fill:#1a1a1a,stroke:#ef4444,color:#ef4444
    style M1 fill:#1a1a1a,stroke:#f97316,color:#f97316
    style M2 fill:#1a1a1a,stroke:#f97316,color:#f97316
```

**Key Insight**: RED lane actions do not block the workflow. The action is recorded for human review while subsequent steps continue executing. This prioritizes workflow throughput over synchronous approval.

---

## Tool Classification Quick Reference

| Category | Tools | Lane |
|----------|-------|------|
| **Financial** | transfer_funds, process_payment, refund_payment | RED |
| **Destructive** | delete_record, delete_user, purge_data, drop_table | RED |
| **Account Mgmt** | deactivate_account, suspend_user, revoke_access | RED |
| **System** | modify_config, update_secrets, deploy_code | RED |
| **Communication** | send_email, send_sms, broadcast_message | RED |
| **Prohibited** | execute_sql_raw, shell_execute, admin_override | BLOCKED |
| **Read-Only** | search_database, read_record, get_config | GREEN |
| **Unknown** | Any tool not in above lists | YELLOW |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-08 | Initial MAN Mode implementation |
| 1.0.1 | 2026-01-09 | Performance optimizations, GIN indexes, diagram documentation |

---

*Document generated for APEX OmniHub Orchestrator. Diagrams render in GitHub-flavored Markdown with Mermaid support.*
