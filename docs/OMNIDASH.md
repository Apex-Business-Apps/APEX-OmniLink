# OmniDash (Founder/Sales Dashboard)

## Setup
- Ensure Supabase env vars are configured (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Apply migrations: `supabase db push` (or deploy via your CI pipeline).
- Set feature flag to enable internally: `OMNIDASH_ENABLED=1` (or `VITE_OMNIDASH_ENABLED=1`). Keep it OFF by default.
- Optionally allow specific admins via `VITE_OMNIDASH_ADMIN_EMAILS=admin@example.com,founder@example.com`.

## Enabling
- Turn on `OMNIDASH_ENABLED` only for internal admins until stability is confirmed. Access is additionally role-gated to `admin` (or allowlist fallback).

## Acceptance Criteria (v1)
- With `OMNIDASH_ENABLED=1` and admin user:
  - `/omnidash`, `/omnidash/pipeline`, `/omnidash/kpis`, `/omnidash/ops` load without errors.
  - Demo Mode redacts names/PII and buckets $ values.
  - Pipeline enforces Next touch unless stage = Lost; “Next touch due” list shows overdue items.
  - KPI table supports add/edit for today; values render on the table.
  - Pages show health timestamp and load quickly (<2s on typical connection).
- With `OMNIDASH_ENABLED=0`: OmniDash routes are inaccessible (404/redirect) without impacting other routes.

## Testing
- Unit: `vitest run tests/omnidash/redaction.spec.ts`.
- Smoke: `vitest run tests/omnidash/route.spec.tsx`.
- Lint/typecheck/build: `npm run lint && npm run build`.

## Manual QA (10-minute checklist)
- Enable flag (`OMNIDASH_ENABLED=1`), login as admin.
- Visit `/omnidash`:
  - Add 3 items, trigger Next Action button, start/stop Power Block, press Restart Ritual (list reduces to 3).
- `/omnidash/pipeline`: create deal with stage ≠ Lost without Next touch (should error), then with date (should save). Verify Next touch due card shows when date is today/past.
- Toggle Demo Mode ON: names redacted, amounts bucketed, PII removed in notes.
- `/omnidash/kpis`: update today’s values, see table reflect numbers (or buckets when demo).
- `/omnidash/ops`: log Sev-1 incident; verify freeze switch note reflects setting.
- Turn flag OFF, confirm `/omnidash` is inaccessible while other routes still work.

## Rollback
- Set `OMNIDASH_ENABLED=0` and redeploy.

