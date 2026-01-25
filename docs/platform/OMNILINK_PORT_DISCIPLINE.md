# OmniLink Port Discipline (Universal, Optional-by-Default)

## Purpose
OmniLink integrations must route through a **single port module** to avoid scattered side effects and vendor lock-in.
This repo’s port surface lives at:
- `src/integrations/omnilink/port.ts` (adapter + guardrails)
- `src/integrations/omnilink/index.ts` (public exports)

## Guardrails
- **Optional-by-default:** OmniLink is disabled unless `VITE_OMNILINK_ENABLED` or `OMNILINK_ENABLED` is true.
- **Single integration port:** All OmniLink requests must go through `requestOmniLink(...)`.
- **Resilient by default:** retries with jitter, timeouts, and circuit breaker are enforced in the port.
- **Idempotency:** callers must supply or accept port-generated `X-Idempotency-Key`.
- **Audit trail:** port emits audit events when running in the browser.

## Provider neutrality (no lock-in)
The adapter contract is provider-agnostic (`OmniLinkAdapter`), with:
- `HttpOmniLinkAdapter` (default HTTP transport)
- `NoopOmniLinkAdapter` (disabled stub)

For a portability matrix and DR guidance, see `docs/OMNILINK_ARCHITECTURE_OUTPUT.md`.

### Migration plan (if changing providers)
1. Implement a new adapter that matches `OmniLinkAdapter`.
2. Inject it via `setOmniLinkAdapter(...)` in your bootstrapping code.
3. Keep `HttpOmniLinkAdapter` available as a fallback.
4. Run `npm test` and `npm run omnilink:health` before switching.

## Environment flags
| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_OMNILINK_ENABLED` / `OMNILINK_ENABLED` | Enable OmniLink port | `false` |
| `VITE_OMNILINK_BASE_URL` / `OMNILINK_BASE_URL` | OmniLink API base URL | `''` |
| `VITE_OMNILINK_HEALTH_PATH` / `OMNILINK_HEALTH_PATH` | Health check path | `/health` |

## Health check
- UI check: `/health` page includes OmniLink status.
- CLI check: `npm run omnilink:health`

## Rollback (1–2 minutes)
1. Set `VITE_OMNILINK_ENABLED=false` (or unset it).
2. Redeploy or reload the environment.
3. Verify `/health` shows OmniLink as **disabled**.
