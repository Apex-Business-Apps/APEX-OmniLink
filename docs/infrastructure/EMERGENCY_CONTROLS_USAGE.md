# EMERGENCY CONTROLS - USAGE GUIDE
**Operator Supremacy Controls for OmniHub Edge Functions**

---

## OVERVIEW

Emergency controls provide three levels of operator supremacy:

1. **KILL_SWITCH** - Disable ALL OmniHub operations (emergency stop)
2. **OPERATOR_TAKEOVER** - Require manual approval for operations (only allow-listed operations can run)
3. **SAFE_MODE** - Operations run in advisory-only mode (no side effects, read-only)

---

## QUICK START

### Method 1: Middleware Wrapper (Recommended)

```typescript
// supabase/functions/my-function/index.ts
import { withEmergencyControls } from '../_shared/emergency-controls.ts'

Deno.serve(
  withEmergencyControls('my_operation', async (req, controls) => {
    // Emergency controls already checked
    // If we reach here, operation is allowed

    // Check if safe mode is active (advisory only)
    if (controls.safe_mode) {
      // Run in read-only mode, no side effects
      return new Response(JSON.stringify({ mode: 'advisory' }))
    }

    // Normal operation with side effects
    return new Response(JSON.stringify({ status: 'executed' }))
  })
)
```

### Method 2: Manual Enforcement

```typescript
// supabase/functions/my-function/index.ts
import { enforceEmergencyControls } from '../_shared/emergency-controls.ts'

Deno.serve(async (req) => {
  try {
    // Check emergency controls before proceeding
    const controls = await enforceEmergencyControls('my_operation')

    // If we reach here, operation is allowed
    // ... perform operation ...

    return new Response(JSON.stringify({ status: 'success' }))

  } catch (error) {
    if (error.name === 'EmergencyControlsError') {
      // Operation blocked by emergency controls
      return new Response(
        JSON.stringify({
          error: error.message,
          control: error.control  // 'kill_switch', 'operator_takeover', or 'safe_mode'
        }),
        {
          status: 503,  // Service Unavailable
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Other error
    throw error
  }
})
```

---

## OPERATION NAMING CONVENTION

Use clear, descriptive operation names:

```typescript
// ✅ GOOD
await enforceEmergencyControls('execute_workflow')
await enforceEmergencyControls('mint_nft')
await enforceEmergencyControls('verify_wallet')
await enforceEmergencyControls('process_webhook')

// ❌ BAD
await enforceEmergencyControls('operation')
await enforceEmergencyControls('func1')
await enforceEmergencyControls('do_stuff')
```

---

## ENABLING EMERGENCY CONTROLS

### Via Supabase Studio (Web UI)

1. Go to Supabase Dashboard > Table Editor
2. Select `emergency_controls` table
3. Edit the single row (ID: 00000000-0000-0000-0000-000000000001)
4. Set flags:
   - `kill_switch`: true/false
   - `safe_mode`: true/false
   - `operator_takeover`: true/false
   - `allowed_operations`: ['operation_name1', 'operation_name2']
   - `reason`: "Why you're enabling this control"
5. Save

### Via SQL

```sql
-- Enable kill switch (emergency stop)
UPDATE emergency_controls
SET kill_switch = true,
    reason = 'Critical security incident - disabling all operations',
    updated_by = auth.uid()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Enable safe mode (advisory only)
UPDATE emergency_controls
SET safe_mode = true,
    reason = 'Investigating production issue - read-only mode',
    updated_by = auth.uid()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Enable operator takeover (allow only specific operations)
UPDATE emergency_controls
SET operator_takeover = true,
    allowed_operations = ARRAY['verify_wallet', 'check_nft'],  -- Only these allowed
    reason = 'Manual review required for all executions',
    updated_by = auth.uid()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Disable all controls (return to normal)
UPDATE emergency_controls
SET kill_switch = false,
    safe_mode = false,
    operator_takeover = false,
    allowed_operations = '{}',
    reason = 'Incident resolved - resuming normal operations',
    updated_by = auth.uid()
WHERE id = '00000000-0000-0000-0000-000000000001';
```

### Via Edge Function (Admin API)

```typescript
// Create an admin-only edge function to toggle controls
// supabase/functions/admin-emergency-controls/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify admin user
  const authHeader = req.headers.get('Authorization')
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader?.replace('Bearer ', '')
  )

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  // Update emergency controls
  const body = await req.json()

  const { data, error } = await supabase
    .from('emergency_controls')
    .update({
      kill_switch: body.kill_switch,
      safe_mode: body.safe_mode,
      operator_takeover: body.operator_takeover,
      allowed_operations: body.allowed_operations || [],
      reason: body.reason,
      updated_by: user.id
    })
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true, controls: data }))
})
```

---

## HEALTH CHECK ENDPOINT

Add to your main health check endpoint:

```typescript
// supabase/functions/health/index.ts
import { getEmergencyControlsStatus } from '../_shared/emergency-controls.ts'

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (url.pathname === '/health/omn') {
    // Emergency controls health check
    const status = await getEmergencyControlsStatus()

    return new Response(JSON.stringify(status), {
      status: status.omnihub_enabled ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // ... other health checks ...
})
```

**Response format:**

```json
{
  "omnihub_enabled": true,
  "status": "ok",  // or "kill_switch", "operator_takeover", "safe_mode"
  "last_updated": "2026-01-03T10:30:00Z"
}
```

---

## ERROR HANDLING

When emergency controls block an operation:

**Error Response:**
```json
{
  "error": "OMNIHUB_KILL_SWITCH is enabled - all operations are disabled. Reason: Critical security incident",
  "control": "kill_switch",
  "controls": {
    "kill_switch": true,
    "safe_mode": false,
    "operator_takeover": false,
    "reason": "Critical security incident",
    "updated_at": "2026-01-03T10:30:00Z"
  }
}
```

**HTTP Status Code:** 503 Service Unavailable
**Retry-After Header:** 60 seconds

---

## MONITORING & ALERTS

### Alert on Emergency Controls Activation

```sql
-- Create a database trigger to send alerts (Supabase Realtime or webhook)
CREATE OR REPLACE FUNCTION notify_emergency_controls_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Send notification when kill switch is enabled
  IF NEW.kill_switch = true AND OLD.kill_switch = false THEN
    -- Send to monitoring system (e.g., PagerDuty, Slack)
    PERFORM net.http_post(
      url := 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
      body := jsonb_build_object(
        'text', '🚨 KILL SWITCH ENABLED: ' || NEW.reason
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emergency_controls_notification
  AFTER UPDATE ON public.emergency_controls
  FOR EACH ROW
  EXECUTE FUNCTION notify_emergency_controls_change();
```

### Datadog Metric

```typescript
// In edge function
import { sendMetric } from '../_shared/datadog.ts'

const controls = await getEmergencyControls()

await sendMetric('omnihub.emergency_controls.kill_switch', controls.kill_switch ? 1 : 0)
await sendMetric('omnihub.emergency_controls.safe_mode', controls.safe_mode ? 1 : 0)
await sendMetric('omnihub.emergency_controls.operator_takeover', controls.operator_takeover ? 1 : 0)
```

---

## TESTING

### Unit Test

```typescript
// test/emergency-controls.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/testing/asserts.ts'
import { enforceEmergencyControls, EmergencyControlsError, clearEmergencyControlsCache } from '../supabase/functions/_shared/emergency-controls.ts'

Deno.test('enforceEmergencyControls - kill switch blocks operation', async () => {
  // Setup: Enable kill switch in test database
  await testSupabase
    .from('emergency_controls')
    .update({ kill_switch: true })
    .eq('id', '00000000-0000-0000-0000-000000000001')

  clearEmergencyControlsCache()

  // Test: Should throw EmergencyControlsError
  await assertRejects(
    async () => await enforceEmergencyControls('test_operation'),
    EmergencyControlsError,
    'OMNIHUB_KILL_SWITCH is enabled'
  )
})

Deno.test('enforceEmergencyControls - allowed operation passes', async () => {
  // Setup: Enable operator takeover, allow specific operation
  await testSupabase
    .from('emergency_controls')
    .update({
      operator_takeover: true,
      allowed_operations: ['test_operation']
    })
    .eq('id', '00000000-0000-0000-0000-000000000001')

  clearEmergencyControlsCache()

  // Test: Should not throw
  const controls = await enforceEmergencyControls('test_operation')
  assertEquals(controls.operator_takeover, true)
})
```

### Integration Test (Staging)

```bash
# 1. Enable kill switch in staging
curl -X POST https://staging-api.omnihub.dev/admin/emergency-controls \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kill_switch": true,
    "reason": "Integration test"
  }'

# 2. Verify operations are blocked
curl https://staging-api.omnihub.dev/execute-workflow
# Expected: 503 Service Unavailable with error message

# 3. Disable kill switch
curl -X POST https://staging-api.omnihub.dev/admin/emergency-controls \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kill_switch": false,
    "reason": "Test complete"
  }'

# 4. Verify operations work again
curl https://staging-api.omnihub.dev/execute-workflow
# Expected: 200 OK
```

---

## AUDIT TRAIL

All emergency control changes are automatically logged to `audit_logs` table:

```sql
-- View emergency controls audit trail
SELECT
  created_at,
  metadata->>'new_state' as new_state,
  metadata->>'old_state' as old_state,
  metadata->>'reason' as reason,
  actor_id
FROM audit_logs
WHERE resource_type = 'emergency_controls'
ORDER BY created_at DESC
LIMIT 10;
```

---

## BEST PRACTICES

1. **Always provide a reason** when enabling controls
2. **Test in staging first** before enabling in production
3. **Alert on-call team** when enabling controls in production
4. **Document incident** in incident management system
5. **Disable controls** as soon as incident is resolved
6. **Review audit logs** quarterly

---

## TROUBLESHOOTING

### Emergency controls not working

```bash
# 1. Check if table exists
psql $DATABASE_URL -c "SELECT * FROM emergency_controls;"

# 2. Check RLS policies
psql $DATABASE_URL -c "\d+ emergency_controls"

# 3. Clear cache (in edge function)
# Call clearEmergencyControlsCache() in your edge function

# 4. Check Supabase logs
supabase functions logs --project-ref wwajmaohwcbooljdureo
```

### Operations still executing despite kill switch

```bash
# 1. Verify kill switch is enabled
psql $DATABASE_URL -c "SELECT kill_switch FROM emergency_controls;"

# 2. Check edge function is using middleware
# Ensure enforceEmergencyControls() is called at function start

# 3. Check cache TTL (60 seconds)
# Wait 60 seconds for cache to expire, or restart edge functions
```

---

**Document Status:** ✅ COMPLETE
**Last Updated:** 2026-01-03
**Owner:** DevOps Team
