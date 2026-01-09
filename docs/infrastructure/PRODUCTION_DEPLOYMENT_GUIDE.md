# PRODUCTION DEPLOYMENT GUIDE
**Step-by-Step Deployment Manual**

**Purpose:** Detailed instructions for deploying OmniHub to production
**Audience:** DevOps team executing production deployment
**Prerequisites:** Approval from Tech Lead/CTO

---

## PRE-FLIGHT CHECKS

### ✅ Before Starting Deployment

Run these commands to verify readiness:

```bash
# 1. Verify staging tests passing
cd /path/to/OmniLink-APEX
npm run test:unit        # Should pass (55+ tests)
npm run test:integration # Should pass (80+ tests)
npm run test:e2e        # Should pass (10+ tests)

# 2. Verify no security vulnerabilities
npm audit --audit-level=high
# Should show 0 high/critical vulnerabilities

# 3. Verify staging deployment healthy
curl -s https://staging.omnihub.dev/health | jq
# Should return {"status": "healthy"}

# 4. Verify Terraform ready
cd terraform/environments/production
terraform init
terraform validate
# Should show "Success! The configuration is valid."
```

**Stop here if any checks fail!**

---

## DEMO DEPLOY (NON-PRODUCTION ONLY)

Use demo mode to run a safe, keyless demo. **Never enable demo mode in production.**

### Demo Mode Environment Flags

Frontend (`.env.local`):

```env
VITE_DEMO_MODE=true
VITE_ENABLE_WEB3=true
```

Supabase Edge Functions (Supabase Dashboard → Project Settings → Edge Functions):

```env
DEMO_MODE=true
SIWE_ALLOWED_ORIGINS=https://demo.omnihub.dev,http://localhost:5173
```

### Demo Mode Behavior

- Webhook and blockchain secrets are optional; functions return safe responses when keys are absent.
- `alchemy-webhook` ignores payloads and does **no** database writes in demo mode.

**⚠️ Demo mode must be disabled for production deploys.**

---

## WEEK 7: INFRASTRUCTURE SETUP

### Day 1: Create Production Terraform Config

```bash
# 1. Create production environment
cd terraform/environments
cp -r staging production
cd production

# 2. Edit main.tf for production settings
vim main.tf
```

**Changes needed in `main.tf`:**
```hcl
# Update workspace
terraform {
  cloud {
    organization = "omnihub"
    workspaces {
      name = "omnihub-production"  # Changed from staging
    }
  }
}

# Update Cloudflare module
module "cloudflare" {
  source = "../../modules/cloudflare"
  
  domain         = "omnihub.dev"  # Changed from staging.omnihub.dev
  security_level = "high"         # Changed from "low"
  rate_limit_threshold = 100      # Changed from 200
}

# Update Upstash module
module "redis" {
  source = "../../modules/upstash"
  
  database_name = "omnihub-production"  # Changed from staging
  multi_zone    = true                  # Changed from false (production HA)
}

# Update Vercel module
module "vercel" {
  source = "../../modules/vercel"
  
  project_name  = "omnihub-production"
  environment   = "production"  # Changed from "preview"
  custom_domain = "omnihub.dev"
}
```

**3. Create terraform.tfvars:**
```bash
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars
```

**Fill in production values:**
```hcl
# Provider credentials (from Doppler production config)
cloudflare_api_token = "prod-cloudflare-token"
cloudflare_zone_id   = "prod-zone-id"
upstash_email        = "prod@omnihub.dev"
upstash_api_key      = "prod-upstash-key"
vercel_token         = "prod-vercel-token"

# Application
github_repo = "apexbusiness-systems/OmniLink-APEX"

# Environment variables (from Doppler)
vite_supabase_url                = "https://PROD.supabase.co"
vite_supabase_publishable_key    = "prod-anon-key"
vite_sentry_dsn                  = "https://...@sentry.io/PROD"
vite_datadog_application_id      = "prod-datadog-app"
vite_datadog_client_token        = "prod-datadog-token"
```

**IMPORTANT:** Never commit terraform.tfvars!

### Day 2: Review Terraform Plan

```bash
# 1. Generate plan
terraform plan -out=production.tfplan | tee production-plan.txt

# 2. Review carefully!
cat production-plan.txt

# 3. Check what will be created
grep "will be created" production-plan.txt

# 4. Verify no unexpected changes
# Look for:
# - DNS records pointing to correct Vercel
# - WAF rules configured
# - Rate limiting configured
# - Upstash Redis in correct region
```

**Share plan with Tech Lead for approval.**

### Day 3: Lower DNS TTL

**At your domain registrar (e.g., Namecheap, GoDaddy):**

1. Login to domain registrar
2. Go to DNS settings for `omnihub.dev`
3. Lower TTL for all records to `300` seconds (5 minutes)
4. Save changes

**Wait 24 hours for TTL to propagate.**

### Day 4: Apply Production Infrastructure

**After 24 hours and approval received:**

```bash
# 1. Apply Terraform plan
terraform apply production.tfplan

# 2. Verify resources created
terraform output

# Expected output:
# cloudflare_nameservers = ["ns1.cloudflare.com", "ns2.cloudflare.com"]
# vercel_deployment_url  = "https://omnihub-production.vercel.app"
# staging_url            = "https://omnihub.dev"
# redis_database_id      = "abc123"

# 3. Test DNS records (WITHOUT changing nameservers yet)
dig @ns1.cloudflare.com omnihub.dev
# Should return Vercel CNAME

# 4. Test SSL certificate
curl -I https://omnihub.dev
# Should show Cloudflare SSL (after nameserver change)
```

---

## WEEK 8: PRODUCTION DEPLOYMENT

### Day 1: Deploy Monitoring Stack

**Install Sentry SDK:**

```bash
# 1. Ensure SDK installed
npm install --save @sentry/react

# 2. Verify src/lib/sentry.ts exists
cat src/lib/sentry.ts

# 3. Verify Sentry initialized in src/main.tsx
grep "initSentry" src/main.tsx

# 4. Set production DSN in Doppler
doppler secrets set VITE_SENTRY_DSN="https://PROD@sentry.io/..." --config prod

# 5. Test Sentry (trigger test error)
# Add to any component temporarily:
throw new Error("Sentry test error");

# 6. Verify error appears in Sentry dashboard
open https://sentry.io/organizations/omnihub/issues/
```

**Install Datadog SDK:**

```bash
# 1. Ensure SDK installed
npm install --save @datadog/browser-rum @datadog/browser-logs

# 2. Verify src/lib/datadog.ts exists
cat src/lib/datadog.ts

# 3. Verify Datadog initialized in src/main.tsx
grep "initDatadog" src/main.tsx

# 4. Set production credentials in Doppler
doppler secrets set VITE_DATADOG_APPLICATION_ID="PROD-APP-ID" --config prod
doppler secrets set VITE_DATADOG_CLIENT_TOKEN="PROD-TOKEN" --config prod

# 5. Test Datadog (check RUM)
# Visit https://app.datadoghq.com/rum/explorer
# Should see test session
```

### Day 2: Deploy Dashboards

**Import SLO Dashboard:**

```bash
# 1. Create SLO in Datadog
# Go to: Monitors → Service Level Objectives → New SLO
# - Metric: Error rate < 1%
# - Time window: 30 days
# - Target: 99.9%

# 2. Import dashboard (if JSON exists)
# Or create manually in Datadog UI

# 3. Verify dashboard accessible
open https://app.datadoghq.com/dashboard/slo-omnihub
```

**Import Operator Dashboard:**
```bash
# Create manually or import JSON
open https://app.datadoghq.com/dashboard/operator-omnihub
```

**Import Infrastructure Dashboard:**
```bash
# Create manually or import JSON
open https://app.datadoghq.com/dashboard/infrastructure-omnihub
```

**Configure Alerts:**

```bash
# 1. High Error Rate Alert
# Go to: Monitors → New Monitor → Metric Monitor
# Query: avg(last_5m):sum:trace.http.request.errors/sum:trace.http.request.hits > 0.05
# Alert: @pagerduty @slack-#incidents
# Name: [OmniHub] High Error Rate

# 2. Service Down Alert
# Go to: Monitors → New Monitor → Integration Monitor
# Check: http.can_connect
# URL: https://omnihub.dev
# Alert: @pagerduty @slack-#incidents
# Name: [OmniHub] Service Down

# 3. Test alerts
# Trigger test alert to verify notifications work
```

### Day 3: DNS Migration

**CRITICAL: Execute during low-traffic window (2-4 AM UTC)**

**Pre-flight checks:**
```bash
# 1. Verify DNS records in Cloudflare
dig @ns1.cloudflare.com omnihub.dev
dig @ns1.cloudflare.com www.omnihub.dev

# 2. Verify TTL lowered (should be 300s)
dig omnihub.dev | grep "IN\s*A"
# Should show TTL of 300

# 3. Verify SSL certificate ready
curl -I https://omnihub.dev
```

**Execute nameserver change:**

1. **Login to domain registrar**
2. **Go to DNS/Nameserver settings**
3. **Change nameservers to:**
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
4. **Save changes**
5. **Screenshot confirmation** (for records)

**Monitor DNS propagation:**

```bash
# 1. Check DNS immediately
dig @8.8.8.8 omnihub.dev  # Google DNS
dig @1.1.1.1 omnihub.dev  # Cloudflare DNS

# 2. Monitor propagation globally
open https://dnschecker.org/#A/omnihub.dev

# 3. Test site accessibility
curl -I https://omnihub.dev
# Should return 200 OK with Cloudflare headers

# 4. Monitor for next 48 hours
# DNS propagation can take up to 48 hours globally
```

**If issues arise:**
- Check DNS records in Cloudflare dashboard
- Verify SSL certificate issued
- Check Cloudflare analytics for traffic

### Day 4: Canary Deployment

**Phase 1: 5% Traffic (Hours 0-4)**

```bash
# 1. Deploy to production with traffic split
vercel --prod --target production

# 2. Set traffic split to 5%
# In Vercel dashboard:
# Project → Settings → Deployment Protection → Traffic Split
# Set: 5% to new deployment, 95% to previous

# 3. Monitor error rate
# Datadog dashboard: https://app.datadoghq.com/dashboard/slo-omnihub
# Check: Error rate < 1%

# 4. Monitor latency
# Check: P95 latency < 500ms

# 5. Check user complaints
# Monitor: #support Slack channel

# 6. Decision point (after 4 hours):
# Error rate < 1%? → Proceed to 25%
# Error rate > 1%? → Rollback
vercel rollback --production  # If rollback needed
```

**Phase 2: 25% Traffic (Hours 4-8)**

```bash
# 1. Increase traffic to 25%
# Vercel dashboard → Traffic Split → 25%

# 2. Monitor closely (same metrics as Phase 1)

# 3. Decision point (after 4 hours):
# Error rate < 1%? → Proceed to 50%
# Error rate > 1%? → Rollback
```

**Phase 3: 50% Traffic (Hours 8-16)**

```bash
# 1. Increase traffic to 50%
# Vercel dashboard → Traffic Split → 50%

# 2. Monitor error budget
# Datadog SLO dashboard → Error budget should be > 50%

# 3. Decision point (after 8 hours):
# Error budget > 50%? → Proceed to 100%
# Error budget < 50%? → Investigate before proceeding
```

**Phase 4: 100% Traffic (Hours 16-24)**

```bash
# 1. Roll out to 100%
# Vercel dashboard → Traffic Split → 100%

# 2. Monitor for 24 hours straight

# 3. Final sign-off (after 24 hours):
# All metrics green? → Deployment complete ✅
# Any issues? → Investigate and resolve
```

### Day 5-6: Post-Deployment Monitoring

```bash
# 1. Monitor uptime (should be > 99.9%)
# Datadog → Uptime monitor

# 2. Monitor error rate (should be < 1%)
# Datadog → Error rate dashboard

# 3. Monitor costs
# Cloudflare: https://dash.cloudflare.com/billing
# Upstash: https://console.upstash.com/billing
# Vercel: https://vercel.com/account/billing
# Sentry: https://sentry.io/settings/billing/
# Datadog: https://app.datadoghq.com/billing

# Total should be ~$106/month

# 4. Verify backups running
supabase db dump > backup-$(date +%Y%m%d).sql

# 5. Create post-deployment report
# Document:
# - Deployment timeline
# - Issues encountered
# - Metrics achieved
# - Lessons learned
```

---

## ROLLBACK PROCEDURES

### Emergency Rollback (If Deployment Fails)

**Scenario 1: High Error Rate**

```bash
# 1. Immediate rollback
vercel rollback --production

# 2. Verify error rate drops
# Check Datadog dashboard

# 3. Notify team
# Post in #incidents Slack:
# "Production deployment rolled back due to high error rate. Investigating."

# 4. Investigate logs
# Datadog → Logs Explorer → filter by @error:true

# 5. Fix issue in staging, re-test, retry deployment
```

**Scenario 2: DNS Issues**

```bash
# 1. Check DNS records in Cloudflare
# Verify they match original Vercel DNS

# 2. If incorrect, fix immediately
# Cloudflare dashboard → DNS → Edit record
# Propagates in ~5 min (low TTL)

# 3. If persistent, revert nameservers
# Domain registrar → Change back to Vercel nameservers

# 4. Investigate root cause before retrying
```

**Scenario 3: Database Issues**

```bash
# 1. Enable kill switch
psql $DATABASE_URL <<EOF
UPDATE emergency_controls
SET kill_switch = true,
    reason = 'Production deployment issue - database'
WHERE id = '00000000-0000-0000-0000-000000000001';
EOF

# 2. Restore from backup
supabase db restore --backup <latest-backup-id>

# 3. Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# 4. Disable kill switch
psql $DATABASE_URL <<EOF
UPDATE emergency_controls
SET kill_switch = false
WHERE id = '00000000-0000-0000-0000-000000000001';
EOF
```

---

## VERIFICATION CHECKLIST

### Post-Deployment Verification

Run these checks after deployment completes:

```bash
# ✅ Site accessible
curl -I https://omnihub.dev | grep "200 OK"

# ✅ SSL certificate valid
echo | openssl s_client -connect omnihub.dev:443 2>/dev/null | grep "Verify return code: 0"

# ✅ DNS resolves correctly
dig omnihub.dev | grep "ANSWER: 1"

# ✅ WAF enabled
curl -I https://omnihub.dev | grep "cloudflare"

# ✅ Health endpoint working
curl https://omnihub.dev/health | jq '.status' | grep "healthy"

# ✅ Error rate < 1%
# Check Datadog SLO dashboard

# ✅ P95 latency < 500ms
# Check Datadog APM

# ✅ Monitoring working
# Check Sentry dashboard for events
# Check Datadog dashboard for sessions

# ✅ Backups running
# Check Supabase dashboard → Database → Backups

# ✅ Cost within budget
# Sum all service costs = ~$106/month
```

---

## CONTACT INFORMATION

### On-Call Rotation

**Primary:** DevOps Team
- Slack: @devops-oncall
- PagerDuty: omnihub-primary

**Secondary (Escalation):** Backend Team
- Slack: @backend-oncall
- PagerDuty: omnihub-secondary

**Final Escalation:** Tech Lead / CTO
- Slack: @tech-lead

### Service Support

- **Cloudflare:** https://support.cloudflare.com/
- **Vercel:** https://vercel.com/support
- **Upstash:** https://upstash.com/docs
- **Supabase:** https://supabase.com/support
- **Datadog:** https://www.datadoghq.com/support/
- **Sentry:** https://sentry.io/support/

---

**Document Status:** ✅ READY FOR EXECUTION
**Last Updated:** 2026-01-03
**Owner:** DevOps Team
**Next Steps:** Execute production deployment (after approval)
