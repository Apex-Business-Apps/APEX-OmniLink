# MAESTRO Operational Runbook

## Overview

MAESTRO (Multi-Agent Execution Security & Trust Orchestrator) provides browser-only AI execution with end-to-end encryption, allowlist-based security, and human-in-the-loop approval for high-risk operations.

## Enable/Disable MAESTRO

### Enable MAESTRO
```bash
# Set environment variable
export VITE_MAESTRO_ENABLED=true

# For production deployment
# Set in Vercel/Netlify environment variables
VITE_MAESTRO_ENABLED=true
```

### Disable MAESTRO
```bash
# Immediate disable (preserves existing behavior)
export VITE_MAESTRO_ENABLED=false

# For production rollback
# Set in deployment platform environment variables
VITE_MAESTRO_ENABLED=false
```

### Health Check
```bash
# Check MAESTRO status
curl https://your-domain.com/maestro-health

# Response when enabled:
{
  "status": "healthy",
  "maestro_enabled": true,
  "version": "1.0.0"
}

# Response when disabled:
{
  "status": "disabled",
  "maestro_enabled": false
}
```

## Incident Playbooks

### IndexedDB Corruption

**Symptoms:**
- MAESTRO initialization fails
- Console errors: "Failed to open maestro_secrets DB"
- Crypto operations fail with "Key not found"

**Diagnosis:**
```javascript
// Check IndexedDB in browser console
indexedDB.databases().then(dbs => console.log(dbs));
// Look for 'maestro_secrets' database
```

**Recovery:**
1. **Clear MAESTRO data:**
   ```javascript
   // In browser console
   indexedDB.deleteDatabase('maestro_secrets');
   ```

2. **Reload page** - MAESTRO will generate new encryption keys

3. **Verify recovery:**
   ```javascript
   // Check console for successful initialization
   // Look for: "[MAESTRO] Initialized successfully"
   ```

**Prevention:**
- No specific prevention needed (ephemeral keys by design)
- Document encourages clearing browser data for security

### Key Loss Recovery

**Symptoms:**
- MAESTRO operations fail with "Crypto initialization failed"
- No existing keys found in IndexedDB

**Recovery:**
1. **Automatic recovery** - MAESTRO generates new keys on next page load
2. **No user action required** - transparent to end users
3. **Verify:** Check console for successful key generation

**Note:** Key loss is expected behavior for session-based security. No manual recovery needed.

### Quota Exceeded (IndexedDB Storage)

**Symptoms:**
- Console warnings: "Failed to save key: QuotaExceededError"
- MAESTRO falls back to memory-only operation

**Recovery:**
1. **Clear browser storage:**
   ```javascript
   // Clear all site data
   localStorage.clear();
   sessionStorage.clear();
   indexedDB.deleteDatabase('maestro_secrets');
   ```

2. **Reload page** - MAESTRO will reinitialize

**Prevention:**
- Monitor storage usage in browser dev tools
- MAESTRO gracefully degrades to memory-only mode

### Partial Sync Failure

**Symptoms:**
- Local execution succeeds but server sync fails
- Console warnings: "Server sync failed, proceeding with local execution"
- Audit logs missing for some operations

**Recovery:**
1. **Check network connectivity**
2. **Verify Supabase service status**
3. **Check browser network tab for failed requests to `/maestro-sync`**

**Prevention:**
- MAESTRO continues execution even if sync fails (fail-open for UX)
- Implement retry logic with exponential backoff
- Monitor sync success rates

### Offline Operation

**Symptoms:**
- MAESTRO works normally when offline
- No sync attempts made
- Console shows: "Server sync unreachable"

**Expected Behavior:**
- MAESTRO works entirely offline (browser-only compute)
- Receipts claimed locally (no server dependency)
- Operations queue for sync when back online

**Recovery:**
- No recovery needed - this is intended behavior
- Sync resumes automatically when connection restored

### Receipt Conflicts

**Symptoms:**
- Duplicate operations blocked
- Console: "Idempotent execution - returning prior result"
- Operations return `{ idempotent: true }`

**Diagnosis:**
```javascript
// Check receipt claim response
fetch('/functions/v1/maestro-sync/claim-receipt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'tenant-123',
    idempotency_key: 'conflict-key',
    trace_id: 'trace-123',
    action: 'email.send'
  })
}).then(r => r.json()).then(console.log);
```

**Recovery:**
1. **Expected behavior** - conflicts prevent duplicate execution
2. **No manual intervention needed**
3. **Verify:** Check that only one side effect occurred

## Safe Degrade Behavior

### When MAESTRO is Disabled
- All operations bypass MAESTRO entirely
- No network calls to maestro-sync
- No state changes or side effects blocked
- Previous system behavior preserved

### When Server is Unreachable
- Local execution continues (fail-open)
- Receipts claimed locally
- Sync attempts resume when connection restored
- No data loss

### When Crypto Fails
- MAESTRO disables itself automatically
- Falls back to unencrypted operation
- Console warning logged
- No user-facing disruption

### When Validation Fails
- Operations blocked with clear error messages
- Risk events logged to console
- No side effects executed
- User can retry with corrected parameters

## Monitoring & Alerting

### Key Metrics to Monitor
```javascript
// MAESTRO health check endpoint
{
  "maestro_enabled": true,
  "crypto_initialized": true,
  "receipt_claims_today": 150,
  "sync_success_rate": 0.98,
  "man_mode_escalations": 2,
  "blocked_operations": 5
}
```

### Alert Conditions
- **High Priority:** Receipt claim failures > 5%
- **Medium Priority:** Sync success rate < 95%
- **Low Priority:** MAN mode escalations > 10/hour

### Log Patterns to Watch
```
[MAESTRO RISK] - Security violations
[MAESTRO] Escalating to MAN mode - Human approval needed
[MAESTRO] Idempotent execution - Duplicate prevented
```

## Deployment Checklist

### Pre-Deployment
- [ ] `VITE_MAESTRO_ENABLED=false` in staging
- [ ] Test MAESTRO disable/enable toggle
- [ ] Verify crypto initialization
- [ ] Check receipt claiming works
- [ ] Test MAN mode escalation

### Production Enable
- [ ] Enable gradually (feature flag)
- [ ] Monitor error rates
- [ ] Have rollback plan ready
- [ ] Document incident response procedures

### Rollback Plan
1. Set `VITE_MAESTRO_ENABLED=false`
2. Clear browser IndexedDB: `indexedDB.deleteDatabase('maestro_secrets')`
3. Reload all user sessions
4. Monitor for any stuck operations
