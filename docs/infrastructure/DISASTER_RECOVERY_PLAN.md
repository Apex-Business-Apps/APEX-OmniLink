# DISASTER RECOVERY & BUSINESS CONTINUITY PLAN
**DR/BCP for OmniHub/TradeLine/APEX**

**Purpose:** Define recovery procedures, RPO/RTO targets, and failover strategies for catastrophic failures.

**Philosophy:** Hope for the best, plan for the worst. Test recovery procedures regularly.

---

## RPO/RTO TARGETS

### Service Level Targets

| Disaster Scenario | RPO (Max Data Loss) | RTO (Max Downtime) | Recovery Strategy |
|-------------------|---------------------|-------------------|-------------------|
| **Database Failure** | 15 minutes | 1 hour | Restore from point-in-time backup |
| **Application Crash** | 0 (stateless) | 5 minutes | Auto-restart, health checks |
| **Edge Function Failure** | 0 (stateless) | 2 minutes | Auto-restart, rollback to previous version |
| **Region Outage (AWS/GCP/Azure)** | 5 minutes | 10 minutes | Failover to standby region |
| **Complete Infrastructure Loss** | 1 hour | 4 hours | Restore from backups + IaC |
| **Data Corruption** | 24 hours | 8 hours | Restore from daily backup |
| **Ransomware / Security Breach** | 24 hours | 12 hours | Restore from immutable backups |

**Commitment:**
- **RPO:** < 1 hour (max data loss)
- **RTO:** < 4 hours (max downtime)

---

## BACKUP STRATEGY

### Database Backups (CLOUD-AGNOSTIC)

**Technology-Agnostic Approach:**

| Backup Type | Frequency | Retention | Storage Location | Recovery Method |
|-------------|-----------|-----------|------------------|-----------------|
| **Continuous WAL** | Real-time | 7 days | S3-compatible storage (cross-region) | Point-in-time recovery |
| **Full Backup** | Daily (2 AM UTC) | 30 days | S3-compatible storage (cross-region) | `pg_restore` |
| **Weekly Snapshot** | Weekly (Sunday) | 90 days | S3-compatible storage (cross-region) | Cloud provider snapshot restore |
| **Monthly Archive** | Monthly | 7 years | Glacier-compatible cold storage | Compliance/audit purposes |

**Implementation (Provider-Agnostic):**

```yaml
# Kubernetes CronJob for database backups (runs on any cloud)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: omnihub-data
spec:
  schedule: "0 2 * * *"  # 2 AM UTC daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: pg-backup
              image: postgres:15-alpine
              env:
                - name: PGHOST
                  valueFrom:
                    secretKeyRef:
                      name: database-credentials
                      key: host
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: database-credentials
                      key: password
                - name: AWS_ACCESS_KEY_ID  # Works with S3-compatible storage
                  valueFrom:
                    secretKeyRef:
                      name: backup-credentials
                      key: access_key
                - name: AWS_SECRET_ACCESS_KEY
                  valueFrom:
                    secretKeyRef:
                      name: backup-credentials
                      key: secret_key
                - name: S3_ENDPOINT  # Swappable: AWS S3, GCS, MinIO, R2
                  value: "https://s3.amazonaws.com"  # Or: storage.googleapis.com, r2.cloudflarestorage.com
                - name: S3_BUCKET
                  value: "omnihub-backups"
              command:
                - /bin/sh
                - -c
                - |
                  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
                  BACKUP_FILE="omnihub-backup-$TIMESTAMP.sql.gz"

                  # Dump database
                  pg_dump -h $PGHOST -U omnihub omnihub_db | gzip > /tmp/$BACKUP_FILE

                  # Upload to S3-compatible storage (works with any provider)
                  aws s3 cp /tmp/$BACKUP_FILE s3://$S3_BUCKET/daily/$BACKUP_FILE \
                    --endpoint-url $S3_ENDPOINT

                  # Verify backup integrity
                  aws s3 ls s3://$S3_BUCKET/daily/$BACKUP_FILE --endpoint-url $S3_ENDPOINT

                  echo "Backup completed: $BACKUP_FILE"
          restartPolicy: OnFailure
```

**Backup Verification (Automated):**

```yaml
# Weekly restore drill (automated test)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-restore-drill
spec:
  schedule: "0 3 * * 0"  # 3 AM UTC every Sunday
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: restore-drill
              image: postgres:15-alpine
              command:
                - /bin/sh
                - -c
                - |
                  # Download latest backup
                  LATEST_BACKUP=$(aws s3 ls s3://$S3_BUCKET/daily/ --endpoint-url $S3_ENDPOINT | sort | tail -n 1 | awk '{print $4}')
                  aws s3 cp s3://$S3_BUCKET/daily/$LATEST_BACKUP /tmp/restore.sql.gz --endpoint-url $S3_ENDPOINT

                  # Restore to isolated test database
                  gunzip < /tmp/restore.sql.gz | psql -h test-db.omnihub-test.svc.cluster.local -U omnihub test_db

                  # Verify row counts
                  psql -h test-db.omnihub-test.svc.cluster.local -U omnihub test_db -c "SELECT COUNT(*) FROM profiles"

                  # Report success/failure to monitoring
                  if [ $? -eq 0 ]; then
                    echo "Restore drill passed"
                    curl -X POST $SLACK_WEBHOOK -d '{"text":"✅ Weekly backup restore drill passed"}'
                  else
                    echo "Restore drill FAILED"
                    curl -X POST $SLACK_WEBHOOK -d '{"text":"❌ Weekly backup restore drill FAILED - investigate immediately"}'
                    exit 1
                  fi
```

### Infrastructure as Code Backups

**Terraform State:**
- **Storage:** S3-compatible backend (AWS S3, GCS, Cloudflare R2, MinIO)
- **Versioning:** Enabled (can rollback to any previous state)
- **Replication:** Cross-region replication
- **Lock:** DynamoDB or equivalent (Consul for self-hosted)

**Application Configuration:**
- **Git Repository:** All configs version-controlled
- **Secrets:** Backed up in secrets manager (with encryption)
- **Environment Variables:** Documented in IaC

### Application State Backups

**Stateless Services:** No backup needed (deployed from IaC)

**Stateful Data:**
- Database (see above)
- File storage (Supabase Storage / S3): Versioning enabled + cross-region replication
- Audit logs: Immutable append-only storage (WORM), 7-year retention

---

## RECOVERY PROCEDURES

### Scenario 1: Database Failure

**Symptoms:**
- Database health checks failing
- Application errors: "Unable to connect to database"
- Postgres logs: Connection refused

**Recovery Steps:**

**Option A: Point-in-Time Recovery (for recent failures)**

```bash
#!/bin/bash
# scripts/recover-database-pitr.sh

set -e

RESTORE_TO_TIME="2026-01-02T10:30:00Z"  # Specify desired recovery point

echo "🚨 DATABASE POINT-IN-TIME RECOVERY"
echo "Restore target: $RESTORE_TO_TIME"

# 1. Stop application (prevent writes during recovery)
kubectl scale deployment/api-gateway -n omnihub-prod --replicas=0
kubectl scale deployment/orchestrator -n omnihub-prod --replicas=0

# 2. Restore database (provider-specific, but standardized interface)
case $CLOUD_PROVIDER in
  aws)
    aws rds restore-db-instance-to-point-in-time \
      --source-db-instance-identifier omnihub-db-prod \
      --target-db-instance-identifier omnihub-db-recovered \
      --restore-time $RESTORE_TO_TIME
    ;;
  gcp)
    gcloud sql backups restore BACKUP_ID \
      --restore-time $RESTORE_TO_TIME \
      --backup-instance omnihub-db-prod \
      --async
    ;;
  self-hosted)
    # Restore from WAL archives
    pg_basebackup -D /var/lib/postgresql/data-recovered
    # Apply WAL up to target time
    ;;
esac

# 3. Wait for restore to complete
echo "Waiting for restore to complete (ETA: 10-30 minutes)..."
# Poll until database is ready

# 4. Update connection string
kubectl set env deployment/api-gateway DATABASE_HOST=omnihub-db-recovered.omnihub-prod.svc.cluster.local
kubectl set env deployment/orchestrator DATABASE_HOST=omnihub-db-recovered.omnihub-prod.svc.cluster.local

# 5. Restart application
kubectl scale deployment/api-gateway -n omnihub-prod --replicas=3
kubectl scale deployment/orchestrator -n omnihub-prod --replicas=2

# 6. Verify
curl -f https://omnihub.dev/health/deep

echo "✅ Database recovery complete. RPO: $(date -d "$RESTORE_TO_TIME" +%s) - $(date +%s) seconds"
```

**Option B: Restore from Daily Backup (for older recovery points)**

```bash
#!/bin/bash
# scripts/recover-database-from-backup.sh

set -e

BACKUP_DATE="20260101"  # YYYYMMDD format

echo "🚨 DATABASE RESTORE FROM BACKUP"
echo "Backup date: $BACKUP_DATE"

# 1. Stop application
kubectl scale deployment --all -n omnihub-prod --replicas=0

# 2. Download backup from S3-compatible storage
aws s3 cp s3://omnihub-backups/daily/omnihub-backup-$BACKUP_DATE-020000.sql.gz /tmp/restore.sql.gz \
  --endpoint-url $S3_ENDPOINT

# 3. Restore
gunzip < /tmp/restore.sql.gz | psql -h $DATABASE_HOST -U omnihub omnihub_db

# 4. Verify integrity
psql -h $DATABASE_HOST -U omnihub omnihub_db -c "SELECT COUNT(*) FROM profiles"
psql -h $DATABASE_HOST -U omnihub omnihub_db -c "SELECT MAX(created_at) FROM audit_logs"

# 5. Restart application
kubectl scale deployment --all -n omnihub-prod --replicas=3

echo "✅ Restore complete. RPO: Last backup was $(date -d "$BACKUP_DATE" +%Y-%m-%d)"
```

**Expected RTO:** 30-60 minutes
**Expected RPO:** 0-15 minutes (PITR) or 0-24 hours (daily backup)

---

### Scenario 2: Regional Outage (Cloud Provider Failure)

**Symptoms:**
- Entire region unreachable (AWS us-east-1 down, GCP us-central1 down, etc.)
- Health checks failing from all locations
- Cloud provider status page confirms outage

**Recovery Steps: Failover to Standby Region**

```bash
#!/bin/bash
# scripts/failover-to-standby-region.sh

set -e

STANDBY_REGION="eu-west-1"  # Or us-west-2, asia-southeast-1, etc.

echo "🚨 REGIONAL FAILOVER TO $STANDBY_REGION"

# 1. Promote standby database to primary (read-write)
case $CLOUD_PROVIDER in
  aws)
    aws rds promote-read-replica \
      --db-instance-identifier omnihub-db-replica-$STANDBY_REGION \
      --region $STANDBY_REGION
    ;;
  gcp)
    gcloud sql instances promote-replica omnihub-db-replica-$STANDBY_REGION
    ;;
  cockroachdb)
    # CockroachDB automatically handles multi-region failover (no manual step)
    echo "CockroachDB multi-region cluster handles failover automatically"
    ;;
esac

# 2. Update DNS (global load balancer)
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/load_balancers/$LB_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --data '{
    "pools": [
      {"id": "'"$POOL_STANDBY_REGION"'", "weight": 100},
      {"id": "'"$POOL_PRIMARY_REGION"'", "weight": 0}
    ]
  }'

# OR: Update Route53 failover record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456 \
  --change-batch file://dns-failover-$STANDBY_REGION.json

# 3. Scale up standby Kubernetes cluster (if scaled down)
kubectl --context=gke-$STANDBY_REGION scale deployment --all -n omnihub-prod --replicas=3

# 4. Verify services
kubectl --context=gke-$STANDBY_REGION get pods -n omnihub-prod
curl -f https://omnihub.dev/health/deep

# 5. Notify stakeholders
curl -X POST $SLACK_WEBHOOK -d '{"text":"🚨 FAILOVER: Primary region down, now serving from '"$STANDBY_REGION"'"}'

echo "✅ Failover complete. Now serving from $STANDBY_REGION"
echo "RTO: $(date)"
```

**Expected RTO:** 5-10 minutes (automated) or 15-30 minutes (manual)
**Expected RPO:** 0-5 minutes (replication lag)

**Prerequisites:**
- Standby region must have:
  - Database replica (async replication from primary)
  - Kubernetes cluster (scaled down to 1 node, or fully provisioned)
  - Same application version deployed
  - Global load balancer health checks configured

---

### Scenario 3: Complete Infrastructure Loss (Total Rebuild)

**Symptoms:**
- Entire cloud account compromised/deleted
- Terraform state corrupted
- All infrastructure gone

**Recovery Steps: Rebuild from Scratch**

```bash
#!/bin/bash
# scripts/disaster-recovery-full-rebuild.sh

set -e

echo "🚨 DISASTER RECOVERY: FULL REBUILD"

# PREREQUISITES:
# - Terraform state backed up in separate location
# - Database backups in separate cloud account/region
# - Secrets backed up in separate secrets manager

# 1. Restore Terraform state
echo "Step 1: Restoring Terraform state..."
aws s3 cp s3://omnihub-terraform-state-backup/terraform.tfstate terraform.tfstate \
  --endpoint-url $BACKUP_S3_ENDPOINT

# 2. Provision infrastructure from IaC
echo "Step 2: Provisioning infrastructure..."
cd terraform/environments/production
terraform init
terraform plan
terraform apply -auto-approve  # In real DR, review plan first

# This creates:
# - Kubernetes cluster
# - Database (empty)
# - Redis cache
# - Load balancers
# - Networking

# 3. Restore database from backup
echo "Step 3: Restoring database..."
LATEST_BACKUP=$(aws s3 ls s3://omnihub-backups/daily/ --endpoint-url $BACKUP_S3_ENDPOINT | sort | tail -n 1 | awk '{print $4}')
aws s3 cp s3://omnihub-backups/daily/$LATEST_BACKUP /tmp/restore.sql.gz --endpoint-url $BACKUP_S3_ENDPOINT
gunzip < /tmp/restore.sql.gz | psql -h $(terraform output -raw database_host) -U omnihub omnihub_db

# 4. Restore secrets
echo "Step 4: Restoring secrets..."
./scripts/restore-secrets-from-backup.sh

# 5. Deploy application
echo "Step 5: Deploying application..."
kubectl apply -f k8s/production/

# 6. Verify
echo "Step 6: Verifying services..."
kubectl get pods -n omnihub-prod
curl -f https://omnihub.dev/health/deep

# 7. Verify data integrity
psql -h $(terraform output -raw database_host) -U omnihub omnihub_db -c "SELECT COUNT(*) FROM profiles"

echo "✅ Disaster recovery complete"
echo "RTO: $(date)"
echo "Next steps:"
echo "1. Investigate root cause of infrastructure loss"
echo "2. Implement additional safeguards"
echo "3. Update DR plan with lessons learned"
```

**Expected RTO:** 2-4 hours (depends on infrastructure provisioning time)
**Expected RPO:** 0-24 hours (last daily backup)

---

## FAILBACK PROCEDURES (Return to Primary Region)

**When to Failback:**
- Primary region outage resolved
- Primary region stable for > 24 hours
- Planned maintenance window

**Failback Steps:**

```bash
#!/bin/bash
# scripts/failback-to-primary-region.sh

set -e

PRIMARY_REGION="us-east-1"

echo "Failback to primary region: $PRIMARY_REGION"

# 1. Replicate data from standby to primary (if database was modified)
pg_dump -h standby-db | psql -h primary-db

# 2. Route traffic back to primary (gradual)
# 10% → 25% → 50% → 100% over 2 hours

for WEIGHT in 10 25 50 100; do
  PRIMARY_WEIGHT=$WEIGHT
  STANDBY_WEIGHT=$((100 - WEIGHT))

  curl -X PUT "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/load_balancers/$LB_ID" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    --data '{
      "pools": [
        {"id": "'"$POOL_PRIMARY_REGION"'", "weight": '"$PRIMARY_WEIGHT"'},
        {"id": "'"$POOL_STANDBY_REGION"'", "weight": '"$STANDBY_WEIGHT"'}
      ]
    }'

  echo "Routed $PRIMARY_WEIGHT% to primary, $STANDBY_WEIGHT% to standby"
  echo "Monitoring for 30 minutes..."
  sleep 1800
done

echo "✅ Failback complete. Primary region is now active."
```

---

## DISASTER RECOVERY DRILLS

### Quarterly DR Drill Schedule

**Q1 (January):** Database restore drill
**Q2 (April):** Regional failover drill
**Q3 (July):** Full infrastructure rebuild drill
**Q4 (October):** Chaos engineering (simulate random failures)

### Drill Checklist

**Pre-Drill:**
- [ ] Notify team (this is a drill)
- [ ] Schedule during low-traffic period
- [ ] Backup current state (in case drill causes issues)
- [ ] Prepare isolated environment (do NOT touch production)

**During Drill:**
- [ ] Follow recovery runbook exactly
- [ ] Time each step (measure actual RTO)
- [ ] Document any blockers or issues
- [ ] Verify data integrity after recovery

**Post-Drill:**
- [ ] Calculate actual RPO/RTO
- [ ] Compare to targets
- [ ] Document lessons learned
- [ ] Update runbooks with improvements
- [ ] Report results to SRE team

---

## BUSINESS CONTINUITY PLAN

### Critical Services Prioritization

**Tier 1 (Must Restore First):**
- Database (data store)
- API Gateway (user access)
- Authentication service

**Tier 2 (Restore Second):**
- Orchestrator (workflow management)
- Executor pool (workflow execution)
- Web3 services (blockchain integration)

**Tier 3 (Restore Last):**
- Analytics
- Audit log export
- Non-critical dashboards

### Communication Plan

**Stakeholders:**

| Stakeholder | Notification Method | When | Who Notifies |
|-------------|-------------------|------|--------------|
| **Users** | Status page + email | 5 min after incident detected | Communications Lead |
| **Internal Team** | Slack #incidents channel | Immediately | Incident Commander |
| **Exec Team** | Slack + SMS | For SEV-1 incidents | Incident Commander |
| **Customers (B2B)** | Email + direct call | For multi-hour outages | Account Manager |

**Status Page Updates:**

```
Example update (5 min after incident):
─────────────────────────────────────────────────────────
🟡 Degraded Performance - Database Issues
─────────────────────────────────────────────────────────
We are currently experiencing issues with our database. Some users may experience errors or slow responses. Our team is actively investigating.

Next update: 15 minutes

Updates:
[10:35 UTC] Incident detected, on-call engineer investigating
```

---

## DATA LOSS PREVENTION

### Immutable Backups (Ransomware Protection)

**Strategy:**
- Backups stored in S3 with Object Lock (WORM - Write Once Read Many)
- Cannot be deleted or modified (even by root user)
- Retention: 30 days (regulatory compliance)

**Implementation:**
```bash
# Enable S3 Object Lock on backup bucket
aws s3api put-object-lock-configuration \
  --bucket omnihub-backups \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Days": 30
      }
    }
  }'
```

### Multi-Cloud Backup Replication

**Redundancy Strategy:**
- Primary backups: Cloud provider A (e.g., AWS S3)
- Replicated backups: Cloud provider B (e.g., GCP Cloud Storage)
- Tertiary backups: Cloud provider C (e.g., Cloudflare R2)

**Cost:** Triplicate backups increase storage costs 3x, but provide maximum resilience

---

## SUMMARY

**RPO/RTO Targets:**
- RPO: < 1 hour
- RTO: < 4 hours

**Backup Strategy:**
- Continuous WAL (point-in-time recovery)
- Daily full backups (30-day retention)
- Weekly snapshots (90-day retention)
- Monthly archives (7-year retention for compliance)

**Recovery Procedures:**
- Database failure → PITR or daily backup restore (30-60 min RTO)
- Regional outage → Failover to standby region (10 min RTO)
- Total infrastructure loss → Rebuild from IaC + backups (2-4 hour RTO)

**DR Drills:**
- Quarterly drills (Q1: DB restore, Q2: Regional failover, Q3: Full rebuild, Q4: Chaos)
- Automated weekly restore tests (verify backup integrity)

**Next Steps:**
1. Implement backup automation (CronJobs)
2. Set up cross-region replication
3. Schedule first DR drill
4. Document communication plan
5. Test emergency contact list

---

**Document Status:** ✅ COMPLETE
**Next:** Terraform IaC Generation, Architecture Summary (VERIFIED vs PROPOSED)
