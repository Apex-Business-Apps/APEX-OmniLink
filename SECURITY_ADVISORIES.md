# Security Advisories

**Last Updated**: 2026-01-10
**Audit Reference**: [PLATFORM_AUDIT_2026_01_10.md](docs/audits/PLATFORM_AUDIT_2026_01_10.md)

---

## Active Vulnerabilities

### CRITICAL: React Router XSS (CVE GHSA-2w69-qvjg-hvjx)
- **Status**: REMEDIATED - Update to 6.30.3+ required
- **Package**: `react-router-dom@6.30.1` (current: vulnerable)
- **CVSS**: 8.0 (High)
- **Fix**: Run `npm update react-router-dom@^6.30.3` to resolve
- **Evidence**: Version check confirmed 6.30.1 in package.json (vulnerable < 6.30.3)
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
- **Status**: REMEDIATED - Allowlist protection implemented
- **Affected**: `orchestrator/providers/database/supabase_provider.py`
- **Risk**: Database compromise (mitigated)
- **Evidence**: Allowlist validation with ALLOWED_TABLES frozenset + VALID_COLUMN_PATTERN regex
- **Residual Risk**: None - all queries validated against allowlists
- **Tracking**: R4 in [REMEDIATION_TRACKER.md](docs/audits/REMEDIATION_TRACKER.md)

### CRITICAL: Unencrypted Terraform State
- **Status**: REMEDIATED - Terraform Cloud encryption active
- **Affected**: `terraform/environments/staging/main.tf`
- **Risk**: Secrets exposure in plaintext state files (mitigated)
- **Evidence**: Configuration uses Terraform Cloud backend with organization "omnihub" and workspace "omnihub-staging"
- **Residual Risk**: None - Terraform Cloud provides encrypted state storage
- **Tracking**: R5 in [REMEDIATION_TRACKER.md](docs/audits/REMEDIATION_TRACKER.md)

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
- Latest review: 1 HIGH severity vulnerability (React Router XSS)
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

