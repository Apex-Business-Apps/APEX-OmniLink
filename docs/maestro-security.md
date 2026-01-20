# MAESTRO Security Architecture

## Overview

MAESTRO implements a defense-in-depth security model for browser-based AI execution with end-to-end encryption, allowlist-based access control, and database-enforced idempotency.

## Threat Model Mapping

### OWASP Top 10 Coverage

| OWASP Risk | MAESTRO Protection | Implementation |
|------------|-------------------|----------------|
| **A01:2021 - Broken Access Control** | Allowlist enforcement, risk lane validation | Canonical action types restricted to predefined set |
| **A02:2021 - Cryptographic Failures** | E2E encryption, WebCrypto API | AES-GCM encryption with non-exportable keys |
| **A03:2021 - Injection** | Schema validation, allowlist | Strict type checking, no dynamic execution |
| **A04:2021 - Insecure Design** | Fail-closed design, idempotency | All operations validate before execution |
| **A05:2021 - Security Misconfiguration** | Environment-based enable/disable | Feature flag controls all MAESTRO functionality |
| **A06:2021 - Vulnerable Components** | Browser-only compute | No server-side inference, minimal attack surface |
| **A07:2021 - Identification/Authentication** | User confirmation requirement | All side effects require explicit user consent |
| **A08:2021 - Software/Data Integrity** | Receipt claiming, audit trails | DB-enforced uniqueness prevents duplicate execution |
| **A09:2021 - Security Logging** | Comprehensive audit logging | All operations logged with full context |
| **A10:2021 - Server-Side Request Forgery** | No SSRF vectors | Browser-only, no server-side requests from MAESTRO |

## Plaintext Rejection Guarantees

### No Sensitive Data in Execution
- **Params restriction**: Only minimal, non-sensitive parameters allowed
- **Memory isolation**: Sensitive data never decrypted in execution context
- **Validation gates**: All inputs validated against strict schemas

### Encryption Boundaries
```
User Input → [Validation] → [Encryption] → Server Storage
                                       ↓
Browser Execution ← [Decryption] ← [Receipt Claim]
```

- **Server never decrypts**: Encrypted blobs stored as opaque data
- **Browser-only decryption**: Keys never leave client device
- **Ephemeral keys**: New keys generated per session

## Allowlist + Receipt Claim Ordering

### Security Control Flow

```
1. Input Validation     → Schema compliance, type safety
2. Allowlist Check      → Canonical action verification
3. Risk Assessment      → Lane assignment (GREEN/YELLOW/RED/BLOCKED)
4. Translation Check    → OK/FAILED status validation
5. Confidence Threshold → ≥0.7 required for execution
6. User Confirmation    → Explicit consent required
7. Receipt Claim        → Atomic DB lock (idempotency)
8. Execution            → Controlled action dispatch
9. Audit Logging        → Full operation record
```

### Atomic Receipt Claim
```sql
-- Single SQL operation prevents race conditions
INSERT INTO maestro_execution_receipts (tenant_id, idempotency_key, ...)
VALUES ($1, $2, ...)
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
RETURNING claimed;
```

**Guarantees:**
- **Uniqueness**: `(tenant_id, idempotency_key)` enforced at DB level
- **Atomicity**: Either claimed or already claimed - no partial states
- **Consistency**: Receipt state consistent across all execution attempts

## Logging + Retention Strategy

### Audit Log Schema
```sql
CREATE TABLE maestro_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT REFERENCES maestro_sync_store(idempotency_key),
    action TEXT NOT NULL,           -- Canonical action type
    status TEXT NOT NULL,           -- 'success', 'blocked', 'failed'
    risk_lane TEXT,                 -- 'GREEN', 'YELLOW', 'RED', 'BLOCKED'
    confidence NUMERIC,             -- AI confidence score
    translation_status TEXT,        -- 'OK', 'FAILED'
    ip INNODB,                      -- Client IP for fraud detection
    user_agent TEXT,                -- Browser fingerprinting
    trace_id TEXT,                  -- Request correlation
    error_message TEXT,             -- Failure details (if applicable)
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Retention Policies
- **Active operations**: 30 days (for debugging/reconciliation)
- **Audit trail**: 7 years (compliance requirement)
- **Encrypted storage**: 90 days (ephemeral by design)

### Log Security
- **No sensitive data**: Only metadata and correlation IDs logged
- **PII redaction**: Automatic removal of personal information
- **Tamper-evident**: Logs append-only, cryptographically signed

## Risk Lane Definitions

### GREEN Lane (Auto-Execute)
**Criteria:**
- Allowlisted action type
- Translation status: OK
- Confidence: ≥0.7
- Risk assessment: Low

**Examples:**
- `email.send` (personal communication)
- `calendar.schedule` (organizational tools)
- `notification.show` (UI feedback)

### YELLOW Lane (Execute with Caution)
**Criteria:**
- Allowlisted action type
- Translation status: OK
- Confidence: ≥0.7
- Risk assessment: Medium

**Behavior:**
- Execute but log warnings
- Additional monitoring
- May escalate based on policy

### RED Lane (MAN Mode Required)
**Criteria:**
- Allowlisted action type
- Translation status: OK
- Confidence: ≥0.7
- Risk assessment: High

**Behavior:**
- Block automatic execution
- Escalate to human approval
- Create MAN mode task

### BLOCKED Lane (Always Denied)
**Criteria:**
- Non-allowlisted action
- Translation status: FAILED
- Confidence: <0.7
- Any high-risk pattern detected

**Behavior:**
- Immediate rejection
- Risk event logging
- No execution attempted

## Man-in-the-Loop (MAN Mode) Integration

### Escalation Triggers
- RED risk lane actions
- Confidence below threshold
- Translation failures
- Policy-based rules

### MAN Task Creation
```typescript
const manTask = {
    idempotency_key: intent.idempotency_key,
    workflow_id: `maestro-${intent.trace_id}`,
    step_id: 'execution-intent',
    intent: {
        tool_name: intent.canonical_action_type,
        params: intent.params,
        context: {
            risk_lane: intent.risk_lane,
            confidence: intent.confidence,
            translation_status: intent.translation_status
        }
    }
};
```

### Approval Workflow
1. **Task Creation**: MAESTRO creates durable MAN task
2. **Human Review**: Operator evaluates risk and approves/denies
3. **Re-execution**: Approved tasks bypass validation gates
4. **Audit Trail**: Full approval record maintained

## Offline Security Model

### Offline Operation Guarantees
- **Receipt claiming works offline**: Local idempotency tracking
- **No server dependency**: Execution succeeds without network
- **Sync on reconnection**: Audit logs uploaded when online
- **Conflict resolution**: Server-side conflict detection

### Offline Attack Vectors Mitigated
- **Replay attacks**: Idempotency keys prevent duplicate execution
- **Manipulation**: Local validation before execution
- **Data leakage**: No sensitive data leaves device when offline

## Failure Mode Analysis

### Fail-Closed Design
All security failures default to **blocking execution**:

| Component | Failure Mode | Behavior |
|-----------|--------------|----------|
| Crypto | Key generation fails | Disable MAESTRO, log error |
| Validation | Schema validation fails | Block execution, log risk |
| Receipt Claim | DB unavailable | Fail closed, no execution |
| Sync | Network unavailable | Continue with local execution |
| Allowlist | Action not found | Block execution, log risk |

### Graceful Degradation
- **Partial failures**: Continue with reduced functionality
- **Complete failures**: Disable MAESTRO entirely
- **Recovery**: Automatic on next session/page load

## Compliance Considerations

### Data Protection
- **GDPR**: No PII stored without consent
- **CCPA**: Data minimization principles
- **SOX**: Audit trail integrity

### Security Standards
- **NIST**: Risk-based access control
- **ISO 27001**: Information security management
- **Zero Trust**: Every request validated

## Monitoring & Alerting

### Security Metrics
```javascript
// Real-time security dashboard
{
  "blocked_operations": 15,      // Last 24h
  "man_mode_escalations": 3,     // Last 24h
  "receipt_claim_failures": 0,   // Last 1h
  "translation_failures": 2,     // Last 24h
  "confidence_below_threshold": 8 // Last 24h
}
```

### Alert Thresholds
- **Critical**: Receipt claim failures > 1% of operations
- **High**: Blocked operations > 100/hour
- **Medium**: MAN mode escalations > 50/hour
- **Low**: Translation failures > 10/hour

## Penetration Testing Results

### Tested Attack Vectors
- [x] **Injection attacks**: Allowlist prevents unauthorized actions
- [x] **Replay attacks**: Idempotency prevents duplicate execution
- [x] **Man-in-the-middle**: E2E encryption protects data in transit
- [x] **Privilege escalation**: Risk lanes prevent unauthorized operations
- [x] **Denial of service**: Receipt claiming prevents resource exhaustion

### Known Limitations
- **Browser dependency**: Security relies on WebCrypto API integrity
- **Session scope**: Keys lost on browser restart (by design)
- **Network dependency**: Some operations require connectivity for MAN mode

## Future Security Enhancements

### Planned Improvements
- **Hardware-backed crypto**: TPM integration for key storage
- **Multi-party computation**: Distributed trust for high-value operations
- **Behavioral analysis**: ML-based anomaly detection
- **Quantum resistance**: Post-quantum cryptographic algorithms

---

## Security Summary

MAESTRO implements **defense-in-depth** with multiple security layers:

1. **Input Validation** (Schema compliance)
2. **Access Control** (Allowlist enforcement)
3. **Risk Assessment** (Lane-based routing)
4. **Authorization** (User confirmation required)
5. **Idempotency** (DB-enforced uniqueness)
6. **Encryption** (E2E with WebCrypto)
7. **Audit** (Comprehensive logging)
8. **Fail-Closed** (Secure defaults)

**Result**: Browser-based AI execution with enterprise-grade security controls.
