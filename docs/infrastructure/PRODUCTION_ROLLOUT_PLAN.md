# PRODUCTION ROLLOUT PLAN
**Phase 4 - Week 7-8**

**Status:** 🚨 REQUIRES APPROVAL
**Timeline:** 2 weeks (after approval)
**Risk Level:** MEDIUM (canary deployment with rollback capability)

---

## OVERVIEW

This document outlines the production deployment strategy for OmniHub cloud infrastructure.

**Deployment Strategy:** Canary deployment with progressive rollout
**Rollback Capability:** ✅ Terraform state + Vercel instant rollback
**Monitoring:** ✅ Datadog + Sentry (real-time error tracking)
**Approval Required:** ✅ Tech Lead or CTO sign-off

---

## PRE-PRODUCTION CHECKLIST

Before requesting approval, verify all criteria are met:

### Technical Readiness

- [ ] **Staging smoke tests passing** (last 10 runs, 100% success rate)
- [ ] **Security scan clean** (Snyk + npm audit, no critical vulnerabilities)
- [ ] **Terraform plan reviewed** (no unexpected changes in production)
- [ ] **Integration tests passing** (database + storage abstraction, 100%)
- [ ] **Unit tests passing** (55+ tests, 100% pass rate)
- [ ] **E2E tests passing** (critical user flows verified)

### Infrastructure Readiness

- [ ] **DNS records created** in Cloudflare (pre-configured before nameserver switch)
- [ ] **SSL certificates ready** (Cloudflare automatic SSL)
- [ ] **WAF rules tested** in staging (no false positives)
- [ ] **Rate limiting tested** (Upstash Redis verified)
- [ ] **Backup procedures tested** (database restore < 1 hour RTO)

### Operational Readiness

- [ ] **On-call schedule set** (primary + secondary, 24/7 coverage)
- [ ] **Runbooks written** (high-error-rate, service-down, database-down)
- [ ] **Rollback plan tested** in staging (Terraform destroy + redeploy)
- [ ] **Monitoring dashboards deployed** (SLO, Operator, Infrastructure)
- [ ] **Alerts configured** (PagerDuty + Slack integrations tested)

### Business Readiness

- [ ] **Cost budget approved** ($106/month confirmed)
- [ ] **Deployment window scheduled** (low-traffic period)
- [ ] **Stakeholders notified** (users informed of potential downtime)
- [ ] **Support team briefed** (ready for incident escalation)

---

## APPROVAL GATE

### What Will Change in Production

**Infrastructure Changes:**
1. ✅ Cloudflare WAF + DDoS protection added ($20/month)
2. ✅ DNS migrated from Vercel → Cloudflare (nameserver change)
3. ✅ Upstash Redis for rate limiting ($10/month)
4. ✅ Enhanced monitoring (Datadog + Sentry, $56/month)
5. ✅ Automated backups (Supabase automated backups enabled)

**Application Changes:**
1. ✅ Emergency controls enabled (kill switch, safe mode, operator takeover)
2. ✅ Database/storage abstraction layers (portability improved)
3. ✅ Error tracking (Sentry SDK integrated)
4. ✅ Performance monitoring (Datadog RUM integrated)
5. ✅ Distributed tracing (OpenTelemetry enabled)

**Operational Changes:**
1. ✅ 24/7 on-call rotation (primary + secondary)
2. ✅ Incident response runbooks
3. ✅ Automated deployment (CI/CD on merge to main)
4. ✅ Infrastructure as Code (Terraform for all resources)

### Risk Assessment

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| DNS migration downtime | HIGH | LOW | Pre-configure DNS, lower TTL 24h before |
| WAF false positives | MEDIUM | MEDIUM | Staging testing, can disable rules instantly |
| Increased latency | MEDIUM | LOW | Cloudflare CDN should improve, not worsen |
| Cost overrun | LOW | LOW | $106/month confirmed, monitoring alerts at $120 |
| Data loss | HIGH | VERY LOW | Automated backups, tested restore |

### Rollback Plan

**If deployment fails:**

1. **Immediate rollback** (< 5 minutes):
   ```bash
   # Rollback Vercel deployment
   vercel rollback

   # Or rollback Terraform
   cd terraform/environments/production
   terraform destroy -target=module.vercel
   terraform apply # Re-apply previous state
   ```

2. **DNS rollback** (5-10 minutes):
   - Revert nameservers to Vercel
   - Wait for DNS propagation (TTL dependent)

3. **Database rollback** (if needed):
   - Restore from latest backup
   - RTO: < 1 hour
   - RPO: < 5 minutes (Supabase PITR)

---

## WEEK 7: PRODUCTION INFRASTRUCTURE

### Day 1-2: Infrastructure Preparation

**Tasks:**
1. ✅ Create production Terraform config
   ```bash
   cp -r terraform/environments/staging terraform/environments/production
   # Edit production-specific values
   ```

2. ✅ Review Terraform plan
   ```bash
   cd terraform/environments/production
   terraform plan > production-plan.txt
   # Review carefully!
   ```

3. ✅ Get approval for infrastructure changes
   - Share `production-plan.txt` with Tech Lead
   - Confirm cost estimate ($106/month)
   - Confirm deployment window

### Day 3: DNS Pre-Configuration

**Tasks:**
1. ✅ Create DNS records in Cloudflare (DO NOT change nameservers yet)
2. ✅ Verify DNS records are correct
3. ✅ Lower TTL on current DNS to 300 seconds (5 minutes)
4. ✅ Wait 24 hours for TTL to propagate

### Day 4-5: Apply Infrastructure

**Tasks:**
1. ✅ Apply production Terraform
   ```bash
   terraform apply
   ```

2. ✅ Verify resources created:
   - Cloudflare: DNS records, WAF rules, rate limiting
   - Upstash: Redis database created
   - Vercel: Project configured

3. ✅ Test infrastructure (without live traffic):
   - Verify SSL certificate issued
   - Test WAF rules (should not block legitimate traffic)
   - Test rate limiting (Redis connection working)

---

## WEEK 8: PRODUCTION DEPLOYMENT

### Day 1-2: Monitoring Stack

**Tasks:**
1. ✅ Deploy Datadog/Sentry SDKs to production
   - Install `@sentry/react` and `@datadog/browser-rum`
   - Configure with production keys
   - Test error reporting

2. ✅ Deploy dashboards
   ```bash
   # Import SLO dashboard
   datadog-cli dashboard import docs/dashboards/slo-dashboard.json

   # Import Operator dashboard
   datadog-cli dashboard import docs/dashboards/operator-dashboard.json

   # Import Infrastructure dashboard
   datadog-cli dashboard import docs/dashboards/infrastructure-dashboard.json
   ```

3. ✅ Configure alerts
   - High error rate → PagerDuty + Slack
   - Service down → PagerDuty + Slack
   - Database latency → Slack

4. ✅ Test alerts (trigger test alert, verify notification)

### Day 3: DNS Migration

**Tasks:**
1. ✅ Pre-flight check:
   - All DNS records in Cloudflare match current
   - SSL certificate ready
   - TTL lowered to 300s (24 hours ago)

2. ✅ Update nameservers (LOW TRAFFIC WINDOW: 2-4 AM UTC):
   ```bash
   # At domain registrar (e.g., Namecheap, GoDaddy)
   # Change nameservers to Cloudflare
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```

3. ✅ Monitor DNS propagation:
   ```bash
   # Check DNS propagation
   dig @8.8.8.8 omnihub.dev
   dig @1.1.1.1 omnihub.dev

   # Use DNS checker
   https://dnschecker.org
   ```

4. ✅ Verify site accessible via new DNS (wait up to 48 hours for full propagation)

### Day 4-5: Canary Deployment

**Canary Strategy:** Progressive rollout with monitoring

**Phase 1: 5% Traffic (Hour 0-4)**
1. Deploy to production (5% via Vercel traffic splitting)
2. Monitor error rate, latency, user complaints
3. **Go/No-Go Decision:**
   - Error rate < 1%: ✅ Proceed
   - Error rate > 1%: ❌ Rollback

**Phase 2: 25% Traffic (Hour 4-8)**
1. Increase to 25% traffic
2. Monitor closely
3. **Go/No-Go Decision:**
   - Error rate < 1%: ✅ Proceed
   - Error rate > 1%: ❌ Rollback

**Phase 3: 50% Traffic (Hour 8-16)**
1. Increase to 50% traffic
2. Monitor error budget
3. **Go/No-Go Decision:**
   - Error budget > 50% remaining: ✅ Proceed
   - Error budget < 50%: ⚠️ Investigate before proceeding

**Phase 4: 100% Traffic (Hour 16-24)**
1. Roll out to 100% traffic
2. Monitor for 24 hours
3. **Final Sign-Off:**
   - All metrics green for 24 hours: ✅ Deployment complete
   - Any issues: ⚠️ Investigate and resolve

### Day 6-7: Post-Deployment Monitoring

**Tasks:**
1. ✅ Monitor error budget (should be > 99.9% uptime)
2. ✅ Monitor performance (P95 latency < 500ms)
3. ✅ Monitor costs (should be ~$106/month)
4. ✅ Verify backups running (daily automated backups)
5. ✅ Create post-deployment report

---

## MONITORING AND ALERTS

### SLO Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Uptime | 99.9% | < 99.5% (critical) |
| Error rate | < 1% | > 2% (warning), > 5% (critical) |
| P95 latency | < 500ms | > 1000ms (warning), > 2000ms (critical) |
| Database latency | < 100ms | > 500ms (warning), > 1000ms (critical) |

### Critical Alerts

**1. High Error Rate**
- **Threshold:** > 5% for 5 minutes
- **Action:** PagerDuty alert + #incidents Slack
- **Runbook:** `docs/runbooks/high-error-rate.md`

**2. Service Down**
- **Threshold:** 2 consecutive health check failures
- **Action:** PagerDuty alert + #incidents Slack
- **Runbook:** `docs/runbooks/service-down.md`

**3. Database High Latency**
- **Threshold:** > 1000ms average for 10 minutes
- **Action:** #devops Slack
- **Runbook:** `docs/runbooks/database-latency.md`

### On-Call Rotation

**Primary:** DevOps Team (rotate weekly)
**Secondary:** Backend Team (escalation)
**Escalation Path:** Primary → Secondary → Tech Lead → CTO

---

## COST MONITORING

### Budget Alerts

- ⚠️ Warning at $120/month (13% over budget)
- 🚨 Critical at $150/month (41% over budget)

### Cost Breakdown (Target: $106/month)

| Service | Tier | Cost |
|---------|------|------|
| Cloudflare | Pro | $20/month |
| Upstash Redis | Pro (1M/day) | $10/month |
| Vercel | Pro | $20/month |
| Sentry | Team (100k events) | $26/month |
| Datadog | Pro (1 host + logs + RUM) | $30/month |
| Terraform Cloud | Free | $0 |
| **Total** | | **$106/month** |

---

## SUCCESS CRITERIA

### Technical Success

- ✅ All staging tests passing (100% for 7 days)
- ✅ Production deployment successful (0 rollbacks)
- ✅ Error rate < 1% (99%+ of requests successful)
- ✅ P95 latency < 500ms (fast user experience)
- ✅ Uptime > 99.9% (< 43 minutes downtime/month)

### Business Success

- ✅ Cost within budget ($106/month ± 10%)
- ✅ No user-facing incidents (no complaints)
- ✅ Support tickets < 5/week (stable system)
- ✅ Stakeholder satisfaction (positive feedback)

### Operational Success

- ✅ On-call team trained (runbooks reviewed)
- ✅ Incident response tested (simulated incident)
- ✅ DR drill passed (database restore successful)
- ✅ Monitoring dashboards deployed (real-time visibility)

---

## ROLLBACK PROCEDURES

### Scenario 1: High Error Rate During Canary

**Symptoms:** Error rate > 5% during canary deployment

**Steps:**
1. Immediately stop traffic split
   ```bash
   vercel rollback --production
   ```
2. Notify team in #incidents Slack
3. Investigate root cause
4. Fix issue in staging
5. Restart canary deployment

**RTO:** < 5 minutes

### Scenario 2: DNS Issues After Migration

**Symptoms:** Users unable to access site after nameserver change

**Steps:**
1. Verify DNS records in Cloudflare match original
2. If incorrect, fix DNS records (propagates in 5 min due to low TTL)
3. If persistent, revert nameservers to Vercel
4. Investigate root cause

**RTO:** 5-10 minutes (low TTL ensures fast propagation)

### Scenario 3: Database Corruption

**Symptoms:** Data integrity issues, failed queries

**Steps:**
1. Enable emergency controls kill switch
   ```sql
   UPDATE emergency_controls
   SET kill_switch = true,
       reason = 'Database corruption detected'
   WHERE id = '00000000-0000-0000-0000-000000000001';
   ```
2. Restore from latest backup
   ```bash
   supabase db restore --backup <backup-id>
   ```
3. Verify data integrity
4. Disable kill switch
5. Resume operations

**RTO:** < 1 hour
**RPO:** < 5 minutes (Point-in-Time Recovery)

---

## COMMUNICATION PLAN

### Pre-Deployment

- **T-1 week:** Notify stakeholders of upcoming deployment
- **T-3 days:** Reminder email to team and users
- **T-1 day:** Final reminder, confirm deployment window

### During Deployment

- **Start:** Post in #deployments Slack channel
- **Every 4 hours:** Status update (canary phase progress)
- **Issues:** Immediate notification in #incidents

### Post-Deployment

- **T+24 hours:** Deployment success confirmation
- **T+1 week:** Post-deployment report
- **T+1 month:** Retrospective meeting

---

## APPROVAL SECTION

### Pre-Production Sign-Off

**Checklist Review:**
- [ ] All technical readiness criteria met
- [ ] All infrastructure readiness criteria met
- [ ] All operational readiness criteria met
- [ ] All business readiness criteria met

**Approved By:**
- [ ] Tech Lead: _________________ Date: _______
- [ ] CTO: _____________________ Date: _______

**Deployment Window:**
- Scheduled Date: _______________
- Time: _________ (Low traffic window: 2-4 AM UTC)

**Rollback Authority:**
- Primary: __________________
- Secondary: ________________

---

**Document Status:** 🚨 REQUIRES APPROVAL
**Last Updated:** 2026-01-03
**Owner:** DevOps Team
**Next Steps:** Submit for approval, schedule deployment
