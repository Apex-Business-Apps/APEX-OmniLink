# MAESTRO

**M.A.E.S.T.R.O. = Memory Augmented Execution Synchronization To Reproduce Orchestration**

**Multi-Agent Execution with Safe Translation and Risk Orchestration**

MAESTRO is a secure intent execution framework designed to safely process and execute agent-generated actions while preventing prompt injection attacks and maintaining comprehensive audit trails.

## Overview

MAESTRO provides enterprise-grade safety and reliability for agent operations through:

- **Risk-Based Routing** — Automatic classification into **GREEN / YELLOW / RED / BLOCKED** lanes
- **Injection Detection** — Pattern-based detection + sanitization to reduce prompt-injection risk
- **Action Allowlisting** — Strict control over executable actions
- **Idempotency** — SHA-256 based deduplication (receipt-enforced) to prevent duplicate side effects
- **MAN Mode** — Manual Approval Needed escalation for high-risk operations
- **Audit Logging** — Structured risk events with trace correlation

## Quick Start

```typescript
import {
  executeIntent,
  securityScan,
  type MaestroIntent,
} from "@/integrations/maestro";

// 1) Scan user input for injection attempts
const scanResult = securityScan(userInput);
if (!scanResult.passed) {
  console.error(
    "Security check failed:",
    scanResult.injection_result.patterns_matched
  );
  return;
}

// 2) Create and execute an intent
const intent: MaestroIntent = {
  intent_id: crypto.randomUUID(),
  idempotency_key: generateIdempotencyKey(), // 64-char hex (SHA-256)
  tenant_id: "tenant-123",
  user_id: "user-456",
  session_id: "session-789",
  action: "log_message",
  parameters: { message: scanResult.sanitized ?? userInput },
  locale: "en-US",
};

const result = await executeIntent(intent);
if (result.success) {
  console.log("Executed:", result.data);
} else {
  console.error("Blocked:", result.error, "Lane:", result.risk_lane);
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAESTRO Framework                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Security   │    │  Validation  │    │  Execution   │       │
│  │    Scan      │───▶│    Layer    │───▶│   Engine     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Injection   │    │   Action     │    │    Risk      │       │
│  │  Detection   │    │  Allowlist   │    │   Events     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Risk Lanes

| Lane | Description | Default Behavior |
|------|-------------|------------------|
| **GREEN** | Safe operation | Execute immediately |
| **YELLOW** | Low-risk warning | Execute with logging and tighter budgets |
| **RED** | High-risk detected | Block automatic execution; escalate to MAN mode |
| **BLOCKED** | Critical threat | Block execution; require security review |

## Core Modules (high level)

- **Execution Engine** (`execution/*`): validates intents, enforces allowlists + idempotency, routes to MAN mode, executes allowlisted actions.
- **Safety Module** (`safety/*`): injection detection, sanitization, and risk event logging.
- **Docs** (`docs/*`): API, security guidance, changelog.

## Documentation

- API reference: `docs/API.md`
- Security guide: `docs/SECURITY.md`
- Changelog: `docs/CHANGELOG.md`

## License

Proprietary — APEX Business Systems
