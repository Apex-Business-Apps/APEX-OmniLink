# OMNiLiNK MANIFESTO (LITE)

## 1. Purpose

OMNiLiNK is the **integration bus** for the APEX ecosystem.  
This app has a **single, optional OMNiLiNK port** so it can publish/consume events without being hard‑coupled.

This document explains **why** the port exists and **how** to use it safely.

## 2. Principles

1. **Optional by default**  
   The app must run correctly with OMNiLiNK off or unreachable.

2. **Single integration port**  
   All OMNiLiNK logic lives behind one adapter/client module instead of being scattered.

3. **No secrets in code**  
   All keys/URLs live in env/config, never in the repo.

4. **Observable**  
   There is a healthcheck (endpoint or CLI) to see if OMNiLiNK is disabled/ok/error.

5. **Reversible**  
   Turning OMNiLiNK off is as simple as flipping an env flag and redeploying.

## 3. This App’s OMNiLiNK Port

_Fill per app when you drop this file in._

- **APP_NAME:** {{APP_NAME}}  
- **Primary role:** {{one‑liner about app’s domain}}  
- **OMNiLiNK role:**  
  - Publishes: {{e.g. call events, bookings, alerts}}  
  - Consumes: {{e.g. customer status, global settings}}

- **Port location:** `{{e.g. src/integrations/omnlink/}}`  
- **Main entry:** `{{e.g. OmniLinkAdapter.ts}}`  
- **Key methods:** `isEnabled()`, `sendEvent(...)`, `syncOnce()` (if used)

## 4. How to Enable OMNiLiNK (For Admins)

1. **Get OMNiLiNK details** from your APEX / OMNiLiNK account.  
2. **Set env vars** (names may vary per app):
   - `OMNILINK_ENABLED=true`
   - `OMNILINK_BASE_URL=...`
   - `OMNILINK_TENANT_ID=...`
   - Any extra keys documented in `docs/OMNILINK_ENABLEMENT_GUIDE.md`.

3. **Deploy / restart** the app.  
4. **Run the healthcheck**:
   - CLI: `{{e.g. npm run omnlink:health}}`  
   - or HTTP: `{{e.g. https://your-app.com/health/omnlink}}`

5. Confirm the healthcheck reports OMNiLiNK as **enabled/ok**.

If something is wrong, set `OMNILINK_ENABLED=false`, redeploy, and the app will behave as before.

## 5. Safety & Rollback

- When OMNiLiNK is **disabled**, the port should no‑op and not affect core features.  
- When **enabled but misconfigured**, the app should still boot; only the healthcheck and logs should show errors.  
- To fully disable OMNiLiNK:
  1. Set `OMNILINK_ENABLED=false` (or remove OMNiLiNK env vars).  
  2. Redeploy / restart.  
  3. Confirm healthcheck reports “disabled (OK)”.

## 6. Engineer Reference

- **Adapter module:** `{{path}}`  
- **Types:** `{{path}}`  
- **Tests:** `{{path(s)}}`  
- **Healthcheck:** `{{endpoint or CLI command}}`  

Keep this section in sync when you update the OMNiLiNK port.
