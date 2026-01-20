# MAESTRO Rollback Guide

## Overview

This document provides procedures for safely rolling back MAESTRO (Multi-Agent Execution Security & Trust Orchestrator) in case of issues during deployment or operation.

## Immediate Rollback

### Method 1: Environment Variable (Recommended)
```bash
# Immediate rollback - no code changes needed
export VITE_MAESTRO_ENABLED=false

# For production deployments:
# Set VITE_MAESTRO_ENABLED=false in your deployment platform
# - Vercel: Environment Variables section
# - Netlify: Build settings > Environment variables
# - Railway: Variables tab
```

### Method 2: Feature Flag via CDN
If environment variables are not accessible:
```javascript
// Inject via CDN or script tag
window.MAESTRO_ENABLED = false;

// Or modify the built bundle (not recommended)
```

### Verification
```bash
# Check health endpoint
curl https://your-domain.com/maestro-health

# Should return:
{
  "status": "disabled",
  "maestro_enabled": false
}
```

## Rollback Strategy

### Phase 1: Disable MAESTRO (Immediate)
1. Set `VITE_MAESTRO_ENABLED=false`
2. Redeploy or restart application
3. **No database changes needed**
4. **No code reversion needed**

### Phase 2: Clear Client State (If Needed)
```javascript
// Run in browser console on affected user sessions
indexedDB.deleteDatabase('maestro_secrets');
localStorage.removeItem('maestro:*'); // If any localStorage used
sessionStorage.clear();
```

### Phase 3: Database Cleanup (Optional)
If you want to completely remove MAESTRO data:

```sql
-- Drop MAESTRO tables (irreversible!)
DROP TABLE IF EXISTS public.maestro_execution_receipts;
DROP TABLE IF EXISTS public.maestro_sync_store;
DROP TABLE IF EXISTS public.maestro_audit_logs;

-- Remove functions
DROP FUNCTION IF EXISTS public.maestro_claim_receipt;
```

### Phase 4: Code Reversion (Last Resort)
```bash
# Revert MAESTRO-related commits
git log --grep="MAESTRO\|maestro" --oneline
git revert <commit-hash>  # Revert specific commits
# OR
git reset --hard <commit-before-maestro>
```

## DB Migration Notes

### No Down Migrations Required
MAESTRO is designed for **safe rollback without down migrations**:

- **Receipts table**: New table, safe to drop or leave
- **Audit logs**: Append-only, safe to keep or truncate
- **Sync store**: Encrypted blobs, safe to drop

### Inert Tables Strategy
```sql
-- Mark tables as inert instead of dropping
COMMENT ON TABLE public.maestro_execution_receipts IS 'INERT: MAESTRO disabled - safe to drop';
COMMENT ON TABLE public.maestro_sync_store IS 'INERT: MAESTRO disabled - safe to drop';
COMMENT ON TABLE public.maestro_audit_logs IS 'INERT: MAESTRO disabled - safe to truncate';
```

### Migration Rollback Commands
```bash
# List MAESTRO migrations
ls supabase/migrations/*maestro*

# Revert specific migration (if needed)
supabase db reset --linked  # Reset to before MAESTRO migrations
```

## Verification Steps

### Automated Verification
```bash
# Run test suite without MAESTRO
npm test -- --testPathIgnorePatterns=maestro

# Verify no MAESTRO network calls
npm run test:e2e  # Should pass with MAESTRO disabled
```

### Manual Verification
1. **Check browser console:**
   ```
   [MAESTRO] Disabled by VITE_MAESTRO_ENABLED=false
   ```

2. **Verify operations work normally:**
   - Chat interactions work
   - No execution blocking
   - No MAN mode prompts

3. **Check database:**
   ```sql
   -- No new MAESTRO operations
   SELECT COUNT(*) FROM maestro_audit_logs
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

4. **Verify client state cleared:**
   ```javascript
   indexedDB.databases().then(dbs => {
     const maestroDB = dbs.find(db => db.name === 'maestro_secrets');
     console.log('MAESTRO DB exists:', !!maestroDB);
   });
   ```

## Rollback Timeline

### Immediate (< 5 minutes)
- Set `VITE_MAESTRO_ENABLED=false`
- Redeploy application
- Verify via health check

### Fast (< 1 hour)
- Clear client-side IndexedDB if needed
- Verify all user sessions updated
- Monitor error rates return to baseline

### Complete (< 4 hours)
- Database cleanup if desired
- Full test suite verification
- Documentation of incident

## Recovery After Rollback

### Re-enable MAESTRO
```bash
# Gradual re-enable
export VITE_MAESTRO_ENABLED=true

# Deploy and monitor
# Watch for errors in first 30 minutes
# Be prepared to rollback again if needed
```

### Data Recovery
- **No data loss** during rollback (MAESTRO is additive)
- Previous system state preserved
- User operations continue normally

## Emergency Contacts

### During Business Hours
- DevOps Lead: Check monitoring dashboards
- Security Team: Review for security incidents
- Product Team: Assess user impact

### After Hours
- On-call Engineer: Check runbooks first
- Emergency rollback: `VITE_MAESTRO_ENABLED=false` + redeploy

## Lessons Learned Template

After rollback, document:

```
Incident Date: YYYY-MM-DD
Rollback Trigger: [Brief description]
Rollback Method: [Environment variable / Code revert / etc.]
Time to Recovery: [X minutes/hours]
User Impact: [Affected users / operations]
Root Cause: [What went wrong]
Prevention: [How to avoid in future]
```

## Prevention Measures

### Pre-deployment Checks
- [ ] MAESTRO disabled in staging during testing
- [ ] Gradual rollout plan with feature flags
- [ ] Monitoring dashboards configured
- [ ] Rollback procedures documented and tested

### Production Readiness
- [ ] Multiple rollback methods available
- [ ] Automated health checks
- [ ] Alert thresholds defined
- [ ] Incident response team identified

### Testing Strategy
- [ ] Test MAESTRO enable/disable toggle
- [ ] Test rollback procedures
- [ ] Test database cleanup scripts
- [ ] Test client state clearing
