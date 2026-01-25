# Migration Runbook: Lovable Cloud → Supabase + Vercel

**Purpose**: Step-by-step guide for migrating this app from Lovable Cloud backend to independent Supabase + Vercel deployment.

**Last Updated**: 2025-12-18

---

## Pre-Migration Checklist

- [ ] Verify Supabase project is created and accessible
- [ ] Obtain Supabase credentials:
  - Project URL (`VITE_SUPABASE_URL`)
  - Anon key (`VITE_SUPABASE_ANON_KEY`)
  - Service role key (`SUPABASE_SERVICE_ROLE_KEY`) - for Edge Functions only
- [ ] Backup any existing data (if migrating from existing Lovable backend)
- [ ] Ensure Vercel account is connected to GitHub repository

---

## Migration Steps

### Step 1: Run Supabase Migrations

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

**Verify**: Check Supabase dashboard → Database → Tables:
- ✅ `audit_logs` table exists
- ✅ `device_registry` table exists
- ✅ RLS policies are enabled

### Step 2: Set Environment Variables

#### Local Development (.env.local)
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### Vercel Production
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `VITE_SUPABASE_URL` (Production, Preview, Development)
   - `VITE_SUPABASE_ANON_KEY` (Production, Preview, Development)
   - `SUPABASE_SERVICE_ROLE_KEY` (Production only - for Edge Functions)

#### Supabase Edge Functions
Edge Functions need these environment variables (set in Supabase Dashboard → Project Settings → Edge Functions):
- `SUPABASE_URL` (auto-set by Supabase)
- `SUPABASE_ANON_KEY` (auto-set by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (manual - for service role operations)

### Step 3: Deploy to Vercel

```bash
# Push code to GitHub
git push origin main

# Vercel will automatically deploy
# Or manually trigger: Vercel Dashboard → Deployments → Redeploy
```

**Verify**: 
- Check deployment logs for build success
- Visit `/health` endpoint to verify connectivity
- Run smoke tests: `npm run smoke-test`

### Step 4: Verify Migration

1. **Health Check**: Visit `https://your-app.vercel.app/health`
   - Should show "healthy" status
   - Supabase connection: OK
   - Database: OK

2. **Smoke Tests**: Run `npm run smoke-test`
   - All tests should pass

3. **Functional Tests**:
   - Sign up/login flow works
   - Audit events are logged (check `audit_logs` table)
   - Device registry works (check `device_registry` table)

---

## Rollback Plan

If migration fails, rollback steps:

### Option A: Revert Code
```bash
git revert <migration-commit-hash>
git push origin main
```

### Option B: Restore Lovable Integration
1. Restore `src/integrations/lovable/client.ts` from backup
2. Restore Edge Functions that call Lovable API
3. Set `LOVABLE_API_BASE` and `LOVABLE_API_KEY` in Vercel env vars
4. Redeploy

### Option C: Database Rollback
```bash
# If migrations caused issues, rollback specific migration
supabase migration repair --status reverted <migration-timestamp>
```

---

## Post-Migration Tasks

- [ ] Remove Lovable API credentials from all environments
- [ ] Update documentation to reflect Supabase-only architecture
- [ ] Monitor error logs for any remaining Lovable references
- [ ] Set up Supabase database backups (if not already configured)
- [ ] Configure Supabase monitoring/alerts

---

## Troubleshooting

### Issue: "audit_logs table does not exist"
**Solution**: Run migrations: `supabase db push`

### Issue: "RLS policy violation"
**Solution**: Check RLS policies in Supabase dashboard, ensure user is authenticated

### Issue: "Edge Function timeout"
**Solution**: Check Edge Function logs in Supabase dashboard, verify service role key is set

### Issue: "Health check fails"
**Solution**: 
1. Verify environment variables are set in Vercel
2. Check Supabase project is active
3. Verify network connectivity

---

## Data Migration (Optional)

If you have existing data in Lovable backend:

1. **Export from Lovable** (if API available):
   ```bash
   # Use Lovable API to export audit logs and device registry
   # Format: JSON or CSV
   ```

2. **Import to Supabase**:
   ```bash
   # Use Supabase SQL editor or import tool
   # Or write a migration script using Supabase client
   ```

3. **Verify Data**:
   ```sql
   SELECT COUNT(*) FROM audit_logs;
   SELECT COUNT(*) FROM device_registry;
   ```

---

## Maintenance

### Regular Tasks
- Monitor Supabase usage/quota
- Review audit logs for anomalies
- Clean up old audit logs (90+ days) - automated via function
- Update Supabase client library as needed

### Monitoring
- Set up Supabase dashboard alerts
- Monitor Vercel deployment health
- Track error rates via Sentry (if configured)
