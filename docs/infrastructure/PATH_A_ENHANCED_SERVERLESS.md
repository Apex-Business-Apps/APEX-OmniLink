# PATH A: ENHANCED SERVERLESS
**Recommended Implementation for OmniHub/TradeLine/APEX**

**Status:** ⭐ **RECOMMENDED** (Fastest, most cost-effective, aligns with current architecture)

---

## OVERVIEW

**Strategy:** Enhance existing Vercel + Supabase serverless architecture with IaC, observability, security hardening, and operator controls.

**Why This Path?**
- ✅ **Current State Match:** Already on Vercel + Supabase
- ✅ **Zero Migration Risk:** No runtime changes, no service disruption
- ✅ **Fast Time-to-Production:** 2-4 weeks vs 3-6 months for containerization
- ✅ **Low Operational Overhead:** Managed services (no K8s to operate)
- ✅ **Cost-Effective:** Pay-per-use, scales to zero
- ✅ **Developer Experience:** Familiar stack, fast iteration

**When to Reconsider:**
- User base > 5M users (serverless limits reached)
- Need custom runtimes not supported by Vercel/Supabase
- Regulatory requirement for on-premises deployment
- Need multi-cloud active-active (not just DR)

---

## ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ CLOUDFLARE (Edge Layer)                                     │
│ - DDoS protection, WAF, bot detection                       │
│ - Global CDN (static assets)                                │
│ - Rate limiting (distributed)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼
┌──────────────────┐    ┌──────────────────────┐
│ VERCEL           │    │ SUPABASE             │
│ (Frontend Host)  │    │ (Backend Platform)   │
│                  │    │                      │
│ - React SPA      │◄──►│ PostgreSQL           │
│ - Edge Functions │    │ Edge Functions (Deno)│
│ - Auto CDN       │    │ Realtime (optional)  │
│ - Preview URLs   │    │ Storage (S3-compat)  │
└──────────────────┘    │ Auth                 │
                        └──────┬───────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │ EXTERNAL SERVICES            │
                ├──────────────────────────────┤
                │ Upstash Redis                │
                │ - Rate limiting (distributed)│
                │ - Idempotency cache          │
                │ - Session storage            │
                ├──────────────────────────────┤
                │ HashiCorp Vault Cloud        │
                │ - Secrets management         │
                │ - Automatic rotation         │
                ├──────────────────────────────┤
                │ Datadog / Sentry             │
                │ - Logs, metrics, traces      │
                │ - Alerting                   │
                ├──────────────────────────────┤
                │ Alchemy                      │
                │ - Ethereum RPC (primary)     │
                │ - Polygon RPC                │
                │ - NFT webhooks               │
                ├──────────────────────────────┤
                │ Infura (Fallback)            │
                │ - Backup RPC provider        │
                └──────────────────────────────┘
```

---

## COMPONENT MAPPING

| Abstract Component | Serverless Implementation |
|--------------------|---------------------------|
| **Edge / API Gateway** | Cloudflare Workers + Vercel Edge Functions |
| **Orchestrator** | Supabase Edge Function: `omnilink-agent` + approval queue (PostgreSQL) |
| **Executor Pool** | Supabase Edge Functions (isolated by design) |
| **Event Bus** | Supabase Realtime (optional) or Upstash for async jobs |
| **Primary Database** | Supabase PostgreSQL (managed) |
| **Cache / Rate Limiting** | Upstash Redis (serverless Redis) |
| **Secrets Manager** | HashiCorp Vault Cloud or Doppler |
| **Blob Storage** | Supabase Storage (S3-compatible) |
| **Observability** | Datadog or Sentry + Vercel Analytics + Supabase Logs |
| **WAF / DDoS** | Cloudflare (WAF, rate limiting, bot detection) |

---

## EMERGENCY CONTROLS IMPLEMENTATION

### 1. OMNIHUB_KILL_SWITCH

**Implementation:**
```typescript
// supabase/functions/_shared/emergency-controls.ts
import { createClient } from '@supabase/supabase-js';

interface EmergencyControls {
  OMNIHUB_KILL_SWITCH: boolean;
  EXECUTION_SAFE_MODE: boolean;
  OPERATOR_TAKEOVER: boolean;
  ALLOWED_OPERATIONS: string[];
  updated_at: string;
  updated_by: string;
}

// Stored in Supabase table with admin-only access
export async function getEmergencyControls(): Promise<EmergencyControls> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase
    .from('emergency_controls')
    .select('*')
    .single();

  if (error || !data) {
    // Fail-safe: if table is unreachable, assume kill switch is ON
    console.error('Failed to load emergency controls, failing closed');
    return {
      OMNIHUB_KILL_SWITCH: true,
      EXECUTION_SAFE_MODE: true,
      OPERATOR_TAKEOVER: true,
      ALLOWED_OPERATIONS: [],
      updated_at: new Date().toISOString(),
      updated_by: 'system_failsafe'
    };
  }

  return data;
}

// Middleware for all edge functions
export async function enforceEmergencyControls(operation: string) {
  const controls = await getEmergencyControls();

  if (controls.OMNIHUB_KILL_SWITCH) {
    throw new Error('OMNIHUB_KILL_SWITCH is enabled - all operations are disabled');
  }

  if (controls.OPERATOR_TAKEOVER && !controls.ALLOWED_OPERATIONS.includes(operation)) {
    throw new Error('OPERATOR_TAKEOVER is enabled - operation requires manual approval');
  }

  return controls;
}
```

**Database Schema:**
```sql
-- Migration: 20260102000000_emergency_controls.sql
CREATE TABLE emergency_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  OMNIHUB_KILL_SWITCH BOOLEAN NOT NULL DEFAULT false,
  EXECUTION_SAFE_MODE BOOLEAN NOT NULL DEFAULT false,
  OPERATOR_TAKEOVER BOOLEAN NOT NULL DEFAULT false,
  ALLOWED_OPERATIONS TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  reason TEXT
);

-- Insert default values (all controls OFF)
INSERT INTO emergency_controls (id, OMNIHUB_KILL_SWITCH, EXECUTION_SAFE_MODE, OPERATOR_TAKEOVER)
VALUES ('00000000-0000-0000-0000-000000000001', false, false, false);

-- RLS: Only admins can modify
ALTER TABLE emergency_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY emergency_controls_admin_only ON emergency_controls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Audit trigger (log all changes)
CREATE OR REPLACE FUNCTION audit_emergency_controls()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    resource_type,
    resource_id,
    metadata,
    actor_id
  ) VALUES (
    'emergency_control_updated',
    'emergency_controls',
    NEW.id,
    jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    ),
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER emergency_controls_audit
  AFTER UPDATE ON emergency_controls
  FOR EACH ROW
  EXECUTE FUNCTION audit_emergency_controls();
```

### 2. Approval Queue

**Implementation:**
```typescript
// supabase/functions/_shared/approval-queue.ts
export async function requireApproval(params: {
  workflow_id: string;
  user_id: string;
  action: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  blast_radius: string;
  metadata: Record<string, unknown>;
}) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Insert approval request
  const { data, error } = await supabase
    .from('approval_queue')
    .insert({
      workflow_id: params.workflow_id,
      user_id: params.user_id,
      action: params.action,
      risk_level: params.risk_level,
      blast_radius: params.blast_radius,
      metadata: params.metadata,
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create approval request: ${error.message}`);
  }

  // TODO: Send notification to operators (email, Slack, SMS)
  await notifyOperators(data.id, params);

  return data;
}

export async function checkApproval(approval_id: string): Promise<'pending' | 'approved' | 'rejected' | 'expired'> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase
    .from('approval_queue')
    .select('status, expires_at')
    .eq('id', approval_id)
    .single();

  if (error || !data) {
    return 'expired';
  }

  // Auto-expire if past deadline
  if (new Date(data.expires_at) < new Date()) {
    await supabase
      .from('approval_queue')
      .update({ status: 'expired' })
      .eq('id', approval_id);
    return 'expired';
  }

  return data.status;
}
```

---

## INFRASTRUCTURE AS CODE (TERRAFORM)

### Directory Structure
```
terraform/
├── modules/
│   ├── supabase/
│   │   ├── main.tf           # Supabase project config (via API)
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── vercel/
│   │   ├── main.tf           # Vercel project config
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── cloudflare/
│   │   ├── main.tf           # DNS, WAF, rate limiting
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── upstash/
│   │   ├── main.tf           # Redis database
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── observability/
│       ├── datadog.tf        # Datadog dashboards, monitors
│       ├── sentry.tf         # Sentry projects
│       └── variables.tf
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── production/
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars
└── backend.tf                # Remote state (Terraform Cloud or S3)
```

### Example: Terraform for Vercel

**File:** `terraform/modules/vercel/main.tf`
```hcl
terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
}

resource "vercel_project" "omnihub" {
  name      = var.project_name
  framework = "vite"

  git_repository {
    type = "github"
    repo = var.github_repo
  }

  environment = [
    {
      key    = "VITE_SUPABASE_URL"
      value  = var.supabase_url
      target = ["production", "preview"]
    },
    {
      key    = "VITE_SUPABASE_PUBLISHABLE_KEY"
      value  = var.supabase_anon_key
      target = ["production", "preview"]
    },
    {
      key    = "VITE_ALCHEMY_API_KEY_ETH"
      value  = var.alchemy_api_key_eth
      target = ["production"]
      type   = "secret"
    }
  ]

  # Security headers from vercel.json
  build_command = "npm run build"
  output_path   = "dist"
}

resource "vercel_project_domain" "omnihub_production" {
  project_id = vercel_project.omnihub.id
  domain     = var.production_domain
}

output "project_id" {
  value = vercel_project.omnihub.id
}

output "deployment_url" {
  value = vercel_project.omnihub.production_url
}
```

### Example: Terraform for Supabase (via Management API)

**File:** `terraform/modules/supabase/main.tf`
```hcl
# Note: Supabase doesn't have official Terraform provider yet
# This uses the Supabase Management API via http provider

terraform {
  required_providers {
    http = {
      source  = "hashicorp/http"
      version = "~> 3.0"
    }
  }
}

# Create Supabase project via Management API
resource "null_resource" "supabase_project" {
  provisioner "local-exec" {
    command = <<-EOT
      curl -X POST https://api.supabase.com/v1/projects \
        -H "Authorization: Bearer ${var.supabase_access_token}" \
        -H "Content-Type: application/json" \
        -d '{
          "organization_id": "${var.supabase_org_id}",
          "name": "${var.project_name}",
          "region": "${var.region}",
          "plan": "pro"
        }'
    EOT
  }

  triggers = {
    project_name = var.project_name
  }
}

# For now, Supabase infra is managed via:
# 1. Database schema: SQL migrations in supabase/migrations/ (version-controlled)
# 2. Edge functions: Deployed via Supabase CLI (in CI/CD)
# 3. Storage buckets: Configured via SQL or Supabase CLI

# Future: When Supabase releases official Terraform provider, migrate to it
```

### Example: Terraform for Cloudflare

**File:** `terraform/modules/cloudflare/main.tf`
```hcl
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# DNS records
resource "cloudflare_record" "omnihub_apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  value   = var.vercel_cname
  type    = "CNAME"
  proxied = true  # Enable Cloudflare proxy (WAF, DDoS protection)
}

resource "cloudflare_record" "omnihub_www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  value   = var.vercel_cname
  type    = "CNAME"
  proxied = true
}

# WAF rules
resource "cloudflare_ruleset" "waf" {
  zone_id     = var.cloudflare_zone_id
  name        = "OmniHub WAF"
  description = "Web Application Firewall for OmniHub"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules {
    action = "block"
    expression = "(cf.threat_score > 50)"
    description = "Block high-threat-score requests"
  }

  rules {
    action = "challenge"
    expression = "(http.user_agent contains \"bot\")"
    description = "Challenge suspected bots"
  }
}

# Rate limiting (distributed)
resource "cloudflare_rate_limit" "api" {
  zone_id   = var.cloudflare_zone_id
  threshold = 100
  period    = 60  # 100 requests per 60 seconds

  match {
    request {
      url_pattern = "*/functions/v1/*"
    }
  }

  action {
    mode    = "simulate"  # Start with simulate, then switch to "ban"
    timeout = 60
  }
}

# TLS settings
resource "cloudflare_zone_settings_override" "omnihub" {
  zone_id = var.cloudflare_zone_id

  settings {
    tls_1_3                  = "on"
    automatic_https_rewrites = "on"
    ssl                      = "strict"  # Full (strict) TLS
    min_tls_version          = "1.2"
    always_use_https         = "on"
    http2                    = "on"
    http3                    = "on"
  }
}
```

---

## CI/CD PIPELINE (ENHANCED)

### GitHub Actions Workflow

**File:** `.github/workflows/deploy-staging.yml`
```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  SUPABASE_PROJECT_ID: ${{ secrets.STAGING_SUPABASE_PROJECT_ID }}
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

jobs:
  pre-deploy-gates:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript type check
        run: npm run typecheck

      - name: ESLint
        run: npm run lint

      - name: Unit tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Security scan (Snyk)
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  deploy-database:
    needs: pre-deploy-gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Run database migrations
        run: |
          supabase db push \
            --project-ref ${{ env.SUPABASE_PROJECT_ID }} \
            --password ${{ secrets.STAGING_DB_PASSWORD }}

  deploy-edge-functions:
    needs: deploy-database
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Deploy all edge functions
        run: |
          # Deploy each function
          for func in supabase/functions/*; do
            if [ -d "$func" ]; then
              func_name=$(basename "$func")
              echo "Deploying $func_name..."
              supabase functions deploy "$func_name" \
                --project-ref ${{ env.SUPABASE_PROJECT_ID }}
            fi
          done

  deploy-frontend:
    needs: pre-deploy-gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel (staging)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'  # Deploy to staging environment

  smoke-tests:
    needs: [deploy-edge-functions, deploy-frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Wait for deployment propagation
        run: sleep 30

      - name: Run smoke tests
        env:
          STAGING_URL: ${{ secrets.STAGING_URL }}
        run: |
          npm ci
          npm run test:smoke -- --url=$STAGING_URL

      - name: Run E2E tests (Playwright)
        env:
          STAGING_URL: ${{ secrets.STAGING_URL }}
        run: |
          npx playwright install --with-deps chromium
          npm run test:e2e -- --url=$STAGING_URL

  notify:
    needs: [smoke-tests]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Notify Slack (success)
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          payload: |
            {
              "text": "✅ Staging deployment succeeded",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "✅ *Staging Deployment Succeeded*\n\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}"
                  }
                }
              ]
            }

      - name: Notify Slack (failure)
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          payload: |
            {
              "text": "❌ Staging deployment failed",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "❌ *Staging Deployment Failed*\n\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}\n\nCheck logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                  }
                }
              ]
            }
```

### Production Deployment (Manual Approval)

**File:** `.github/workflows/deploy-production.yml`
```yaml
name: Deploy to Production

on:
  workflow_dispatch:
    inputs:
      deployment_strategy:
        description: 'Deployment strategy'
        required: true
        type: choice
        options:
          - canary
          - blue-green
      canary_percentage:
        description: 'Initial canary percentage (if canary strategy)'
        required: false
        default: '5'

jobs:
  require-approval:
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval in GitHub
    steps:
      - name: Manual approval checkpoint
        run: echo "Production deployment approved by ${{ github.actor }}"

  # ... rest of deployment steps (similar to staging)
```

---

## OBSERVABILITY SETUP

### Datadog Integration

**Supabase Edge Functions → Datadog:**
```typescript
// supabase/functions/_shared/datadog.ts
import { client } from 'https://esm.sh/@datadog/datadog-api-client@1.0.0';

const DD_API_KEY = Deno.env.get('DD_API_KEY');
const DD_APP_KEY = Deno.env.get('DD_APP_KEY');

export async function sendMetric(name: string, value: number, tags: string[] = []) {
  if (!DD_API_KEY) return; // Graceful degradation

  const metricsApi = new client.v2.MetricsApi();
  await metricsApi.submitMetrics({
    series: [{
      metric: name,
      type: 'gauge',
      points: [{ timestamp: Math.floor(Date.now() / 1000), value }],
      tags: [...tags, 'env:production', 'service:omnihub']
    }]
  });
}

export async function sendLog(message: string, level: string, context: Record<string, unknown>) {
  if (!DD_API_KEY) {
    console.log(JSON.stringify({ level, message, ...context }));
    return;
  }

  const logsApi = new client.v2.LogsApi();
  await logsApi.submitLog({
    ddsource: 'supabase-edge-function',
    ddtags: 'env:production,service:omnihub',
    hostname: 'edge-function',
    message,
    service: 'omnihub',
    status: level,
    ...context
  });
}
```

**Usage in Edge Function:**
```typescript
// supabase/functions/omnilink-agent/index.ts
import { sendMetric, sendLog } from '../_shared/datadog.ts';
import { enforceEmergencyControls } from '../_shared/emergency-controls.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
  const trace_id = crypto.randomUUID();

  try {
    // Check emergency controls
    await enforceEmergencyControls('omnilink_agent');

    // Process request
    const body = await req.json();
    const result = await processIntent(body, trace_id);

    // Log success
    await sendLog('Intent processed successfully', 'info', {
      trace_id,
      user_id: body.user_id,
      intent: body.intent
    });

    // Send metrics
    const duration = Date.now() - startTime;
    await sendMetric('omnihub.agent.duration', duration, ['status:success']);
    await sendMetric('omnihub.agent.requests', 1, ['status:success']);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'X-Trace-ID': trace_id }
    });

  } catch (error) {
    // Log error
    await sendLog('Intent processing failed', 'error', {
      trace_id,
      error: error.message,
      stack: error.stack
    });

    // Send error metric
    await sendMetric('omnihub.agent.requests', 1, ['status:error']);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'X-Trace-ID': trace_id }
    });
  }
});
```

---

## COST ESTIMATE (STAGING)

| Service | Plan | Estimated Cost/Month |
|---------|------|---------------------|
| **Vercel** | Pro | $20 |
| **Supabase** | Pro | $25 |
| **Cloudflare** | Pro | $20 |
| **Upstash Redis** | Pay-as-you-go | $10 |
| **Datadog** | Pro (1 host) | $15 |
| **Sentry** | Team | $26 |
| **Alchemy** | Growth | $49 |
| **Total** | | **~$165/month** |

**Production (estimated):** $300-500/month (higher traffic, more edge function invocations)

---

## ROLLOUT TIMELINE

### Week 1: Foundation
- [ ] Set up Terraform structure
- [ ] Configure Cloudflare (DNS, WAF, rate limiting)
- [ ] Set up Upstash Redis
- [ ] Implement emergency controls (database schema + edge function middleware)

### Week 2: Observability
- [ ] Integrate Datadog (logs, metrics)
- [ ] Set up Sentry error tracking
- [ ] Create dashboards (SLOs, emergency controls, approval queue)
- [ ] Set up alerts (SLO violations, DLQ non-empty)

### Week 3: CI/CD
- [ ] Implement automated deployment to staging
- [ ] Add smoke tests to CI/CD
- [ ] Test rollback procedures
- [ ] Document runbooks

### Week 4: Staging Validation
- [ ] Deploy to staging with full stack
- [ ] Run end-to-end tests
- [ ] Perform chaos engineering tests (kill switch, safe mode, etc.)
- [ ] Operator training (control panel usage)

### Week 5-6: Production Rollout
- [ ] Create production Terraform workspace
- [ ] Deploy infrastructure
- [ ] Canary deployment (5% → 25% → 50% → 100%)
- [ ] Monitor for 1 week
- [ ] Declare production-ready

**Total Time:** 6 weeks (conservative estimate)

---

## PROS & CONS

### Pros ✅
- **Fast implementation:** 6 weeks vs 3-6 months for containerization
- **Low risk:** No runtime changes, builds on existing architecture
- **Cost-effective:** $165/month staging, $300-500/month prod
- **Developer-friendly:** Familiar stack (Vercel, Supabase)
- **Auto-scaling:** Serverless scales automatically (no capacity planning)
- **Low operational overhead:** No servers/containers to manage

### Cons ❌
- **Vendor lock-in:** Tight coupling to Vercel + Supabase
- **Cold starts:** Edge functions may have latency spikes (mitigated by keeping functions warm)
- **Limited customization:** Can't modify underlying runtime
- **Multi-cloud complexity:** Active-active multi-cloud not feasible (DR only)
- **Scaling limits:** May hit limits at 5M+ users (requires re-architecture)

---

## MIGRATION PATH TO PATH B (IF NEEDED LATER)

If you outgrow serverless, here's how to migrate to containerized (Path B):

1. **Containerize edge functions** (Dockerfile for each function)
2. **Set up Kubernetes cluster** (GKE/EKS/AKS)
3. **Migrate database** to Cloud SQL/RDS (Supabase supports Postgres dump)
4. **Dual-run** (serve traffic from both serverless + containers)
5. **Gradual traffic shift** (10% → 50% → 100% to containers)
6. **Decommission serverless** after full migration

**Estimated migration time:** 3-4 months
**Risk:** Medium (requires careful traffic shifting)

---

**RECOMMENDATION:** Start with Path A. Only migrate to Path B if you hit scaling limits or multi-cloud becomes a hard requirement.

---

**Document Status:** ✅ COMPLETE
**Next Step:** Generate Terraform code for staging environment
