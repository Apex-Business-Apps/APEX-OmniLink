# DEPLOYMENT ROLLOUT PLAN
**Staged Implementation of OmniHub Cloud Infrastructure**

**Status:** Ready for Operator Approval
**Timeline:** 8 weeks (6 weeks dev + 2 weeks production rollout)
**Risk Level:** LOW (builds on existing architecture, no migration)

---

## ROLLOUT STRATEGY

**Principle:** Incremental, reversible changes with approval gates before prod impact.

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: FOUNDATION (Weeks 1-2)                            │
│ - Security hardening                                        │
│ - Emergency controls                                        │
│ - Abstraction layers                                        │
│ Environment: DEV                                            │
│ Approval Required: NO                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: OBSERVABILITY (Weeks 3-4)                         │
│ - Datadog/Sentry integration                                │
│ - Dashboards, alerts                                        │
│ - OpenTelemetry                                             │
│ Environment: DEV + STAGING                                  │
│ Approval Required: NO                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: INFRASTRUCTURE AS CODE (Weeks 5-6)                │
│ - Terraform modules                                         │
│ - CI/CD automation                                          │
│ - Staging deployment                                        │
│ Environment: STAGING (production-parity)                    │
│ Approval Required: NO                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 🚨 APPROVAL GATE 🚨                                         │
│ - Review staging smoke test results                         │
│ - Review Terraform plan for production                      │
│ - Confirm deployment strategy                               │
│ - Sign-off from Tech Lead or CTO                            │
└────────────────────┬────────────────────────────────────────┘
                     │ ✅ Approved
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: PRODUCTION ROLLOUT (Weeks 7-8)                    │
│ - Deploy infrastructure (Cloudflare, Upstash, Vault)       │
│ - Canary deployment (5% → 25% → 50% → 100%)                │
│ - Monitor error budget for 24 hours                         │
│ Environment: PRODUCTION                                     │
│ Approval Required: YES (explicit for each step)             │
└─────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: FOUNDATION (Weeks 1-2)

### Objectives
1. Remove security vulnerabilities
2. Implement operator controls (kill switch, safe mode)
3. Add abstraction layers for portability

### Tasks

**Week 1: Security Hardening**

| Task | Owner | Deliverable | Verification |
|------|-------|-------------|--------------|
| **Delete .env file** | DevOps | `.env` removed from repo, added to `.gitignore` | `git log --all -- .env` shows no secrets |
| **Rotate all secrets** | DevOps | All API keys rotated | New keys in Vercel/Supabase dashboards |
| **Integrate secrets manager** | Backend | Vault or Doppler integrated | `scripts/get-secret.sh` works |
| **Cloudflare WAF setup** | DevOps | DNS pointing to Cloudflare, WAF rules active | `dig omnihub.dev` shows Cloudflare IPs |

**Week 2: Emergency Controls + Abstractions**

| Task | Owner | Deliverable | Verification |
|------|-------|-------------|--------------|
| **Create emergency_controls table** | Backend | SQL migration applied | Table exists in dev database |
| **Add emergency controls middleware** | Backend | All edge functions check controls | Test: Enable kill switch, verify requests rejected |
| **Database abstraction layer** | Backend | `src/lib/database/interface.ts` + Supabase impl | Unit tests pass |
| **Storage abstraction layer** | Backend | `src/lib/storage/interface.ts` + S3-compatible impl | Unit tests pass |

**Deliverables:**
- ✅ `.env` file removed, secrets rotated
- ✅ Emergency controls table + middleware
- ✅ Abstraction layers for database + storage
- ✅ Cloudflare WAF protecting frontend

**Approval Required:** ❌ NO (internal refactoring, dev environment only)

**Rollback Plan:** Git revert (no prod impact)

---

## PHASE 2: OBSERVABILITY (Weeks 3-4)

### Objectives
1. Gain visibility into production (logs, metrics, traces)
2. Set up SLO dashboards and alerts
3. Enable proactive incident detection

### Tasks

**Week 3: Logging & Metrics**

| Task | Owner | Deliverable | Verification |
|------|-------|-------------|--------------|
| **Integrate Datadog** | DevOps | Datadog agent configured, logs flowing | View logs in Datadog UI |
| **Implement OpenTelemetry** | Backend | OTEL instrumentation in edge functions | Traces visible in Datadog APM |
| **Structured logging** | Backend | JSON logs with trace_id, user_id | `kubectl logs` shows JSON format |
| **Sentry error tracking** | Frontend | Sentry SDK integrated | Trigger test error, verify in Sentry UI |

**Week 4: Dashboards & Alerts**

| Task | Owner | Deliverable | Verification |
|------|-------|-------------|--------------|
| **SLO dashboard** | SRE | Grafana/Datadog dashboard with error budget | Dashboard accessible at /dashboards/slo |
| **Operator dashboard** | SRE | Emergency controls status, approval queue | Dashboard shows kill switch status |
| **Infrastructure dashboard** | SRE | CPU/memory/disk utilization | Dashboard shows resource usage |
| **Critical alerts** | SRE | PagerDuty/Opsgenie configured | Test alert triggers page |

**Deliverables:**
- ✅ Logs, metrics, traces flowing to Datadog
- ✅ 3 dashboards (SLO, operator, infrastructure)
- ✅ Critical alerts configured (high error rate, service down)

**Approval Required:** ❌ NO (observability layer, no functional changes)

**Rollback Plan:** Disable Datadog integration (no impact on application)

---

## PHASE 3: INFRASTRUCTURE AS CODE (Weeks 5-6)

### Objectives
1. Make infrastructure reproducible via Terraform
2. Automate deployment to staging
3. Test DR procedures (database restore)

### Tasks

**Week 5: Terraform Modules**

| Task | Owner | Deliverable | Verification |
|------|-------|-------------|--------------|
| **Terraform structure** | DevOps | `terraform/modules/` + `terraform/environments/` | `terraform init` succeeds |
| **Cloudflare module** | DevOps | `terraform/modules/cloudflare/main.tf` | `terraform plan` shows DNS + WAF |
| **Upstash Redis module** | DevOps | `terraform/modules/upstash/main.tf` | Redis instance created |
| **Vercel module** | DevOps | `terraform/modules/vercel/main.tf` | Vercel project configured |

**Week 6: CI/CD + Staging**

| Task | Owner | Deliverable | Verification |
|------|-------|-------------|--------------|
| **CD workflow (staging)** | DevOps | `.github/workflows/cd-staging.yml` | Merge to main triggers deploy |
| **Smoke tests** | QA | `tests/smoke/staging.test.ts` | Smoke tests run in CI |
| **Staging environment** | DevOps | Staging Supabase project + Vercel preview | staging.omnihub.dev accessible |
| **DR drill (database)** | SRE | Database restore from backup | Verify data integrity after restore |

**Deliverables:**
- ✅ Terraform modules for all infrastructure
- ✅ Automated deployment to staging
- ✅ Smoke tests passing in staging
- ✅ DR drill completed (database restore < 1 hour RTO)

**Approval Required:** ❌ NO (staging environment only)

**Rollback Plan:** Terraform destroy staging resources

---

## 🚨 APPROVAL GATE (End of Week 6)

### Pre-Production Checklist

**Before requesting approval, verify:**

- [ ] **All staging smoke tests pass** (last 5 runs)
- [ ] **Security scan clean** (Snyk, no critical vulnerabilities)
- [ ] **Terraform plan reviewed** (no unexpected changes)
- [ ] **Rollback plan tested** (manual rollback in staging successful)
- [ ] **DR drill passed** (database restore < 1 hour RTO)
- [ ] **Cost estimate confirmed** ($300-500/month production)
- [ ] **On-call schedule set** (primary + secondary)
- [ ] **Runbooks written** (high-error-rate, service-down, database-down)

### Approval Request

**What will change in production:**
1. ✅ Cloudflare WAF + DDoS protection added
2. ✅ Upstash Redis for distributed rate limiting
3. ✅ HashiCorp Vault for secrets management
4. ✅ Datadog observability enabled
5. ✅ Emergency controls active (kill switch, safe mode)

**What will NOT change:**
- Application runtime (still Vercel + Supabase)
- User-facing features (zero functional changes)
- Database schema (no migrations)

**Deployment Strategy:** Canary deployment (5% → 25% → 50% → 100% over 4 hours)

**Rollback Strategy:** One-command rollback (< 60 seconds RTO)

**Risk Assessment:**
- **Probability of failure:** LOW (all changes tested in staging)
- **Impact of failure:** MEDIUM (temporary degraded performance, no data loss)
- **Mitigation:** Automated rollback triggers, manual rollback script tested

**Cost Impact:**
- Current: ~$100/month (Vercel + Supabase)
- After: ~$400/month (add Cloudflare Pro, Upstash, Datadog)
- Net increase: +$300/month

**Deployment Window:**
- Proposed: Sunday, 2 AM UTC (low traffic period)
- Duration: 4 hours (canary rollout)
- On-call: [Name], [Phone]

### Approval Decision

**Approved by:** _______________________
**Date:** _______________________
**Signature:** _______________________

**Approval Status:**
- [ ] ✅ APPROVED - Proceed to Phase 4
- [ ] 🔄 CONDITIONAL APPROVAL - Address items: _______________________
- [ ] ❌ REJECTED - Reason: _______________________

---

## PHASE 4: PRODUCTION ROLLOUT (Weeks 7-8)

### Pre-Deployment (1 Day Before)

**Day Before Deployment:**

- [ ] Send deployment notification to stakeholders (Slack, email)
- [ ] Freeze code changes (no merges to main except emergency fixes)
- [ ] Verify all CI/CD pipelines green
- [ ] Take full database backup (manual)
- [ ] Verify on-call engineer available
- [ ] Prepare status page update (draft)

### Deployment Day (Sunday, 2 AM UTC)

**Timeline:**

```
T-60min: Pre-deployment checks
T-30min: Backup database, verify integrity
T-15min: Final go/no-go decision
T-0min:  BEGIN DEPLOYMENT
  +15min: Deploy infrastructure (Cloudflare, Upstash, Vault)
  +30min: Verify infrastructure health
  +45min: Deploy application changes (abstraction layers)
  +60min: Canary 5% (15 min observation)
  +90min: Canary 25% (15 min observation)
  +120min: Canary 50% (30 min observation)
  +180min: Canary 100% (finalize)
  +240min: Post-deployment monitoring complete
```

### Deployment Steps

**Step 1: Deploy Infrastructure (Cloudflare, Upstash, Vault)**

```bash
cd terraform/environments/production
terraform init
terraform plan -out=tfplan

# Review plan with team
terraform show tfplan

# Apply (requires approval confirmation)
terraform apply tfplan
```

**Verification:**
```bash
# Verify Cloudflare DNS
dig omnihub.dev  # Should show Cloudflare IPs

# Verify Upstash Redis
redis-cli -u $UPSTASH_REDIS_URL ping  # Should return PONG

# Verify Vault
vault status  # Should show unsealed
```

**Step 2: Deploy Application Changes**

```bash
# Deploy edge functions with new abstractions
cd /home/user/OmniLink-APEX
npm run deploy:production

# This triggers:
# 1. Vercel deployment (frontend)
# 2. Supabase edge function deployment
# 3. Database migration (if any)
```

**Verification:**
```bash
# Health checks
curl https://omnihub.dev/health
curl https://omnihub.dev/health/deep
curl https://omnihub.dev/health/omn

# Verify emergency controls
psql $DATABASE_URL -c "SELECT * FROM emergency_controls"
```

**Step 3: Canary Deployment (5% Traffic)**

```bash
# Route 5% traffic to new version
./scripts/canary-deploy.sh --percent=5

# Monitor for 15 minutes
./scripts/monitor-canary.sh --duration=15m
```

**Automated Canary Analysis:**
- Error rate: Must be < 2x baseline
- P95 latency: Must be < 1.5x baseline
- Health checks: Must pass

**If canary fails:** Automated rollback triggered

**Step 4: Progressive Rollout**

```bash
# 25% traffic
./scripts/canary-deploy.sh --percent=25
./scripts/monitor-canary.sh --duration=15m

# 50% traffic
./scripts/canary-deploy.sh --percent=50
./scripts/monitor-canary.sh --duration=30m

# 100% traffic (finalize)
./scripts/canary-deploy.sh --percent=100
```

**Step 5: Post-Deployment Validation**

```bash
# Run smoke tests against production
npm run test:smoke -- --env=production

# Verify SLO metrics
./scripts/check-slo.sh

# Verify no errors in last hour
./scripts/check-error-budget.sh
```

**Step 6: Finalize**

- [ ] Update status page (deployment complete)
- [ ] Send completion notification (Slack, email)
- [ ] Monitor error budget for 24 hours
- [ ] Document any issues encountered
- [ ] Schedule postmortem meeting (next business day)

### Post-Deployment (24 Hours After)

**Monitoring Checklist:**

- [ ] Error budget within SLO (> 75% remaining)
- [ ] No critical alerts fired
- [ ] P95 latency within SLO (< 500ms)
- [ ] No increase in support tickets
- [ ] Database performance stable

**If all checks pass:**
- [ ] Declare deployment successful
- [ ] Remove code freeze
- [ ] Resume normal deploy cadence

**If issues detected:**
- [ ] Escalate to incident response
- [ ] Consider rollback
- [ ] Root cause analysis

---

## ROLLBACK PROCEDURES

### Automated Rollback Triggers

**Canary analysis failures:**
- Error rate > 2x baseline → Immediate rollback
- P95 latency > 1.5x baseline → Immediate rollback
- Health check failures → Immediate rollback

**Automated Rollback Script:**
```bash
#!/bin/bash
# scripts/emergency-rollback.sh

set -e

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# 1. Route all traffic to baseline
./scripts/canary-deploy.sh --percent=0

# 2. Rollback Vercel deployment
vercel rollback --token $VERCEL_TOKEN

# 3. Rollback Supabase edge functions
supabase functions deploy --project-ref $PROD_PROJECT_ID --version previous

# 4. Rollback Terraform (if infrastructure changes)
cd terraform/environments/production
terraform apply -auto-approve -var="use_legacy_config=true"

echo "✅ Rollback complete (RTO: < 60 seconds)"
```

### Manual Rollback

**Trigger:** Operator decides deployment is failing

**Steps:**
1. Announce rollback in Slack #incidents
2. Run `./scripts/emergency-rollback.sh`
3. Verify services healthy after rollback
4. Incident postmortem within 24 hours

---

## COMMUNICATION PLAN

### Stakeholder Notifications

**Pre-Deployment (24 hours before):**
- [ ] Send deployment announcement to #engineering (Slack)
- [ ] Email to all-hands (optional for major changes)
- [ ] Update status page (scheduled maintenance)

**During Deployment:**
- [ ] T-0min: "Deployment started" (Slack #deployments)
- [ ] T+60min: "Canary 5% healthy" (Slack #deployments)
- [ ] T+120min: "Canary 50% healthy" (Slack #deployments)
- [ ] T+180min: "Deployment complete" (Slack #deployments)

**Post-Deployment:**
- [ ] T+24h: "Deployment successful, monitoring complete" (Slack #engineering)
- [ ] Update changelog (omnihub.dev/changelog)

**If Rollback:**
- [ ] Immediate: "Rollback initiated" (Slack #incidents + PagerDuty)
- [ ] Within 1 hour: Root cause analysis started
- [ ] Within 24 hours: Incident report published

---

## SUCCESS CRITERIA

**Deployment considered successful if:**

1. ✅ All canary stages passed without rollback
2. ✅ Error budget > 75% remaining (after 24 hours)
3. ✅ P95 latency < 500ms (within SLO)
4. ✅ No critical incidents during deployment
5. ✅ Zero customer-reported issues related to deployment
6. ✅ All smoke tests passing
7. ✅ Emergency controls functional (tested in staging)

**Metrics to Track:**

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Deployment Duration** | < 4 hours | _____ | _____ |
| **Error Rate (24h avg)** | < 0.1% | _____ | _____ |
| **P95 Latency (24h avg)** | < 500ms | _____ | _____ |
| **Downtime** | 0 minutes | _____ | _____ |
| **Rollbacks** | 0 | _____ | _____ |

---

## SUMMARY

**Total Timeline:** 8 weeks
- Weeks 1-6: Development + Staging (no approval required)
- Week 6: Approval gate
- Weeks 7-8: Production rollout (approval required for each step)

**Approval Gates:**
1. **End of Week 6:** Approve production deployment plan
2. **Day of deployment:** Final go/no-go (1 hour before)
3. **Each canary stage:** Operator can pause or rollback

**Rollback Safety:**
- Automated rollback triggers (error rate, latency)
- Manual rollback script (< 60s RTO)
- Database backups taken before deployment

**Risk Mitigation:**
- Incremental rollout (5% → 100%)
- Production-parity staging
- Automated testing at every stage
- Operator override controls

---

**Document Status:** ✅ COMPLETE - Ready for Operator Review
**Next Step:** Operator approval to proceed with Phase 1
