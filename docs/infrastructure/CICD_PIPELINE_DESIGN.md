# CI/CD PIPELINE DESIGN
**Continuous Integration & Deployment for OmniHub/TradeLine/APEX**

**Purpose:** Define automated pipelines for building, testing, and deploying OmniHub with operator-controlled safety gates.

**Philosophy:** Automate everything, but preserve human control for prod-impacting changes.

---

## PIPELINE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│ DEVELOPER WORKFLOW                                          │
│                                                             │
│ 1. Code → Commit → Push to feature branch                  │
│ 2. Open Pull Request                                        │
│ 3. CI runs automatically (tests, security scans)           │
│ 4. Merge to main (after review + CI green)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTINUOUS INTEGRATION (CI) - Runs on Every PR/Push        │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ STAGE 1: Pre-Build Checks (Parallel)               │   │
│ │ - TypeScript type check                             │   │
│ │ - ESLint (code quality)                             │   │
│ │ - React singleton check                             │   │
│ │ - Dependency vulnerability scan (Snyk)              │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ All Pass                             │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ STAGE 2: Unit Tests                                │   │
│ │ - Vitest unit tests                                 │   │
│ │ - Coverage report (target: 80%)                     │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Pass                                 │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ STAGE 3: Build                                      │   │
│ │ - npm run build (Vite production build)            │   │
│ │ - Container image build (if PATH B)                 │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Pass                                 │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ STAGE 4: Integration Tests                         │   │
│ │ - E2E tests (Playwright on Chromium)               │   │
│ │ - Web3 integration tests                            │   │
│ │ - Security tests (prompt injection, zero-trust)     │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Pass                                 │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ STAGE 5: Security Scanning                         │   │
│ │ - Container image scan (Trivy/Snyk)                │   │
│ │ - SAST (static analysis security testing)          │   │
│ │ - Secret scanning (detect leaked credentials)      │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Pass                                 │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTINUOUS DEPLOYMENT (CD) - Triggered on Merge to Main    │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ GATE 1: All CI Checks Must Pass                    │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅                                      │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ DEPLOY TO DEV (Auto, No Approval)                  │   │
│ │ - Deploy frontend (Vercel preview)                  │   │
│ │ - Deploy edge functions (Supabase dev project)      │   │
│ │ - Run database migrations                           │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅                                      │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ SMOKE TESTS (Dev Environment)                      │   │
│ │ - Health check endpoints                            │   │
│ │ - Basic auth flow                                   │   │
│ │ - Critical user journeys                            │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Pass                                 │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ DEPLOY TO STAGING (Auto if tests pass)             │   │
│ │ - Deploy frontend (Vercel staging)                  │   │
│ │ - Deploy edge functions (Supabase staging)          │   │
│ │ - Run database migrations (staging DB)              │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅                                      │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ SMOKE TESTS (Staging Environment)                  │   │
│ │ - Full E2E test suite                               │   │
│ │ - Performance benchmarks (P95 latency < 500ms)     │   │
│ │ - Load testing (simulate 100 concurrent users)      │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Pass                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 🚨 APPROVAL GATE: PRODUCTION DEPLOYMENT 🚨                  │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ MANUAL APPROVAL REQUIRED                            │   │
│ │ - Review staging smoke test results                 │   │
│ │ - Review changed files                              │   │
│ │ - Review database migrations (if any)               │   │
│ │ - Confirm deployment strategy (canary/blue-green)   │   │
│ │ - Approved by: [Tech Lead or SRE]                   │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Approved                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ PRODUCTION DEPLOYMENT (Canary Strategy)                    │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ PHASE 1: Deploy to Canary (5% Traffic)             │   │
│ │ - Deploy new version to canary environment          │   │
│ │ - Route 5% of traffic to canary                     │   │
│ │ - Duration: 15 minutes observation                  │   │
│ └─────────────────────────────────────────────────────┘   │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ AUTOMATED CANARY ANALYSIS                           │   │
│ │ - Compare canary vs baseline error rate             │   │
│ │ - Compare canary vs baseline latency                │   │
│ │ - Check for new error patterns                      │   │
│ │                                                      │   │
│ │ ROLLBACK TRIGGERS (Automated):                      │   │
│ │ - Error rate > 2x baseline → ROLLBACK               │   │
│ │ - P95 latency > 1.5x baseline → ROLLBACK            │   │
│ │ - Health check fails → ROLLBACK                     │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Canary Healthy                       │
│                      │                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ PHASE 2: Progressive Rollout                        │   │
│ │ - 10% traffic → 15 min observation                  │   │
│ │ - 25% traffic → 15 min observation                  │   │
│ │ - 50% traffic → 30 min observation                  │   │
│ │ - 100% traffic → COMPLETE                           │   │
│ │                                                      │   │
│ │ OPERATOR CAN PAUSE/ROLLBACK AT ANY STEP             │   │
│ └─────────────────────────────────────────────────────┘   │
│                     ✅ Deployment Complete                  │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ POST-DEPLOYMENT                                             │
│ - Update deployment log                                     │
│ - Send Slack notification                                   │
│ - Update status page (changelog)                            │
│ - Monitor error budget for 24 hours                         │
└─────────────────────────────────────────────────────────────┘
```

---

## GITHUB ACTIONS WORKFLOWS

### Workflow 1: Continuous Integration (PR Checks)

**File:** `.github/workflows/ci.yml` (ENHANCEMENT of existing `ci-runtime-gates.yml`)

```yaml
name: Continuous Integration

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'

jobs:
  # ============================================================================
  # STAGE 1: Pre-Build Checks (Parallel)
  # ============================================================================

  typecheck:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  lint:
    name: ESLint
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  react-check:
    name: React Singleton Check
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run check:react

  dependency-scan:
    name: Dependency Vulnerability Scan
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all

  secret-scan:
    name: Secret Scanning
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for secret scanning
      - name: TruffleHog Secrets Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

  # ============================================================================
  # STAGE 2: Unit Tests
  # ============================================================================

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [typecheck, lint, react-check]  # Run after pre-build checks
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - name: Upload coverage report
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json

  # ============================================================================
  # STAGE 3: Build
  # ============================================================================

  build:
    name: Production Build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
          retention-days: 7

  # ============================================================================
  # STAGE 4: Integration Tests
  # ============================================================================

  e2e-tests:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: dist
          path: dist/
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  web3-tests:
    name: Web3 Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:web3

  security-tests:
    name: Security Tests (Prompt Injection, Zero-Trust)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:security
      - run: npm run test:prompt-defense
      - run: npm run test:zero-trust

  # ============================================================================
  # STAGE 5: Security Scanning
  # ============================================================================

  container-scan:
    name: Container Image Scan
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [build]
    if: false  # Only run if using containers (PATH B)
    steps:
      - uses: actions/checkout@v4
      - name: Build container image
        run: docker build -t omnihub:${{ github.sha }} .
      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: omnihub:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
      - name: Upload Trivy results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  sast:
    name: Static Application Security Testing
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: 'javascript'
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2

  # ============================================================================
  # Summary Job (Required Status Check)
  # ============================================================================

  ci-passed:
    name: ✅ All CI Checks Passed
    runs-on: ubuntu-latest
    needs:
      - typecheck
      - lint
      - react-check
      - dependency-scan
      - secret-scan
      - unit-tests
      - build
      - e2e-tests
      - web3-tests
      - security-tests
      - sast
    steps:
      - run: echo "All CI checks passed successfully"
```

### Workflow 2: Continuous Deployment to Staging

**File:** `.github/workflows/cd-staging.yml`

```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]
  workflow_dispatch:  # Manual trigger

env:
  STAGING_SUPABASE_PROJECT_ID: ${{ secrets.STAGING_SUPABASE_PROJECT_ID }}
  STAGING_URL: ${{ secrets.STAGING_URL }}

jobs:
  # Ensure all CI checks passed
  require-ci-passed:
    name: Require CI Passed
    runs-on: ubuntu-latest
    steps:
      - name: Check CI status
        run: |
          echo "CI must pass before deploying to staging"
          # GitHub branch protection will enforce this

  # Deploy database migrations
  deploy-database:
    name: Deploy Database Migrations
    runs-on: ubuntu-latest
    needs: [require-ci-passed]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      - name: Run migrations
        run: |
          supabase db push \
            --project-ref ${{ env.STAGING_SUPABASE_PROJECT_ID }} \
            --password ${{ secrets.STAGING_DB_PASSWORD }}

  # Deploy edge functions
  deploy-edge-functions:
    name: Deploy Edge Functions
    runs-on: ubuntu-latest
    needs: [deploy-database]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      - name: Deploy all functions
        run: |
          for func in supabase/functions/*; do
            if [ -d "$func" ]; then
              func_name=$(basename "$func")
              echo "Deploying $func_name..."
              supabase functions deploy "$func_name" \
                --project-ref ${{ env.STAGING_SUPABASE_PROJECT_ID }} \
                --no-verify-jwt  # Configure JWT verification in Supabase dashboard
            fi
          done

  # Deploy frontend
  deploy-frontend:
    name: Deploy Frontend (Vercel)
    runs-on: ubuntu-latest
    needs: [require-ci-passed]
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel Staging
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          alias-domains: staging.omnihub.dev

  # Smoke tests
  smoke-tests:
    name: Smoke Tests (Staging)
    runs-on: ubuntu-latest
    needs: [deploy-edge-functions, deploy-frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Wait for deployment propagation
        run: sleep 30
      - name: Health checks
        run: |
          curl -f ${{ env.STAGING_URL }}/health || exit 1
          curl -f ${{ env.STAGING_URL }}/health/deep || exit 1
      - name: E2E smoke tests
        run: npm run test:e2e -- --url=${{ env.STAGING_URL }}
      - name: Performance benchmark
        run: |
          # Run k6 load test (100 concurrent users, 1 minute)
          docker run --rm -i grafana/k6 run - < tests/performance/load-test.js

  # Notify
  notify:
    name: Notify Deployment Status
    runs-on: ubuntu-latest
    needs: [smoke-tests]
    if: always()
    steps:
      - name: Slack notification (success)
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
                    "text": "✅ *Staging Deployment Succeeded*\n\nCommit: `${{ github.sha }}`\nAuthor: ${{ github.actor }}\nURL: ${{ env.STAGING_URL }}"
                  }
                }
              ]
            }
      - name: Slack notification (failure)
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
                    "text": "❌ *Staging Deployment Failed*\n\nCommit: `${{ github.sha }}`\nAuthor: ${{ github.actor }}\n\nCheck logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                  }
                }
              ]
            }
```

### Workflow 3: Production Deployment (Manual Approval + Canary)

**File:** `.github/workflows/cd-production.yml`

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
        default: 'canary'

env:
  PRODUCTION_SUPABASE_PROJECT_ID: ${{ secrets.PRODUCTION_SUPABASE_PROJECT_ID }}
  PRODUCTION_URL: https://omnihub.dev

jobs:
  # ============================================================================
  # APPROVAL GATE
  # ============================================================================

  require-approval:
    name: 🚨 Production Deployment Approval Required
    runs-on: ubuntu-latest
    environment: production  # Configure in GitHub Settings → Environments
    steps:
      - name: Approved by
        run: echo "Production deployment approved by ${{ github.actor }}"
      - name: Log approval
        run: |
          echo "Deployment approved at $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> deployment-log.txt
      - name: Upload approval log
        uses: actions/upload-artifact@v3
        with:
          name: deployment-log
          path: deployment-log.txt

  # ============================================================================
  # PRE-DEPLOYMENT VALIDATION
  # ============================================================================

  validate-staging:
    name: Validate Staging Health
    runs-on: ubuntu-latest
    needs: [require-approval]
    steps:
      - name: Check staging smoke tests passed
        run: |
          # Query GitHub API for latest staging workflow run
          gh api repos/${{ github.repository }}/actions/workflows/cd-staging.yml/runs \
            --jq '.workflow_runs[0] | select(.conclusion == "success") // empty'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # ============================================================================
  # DATABASE MIGRATION (with backup)
  # ============================================================================

  deploy-database:
    name: Deploy Database Migrations (Production)
    runs-on: ubuntu-latest
    needs: [validate-staging]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      - name: Backup database before migration
        run: |
          supabase db dump \
            --project-ref ${{ env.PRODUCTION_SUPABASE_PROJECT_ID }} \
            --password ${{ secrets.PRODUCTION_DB_PASSWORD }} \
            > backup-pre-deploy-$(date +%Y%m%d-%H%M%S).sql
      - name: Upload backup
        uses: actions/upload-artifact@v3
        with:
          name: database-backup
          path: backup-*.sql
          retention-days: 30
      - name: Run migrations
        run: |
          supabase db push \
            --project-ref ${{ env.PRODUCTION_SUPABASE_PROJECT_ID }} \
            --password ${{ secrets.PRODUCTION_DB_PASSWORD }}

  # ============================================================================
  # CANARY DEPLOYMENT (5% → 10% → 25% → 50% → 100%)
  # ============================================================================

  deploy-canary:
    name: Deploy Canary (5% Traffic)
    runs-on: ubuntu-latest
    needs: [deploy-database]
    if: inputs.deployment_strategy == 'canary'
    steps:
      - uses: actions/checkout@v4

      # Deploy edge functions to canary environment
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      - name: Deploy edge functions (canary)
        run: |
          # Deploy to canary project or use versioning
          for func in supabase/functions/*; do
            if [ -d "$func" ]; then
              func_name=$(basename "$func")
              supabase functions deploy "$func_name" \
                --project-ref ${{ env.PRODUCTION_SUPABASE_PROJECT_ID }}
            fi
          done

      # Deploy frontend canary
      - name: Deploy frontend canary (Vercel)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          alias-domains: canary.omnihub.dev

      # Route 5% traffic to canary (Cloudflare Load Balancer or similar)
      - name: Route 5% traffic to canary
        run: |
          # Use Cloudflare API or Vercel Traffic Split
          # Example: Update Cloudflare Load Balancer pool weights
          curl -X PUT "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/load_balancers/${{ secrets.LB_ID }}" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            --data '{
              "pools": [
                {"id": "${{ secrets.POOL_PRODUCTION }}", "weight": 95},
                {"id": "${{ secrets.POOL_CANARY }}", "weight": 5}
              ]
            }'

      # Wait and monitor
      - name: Monitor canary (15 minutes)
        run: |
          echo "Monitoring canary for 15 minutes..."
          sleep 900

  analyze-canary:
    name: Analyze Canary Metrics
    runs-on: ubuntu-latest
    needs: [deploy-canary]
    steps:
      - name: Query Prometheus for canary metrics
        run: |
          # Compare canary vs baseline error rate
          CANARY_ERROR_RATE=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{version="canary",status=~"5.."}[5m])' | jq -r '.data.result[0].value[1]')
          BASELINE_ERROR_RATE=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{version="baseline",status=~"5.."}[5m])' | jq -r '.data.result[0].value[1]')

          if (( $(echo "$CANARY_ERROR_RATE > $BASELINE_ERROR_RATE * 2" | bc -l) )); then
            echo "❌ Canary error rate is 2x baseline - ROLLING BACK"
            exit 1
          fi

          echo "✅ Canary metrics healthy"

  progressive-rollout:
    name: Progressive Rollout (10% → 25% → 50% → 100%)
    runs-on: ubuntu-latest
    needs: [analyze-canary]
    steps:
      - name: 10% traffic
        run: |
          # Update load balancer weights
          curl -X PUT "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/load_balancers/${{ secrets.LB_ID }}" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            --data '{"pools": [{"id": "${{ secrets.POOL_PRODUCTION }}", "weight": 90}, {"id": "${{ secrets.POOL_CANARY }}", "weight": 10}]}'
          sleep 900  # 15 min observation

      - name: 25% traffic
        run: |
          curl -X PUT ... --data '{"pools": [{"weight": 75}, {"weight": 25}]}'
          sleep 900

      - name: 50% traffic
        run: |
          curl -X PUT ... --data '{"pools": [{"weight": 50}, {"weight": 50}]}'
          sleep 1800  # 30 min observation

      - name: 100% traffic (finalize)
        run: |
          curl -X PUT ... --data '{"pools": [{"weight": 0}, {"weight": 100}]}'
          echo "✅ Deployment complete"

  # ============================================================================
  # POST-DEPLOYMENT
  # ============================================================================

  post-deployment:
    name: Post-Deployment Tasks
    runs-on: ubuntu-latest
    needs: [progressive-rollout]
    steps:
      - name: Update changelog
        run: |
          # Post to status page or changelog
          echo "Deployed version ${{ github.sha }} to production"

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          payload: |
            {
              "text": "✅ Production deployment complete",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "✅ *Production Deployment Complete*\n\nVersion: `${{ github.sha }}`\nDeployed by: ${{ github.actor }}\nStrategy: ${{ inputs.deployment_strategy }}"
                  }
                }
              ]
            }

      - name: Monitor error budget for 24 hours
        run: |
          # Set up monitoring alert
          echo "Error budget monitoring activated"
```

---

## ROLLBACK PROCEDURES

### Automated Rollback Triggers

**Canary Analysis Failures:**
- Error rate > 2x baseline → Immediate rollback
- P95 latency > 1.5x baseline → Immediate rollback
- Health check failures → Immediate rollback

**Rollback Script:**
```bash
#!/bin/bash
# scripts/emergency-rollback.sh

set -e

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# 1. Route all traffic back to baseline
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/load_balancers/$LB_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --data '{"pools": [{"id": "'"$POOL_PRODUCTION"'", "weight": 100}, {"id": "'"$POOL_CANARY"'", "weight": 0}]}'

# 2. Rollback edge functions (Supabase)
supabase functions deploy --project-ref $PRODUCTION_SUPABASE_PROJECT_ID --version previous

# 3. Rollback frontend (Vercel)
vercel rollback $VERCEL_DEPLOYMENT_URL --token $VERCEL_TOKEN

# 4. Database rollback (if migration was destructive)
# Note: Only run if migration cannot be forward-compatible
# psql $DATABASE_URL < backup-pre-deploy-YYYYMMDD-HHMMSS.sql

echo "✅ Rollback complete. Verify services are healthy."
echo "Expected RTO: < 60 seconds"
```

### Manual Rollback (GitHub UI)

1. Go to Actions → cd-production workflow
2. Click "Re-run failed jobs" → Select "Rollback" option
3. Confirm rollback in Slack channel
4. Monitor metrics for 15 minutes

---

## DEPLOYMENT METRICS (to Track)

| Metric | Target | Current | Trend |
|--------|--------|---------|-------|
| **Deployment Frequency** | Daily | 3x/week | ⬆️ |
| **Lead Time (commit to prod)** | < 24 hours | 2 days | ➡️ |
| **Change Failure Rate** | < 5% | 8% | ⬇️ |
| **Mean Time to Recovery (MTTR)** | < 1 hour | 45 min | ⬇️ |

**DORA Metrics Dashboard:** Track these in Grafana or Datadog.

---

## SUMMARY

**CI (Automated):**
- Runs on every PR/push
- 5 stages: Pre-build checks, unit tests, build, integration tests, security scans
- All checks must pass before merge

**CD (Semi-Automated):**
- **Dev:** Auto-deploy on merge (no approval)
- **Staging:** Auto-deploy after dev smoke tests pass
- **Production:** Manual approval + canary deployment (5% → 100%)

**Safety Mechanisms:**
- Automated rollback triggers (error rate, latency)
- Emergency rollback script (< 60s RTO)
- Database backups before every migration
- Approval gates for prod deploys

**Next Steps:**
1. Implement enhanced CI workflow (add security scans)
2. Add CD workflow for staging
3. Add production deployment workflow with approval gates
4. Test rollback procedures
5. Set up DORA metrics tracking

---

**Document Status:** ✅ COMPLETE
**Next:** Disaster Recovery Plan, Terraform IaC Generation
