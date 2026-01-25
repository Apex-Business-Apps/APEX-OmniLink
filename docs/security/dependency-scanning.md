# Dependency Scanning

## Pipeline
- `.github/workflows/security-scan.yml` is the expected dependency scanning workflow for this project. It should run `npm audit` and any additional SCA steps as part of CI.
- Results surface in GitHub Actions summaries and the generated artifacts.

## What It Runs
- Node security advisories via `npm audit`.
- Room to add SCA for frontend bundles if desired (e.g., `pnpm dlx snyk test`).

## How to Review Results
- Check the GitHub Actions run for `security-scan` for JSON outputs.
- For local validation, run `npm run security:audit` to produce `security/npm-audit-latest.json`.

## Policy Link
- See `SECURITY_ADVISORIES.md` for dev-vs-prod vulnerability handling and risk acceptance guidance.

