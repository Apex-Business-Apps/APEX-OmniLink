# OmniPort API Reference

**The Proprietary Ingress Engine for APEX OmniHub**

> Fortified, high-speed ingress fortress implementing Zero-Trust validation, idempotent execution, and MAN Mode governance.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
3. [API Reference](#api-reference)
4. [Type Definitions](#type-definitions)
5. [Configuration](#configuration)
6. [Observability](#observability)
7. [Voice Commands](#voice-commands)
8. [Error Handling](#error-handling)
9. [Database Schema](#database-schema)

---

## Quick Start

```typescript
import {
  ingest,
  processVoiceCommand,
  getOmniPortMetrics,
  getOmniPortStatus
} from '@/omniconnect/ingress';

// Basic text ingestion
const result = await ingest({
  type: 'text',
  content: 'Hello, process this request',
  source: 'web',
  userId: '550e8400-e29b-41d4-a716-446655440000'
});

console.log(result);
// { correlationId: 'abc123', status: 'accepted', latencyMs: 2, riskLane: 'GREEN' }
```

---

## Core Concepts

### Execution Pipeline

```
RawInput → Zero-Trust Gate → Idempotency Wrapper → Semantic Normalization → Resilient Dispatch
```

1. **Zero-Trust Gate**: Validates device identity against `DeviceRegistry`
2. **Idempotency Wrapper**: Deduplicates requests using FNV-1a hash
3. **Semantic Normalization**: Maps input to `CanonicalEvent` with MAN Mode analysis
4. **Resilient Dispatch**: Delivers with circuit breaker and DLQ fallback

### Risk Classification

| Lane | Trigger | Behavior |
|------|---------|----------|
| **GREEN** | Normal content, trusted device | Standard processing |
| **RED** | Suspect device OR high-risk intent | Flag `requires_man_approval = true` |
| **BLOCKED** | Device status = `blocked` | Throw `SecurityError`, reject immediately |

### High-Risk Intents (MAN Mode Triggers)

The following keywords automatically trigger RED lane and MAN Mode:
- `delete` - Data deletion operations
- `transfer` - Financial or data transfer operations
- `grant_access` - Permission elevation operations

---

## API Reference

### `ingest(input: RawInput): Promise<IngestResult>`

Process raw input through the defensive ingestion pipeline.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `input` | `RawInput` | Text, voice, or webhook input |

**Returns:** `Promise<IngestResult>`

**Throws:** `SecurityError` if device is blocked

**Example:**
```typescript
const result = await ingest({
  type: 'text',
  content: 'Show dashboard metrics',
  source: 'web',
  userId: 'user-uuid'
});
```

### `validateAndIngest(input: unknown): Promise<IngestResult>`

Validate unknown input against Zod schemas, then ingest.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `input` | `unknown` | Unvalidated input data |

**Returns:** `Promise<IngestResult>`

**Throws:** `ZodError` if validation fails, `SecurityError` if blocked

**Example:**
```typescript
try {
  const result = await validateAndIngest(requestBody);
} catch (error) {
  if (error instanceof ZodError) {
    console.error('Validation failed:', error.issues);
  }
}
```

---

## Type Definitions

### RawInput (Discriminated Union)

```typescript
type RawInput = TextSource | VoiceSource | WebhookSource;
```

#### TextSource

```typescript
interface TextSource {
  type: 'text';
  content: string;      // min length: 1
  source: 'web' | 'sms';
  userId: string;       // UUID format
}
```

#### VoiceSource

```typescript
interface VoiceSource {
  type: 'voice';
  transcript: string;   // min length: 1
  confidence: number;   // 0.0 - 1.0
  audioUrl: string;     // valid URL
  durationMs: number;   // positive integer
  userId?: string;      // optional UUID
}
```

#### WebhookSource

```typescript
interface WebhookSource {
  type: 'webhook';
  payload: Record<string, unknown>;
  provider: string;     // min length: 1
  signature: string;    // min length: 1
  userId?: string;      // optional UUID
}
```

### IngestResult

```typescript
interface IngestResult {
  correlationId: string;
  status: 'accepted' | 'blocked' | 'buffered';
  latencyMs: number;
  riskLane: 'GREEN' | 'RED';
}
```

### SecurityError

```typescript
class SecurityError extends Error {
  code: string;         // e.g., 'DEVICE_BLOCKED'
  deviceId?: string;
  userId?: string;
}
```

---

## Configuration

OmniPort is configured via the singleton pattern and environment variables.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | Required |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Required |

### Programmatic Configuration

```typescript
import { OmniPortEngine } from '@/omniconnect/ingress';

// Get singleton instance
const omniPort = OmniPortEngine.getInstance();

// Initialize (idempotent)
omniPort.initialize();

// Reset for testing
OmniPortEngine.resetInstance();
```

---

## Observability

### Metrics Collection

```typescript
import { getOmniPortMetrics, getOmniPortStatus } from '@/omniconnect/ingress';

// Get aggregated metrics for last 60 seconds
const metrics = getOmniPortMetrics(60000);

console.log(metrics);
// {
//   totalIngestions: 150,
//   accepted: 145,
//   blocked: 2,
//   buffered: 3,
//   redLaneEvents: 5,
//   manModeTriggered: 3,
//   avgLatencyMs: 2.5,
//   p95LatencyMs: 8,
//   bySourceType: { text: 100, voice: 30, webhook: 20 },
//   windowStart: Date,
//   windowEnd: Date,
//   collectedAt: Date
// }
```

### Health Status

```typescript
const status = getOmniPortStatus();

console.log(status);
// {
//   health: 'healthy',      // 'healthy' | 'degraded' | 'critical'
//   initialized: true,
//   eventsPerSecond: 2.5,
//   dlqDepth: 0,
//   lastSuccessAt: Date,
//   lastError: null,
//   uptimeSeconds: 3600
// }
```

### Structured Logging

OmniPort emits structured logs with the following format:

```
[OmniPort] [<correlationId>] [<latencyMs>ms] <EVENT> <data>
```

**Events:**
- `INGEST_START` - Ingestion initiated
- `ZERO_TRUST_PASS` - Device validation passed
- `SUSPECT_DEVICE` - Suspect device detected (RED lane)
- `MAN_MODE_TRIGGERED` - High-risk intent detected
- `INGEST_ACCEPTED` - Successfully delivered
- `INGEST_BUFFERED` - Written to DLQ
- `SECURITY_BLOCKED` - Device blocked
- `DLQ_WRITE_SUCCESS` - DLQ write completed

---

## Voice Commands

### Quick Voice Command

```typescript
import { quickVoiceCommand, processVoiceCommand } from '@/omniconnect/ingress';

// Quick command (generates placeholder audio URL)
const result = await quickVoiceCommand(
  'Show me the sales report',
  'user-uuid',
  0.95  // confidence
);

// Full voice command with audio
const fullResult = await processVoiceCommand(
  'Transfer $500 to savings',
  0.92,
  'https://storage.example.com/audio/123.wav',
  3000,  // duration in ms
  'user-uuid'
);

console.log(fullResult);
// {
//   correlationId: 'abc123',
//   status: 'accepted',
//   latencyMs: 5,
//   riskLane: 'RED',
//   transcript: 'Transfer $500 to savings',
//   confidence: 0.92,
//   detectedIntents: ['transfer'],
//   manModeTriggered: true,
//   processingMs: 5
// }
```

### Voice Session Management

```typescript
import {
  startVoiceSession,
  endVoiceSession,
  configureVoiceHandler
} from '@/omniconnect/ingress';

// Configure voice handler
configureVoiceHandler({
  minConfidence: 0.7,
  maxDurationMs: 60000,
  forceManMode: false,
  wakeWords: ['apex', 'omni', 'hub']
});

// Start session
const session = startVoiceSession('user-uuid');
// { sessionId, userId, startedAt, commandCount: 0, isActive: true }

// Process commands...

// End session
endVoiceSession('user-uuid');
```

---

## Error Handling

### SecurityError

Thrown when a blocked device attempts ingestion.

```typescript
import { SecurityError } from '@/omniconnect/ingress';

try {
  await ingest(input);
} catch (error) {
  if (error instanceof SecurityError) {
    console.error(`Blocked: ${error.code}`);
    console.error(`Device: ${error.deviceId}`);
    console.error(`User: ${error.userId}`);
  }
}
```

### Validation Errors

Use `safeValidateRawInput` for non-throwing validation.

```typescript
import { safeValidateRawInput } from '@/omniconnect/ingress';

const result = safeValidateRawInput(unknownData);

if (result.success) {
  await ingest(result.data);
} else {
  console.error('Validation errors:', result.error.issues);
}
```

### Circuit Breaker (DLQ)

When delivery fails, OmniPort automatically:
1. Writes to `ingress_buffer` table
2. Returns `status: 'buffered'`
3. Continues without throwing

```typescript
const result = await ingest(input);

if (result.status === 'buffered') {
  console.log('Delivery failed, queued for retry');
  console.log('Correlation ID:', result.correlationId);
}
```

---

## Database Schema

### ingress_buffer (Dead Letter Queue)

```sql
CREATE TABLE ingress_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  raw_input JSONB NOT NULL,
  error_reason TEXT NOT NULL,
  status dlq_status NOT NULL DEFAULT 'pending',
  risk_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  source_type TEXT,
  user_id UUID
);
```

**Status Enum:** `pending`, `replaying`, `failed`

**Risk Score Calculation:**
- RED lane: +50
- High-risk intent detected: +30
- Voice with low confidence (<0.7): +10
- Webhook source: +10

### Helper Functions

```sql
-- Get pending entries prioritized by risk
SELECT * FROM get_pending_dlq_entries(100);

-- Claim entries for replay
SELECT claim_dlq_entries_for_replay(ARRAY['uuid1', 'uuid2']);

-- Cleanup old failed entries (30 day retention)
SELECT cleanup_old_dlq_entries(30);
```

---

## Migration from Legacy Adapters

If migrating from direct API calls to OmniPort:

1. **Replace direct HTTP calls:**
```typescript
// Before
const response = await fetch('/api/process', { body: JSON.stringify(data) });

// After
import { validateAndIngest } from '@/omniconnect/ingress';
const result = await validateAndIngest(data);
```

2. **Handle the new result format:**
```typescript
// Before: HTTP response
const success = response.ok;

// After: IngestResult
const success = result.status === 'accepted';
const needsReview = result.riskLane === 'RED';
```

3. **Add error handling for SecurityError:**
```typescript
try {
  const result = await ingest(input);
} catch (error) {
  if (error instanceof SecurityError) {
    // Handle blocked device
  }
}
```

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-23
**Maintained By:** APEX Platform Team
