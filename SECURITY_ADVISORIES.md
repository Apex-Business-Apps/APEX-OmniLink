# Security Advisories

**Last Updated**: 2026-01-15
**Audit Reference**: [PLATFORM_AUDIT_2026_01_10.md](docs/audits/PLATFORM_AUDIT_2026_01_10.md)

---

## Recently Resolved Vulnerabilities

### RESOLVED: h3 Request Smuggling (GHSA-mp2g-9vg9-f4cg)
- **Status**: FIXED (2026-01-15)
- **Package**: `h3@1.15.4` → `h3@1.15.5`
- **Severity**: High
- **Description**: Request Smuggling (TE.TE) issue in h3 v1
- **Resolution**: Updated via `npm audit fix`
- **PR**: #202 - Pixel-perfect landing page with new sections and navigation

### RESOLVED: Hono JWT Algorithm Confusion (GHSA-3vhc-576x-3qv4, GHSA-f67f-6cw9-8mq4)
- **Status**: FIXED (2026-01-15)
- **Package**: `hono@4.11.3` → `hono@4.11.4`
- **Severity**: High
- **Description**: JWK Auth Middleware JWT algorithm confusion allowing token forgery and auth bypass
- **Resolution**: Updated via `npm audit fix`
- **PR**: #202 - Pixel-perfect landing page with new sections and navigation

---

## Active Vulnerabilities

### CRITICAL: React Router XSS (CVE GHSA-2w69-qvjg-hvjx)
- **Status**: OPEN - IMMEDIATE ACTION REQUIRED
- **Package**: `react-router-dom@6.30.2`
- **CVSS**: 8.0 (High)
- **Fix**: Run `npm audit fix` to update to 6.30.3+
- **Tracking**: R1 in [REMEDIATION_TRACKER.md](docs/audits/REMEDIATION_TRACKER.md)

### CRITICAL: Wildcard CORS Configuration
- **Status**: OPEN
- **Affected**: 5 Supabase Edge Functions
- **Risk**: API credit exhaustion, data exfiltration
- **Tracking**: R2 in Remediation Tracker

### CRITICAL: Non-Distributed Rate Limiting
- **Status**: OPEN
- **Affected**: web3-verify, web3-nonce, storage-upload-url
- **Risk**: Complete rate limit bypass on serverless cold starts
- **Tracking**: R3 in Remediation Tracker

### CRITICAL: SQL Injection Risk (Python)
- **Status**: OPEN
- **Affected**: `orchestrator/providers/database/supabase_provider.py`
- **Risk**: Database compromise
- **Tracking**: R4 in Remediation Tracker

### CRITICAL: Unencrypted Terraform State
- **Status**: OPEN
- **Affected**: `terraform/environments/staging/main.tf`
- **Risk**: Secrets exposure in plaintext state files
- **Tracking**: R5 in Remediation Tracker

---

## High Severity Issues

| Issue | Status | Tracking |
|-------|--------|----------|
| Missing request size limits | OPEN | R16 |
| Path traversal in uploads | OPEN | - |
| Email-based admin allowlist | OPEN | - |
| OpenAI API key rotation | OPEN | - |
| Insufficient voice input validation | OPEN | - |
| Error messages leak details | OPEN | - |
| Missing auth on nonce generation | OPEN | - |
| Webhook signature timeout | OPEN | - |

---

## Current Audit Snapshot
- `npm run security:audit` generates `security/npm-audit-latest.json`.
- Latest review (2026-01-15): **0 vulnerabilities** - All transitive dependency issues resolved
- Previously resolved: h3 Request Smuggling, Hono JWT Algorithm Confusion (2 HIGH)
- Previous: 7 dev-only vulnerabilities (esbuild/dev-server toolchain)

## How to Re-run
```bash
npm run security:audit
```
The script writes fresh JSON output and never fails the build so that audit data is always captured.

## Policy: Dev vs Prod Vulnerabilities
- **Production dependencies**: Must be triaged and patched or explicitly risk-accepted with an owner and due date.
- **Dev-only dependencies**: Documented in the advisory with rationale. Patch on the next toolchain upgrade cycle unless an exploit is known to be weaponized.
- Always capture evidence in the audit JSON and link issues to the advisory when filing tickets.

---

## Security Strengths (Documented)

- SIWE implementation is comprehensive
- Row Level Security policies on all sensitive tables
- Timing-safe signature verification
- Active secret scanning (TruffleHog, Gitleaks)
- Fail-closed security design

