# Adaptive Nightly Agent Evaluation

## Overview
The nightly evaluation workflow now performs a cheap “system used?” check before installing dependencies or running evaluations. If no recent activity is detected, the job parks cleanly and still publishes a stable `evaluation_results.json` and `evaluation_report.md`.

## Usage signal
- **Primary table:** `public.agent_runs`
- **Timestamp column:** `created_at`
- **Default lookback:** 24 hours (configurable)

The check uses the Supabase REST API with `Prefer: count=exact` and a `created_at` filter to determine if there was activity in the lookback window.

## Park conditions
The evaluation is skipped (parked) when:
- Required Supabase secrets are missing (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- Supabase is unreachable or returns a non-2xx response.
- The usage table is missing (and no healthcheck fallback is configured).
- Activity count is 0 for the lookback window.

When parked, the workflow:
- Skips `npm ci` and evaluation runner steps.
- Generates stable artifacts with `results: []`.
- Exits successfully.

## Artifacts
The workflow always uploads:
- `evaluation_results.json`
- `evaluation_report.md`

## Force-run (manual override)
Use `workflow_dispatch` inputs:
- `force_run: true` to bypass the usage check and run evaluation.
- `lookback_hours: <number>` to adjust the activity lookback window.

## Troubleshooting
- **Missing secrets:** ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- **Table not found:** verify the `agent_runs` table exists and migrations are applied.
- **Unreachable:** confirm Supabase is accessible from GitHub Actions.

## Rollback
1. Revert the commit that introduced adaptive evaluation.
2. Remove `.github/scripts/check_system_usage.sh`.
3. Restore `.github/workflows/nightly-evaluation.yml` to the previous behavior.
