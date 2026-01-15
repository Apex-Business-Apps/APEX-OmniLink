# OmniLink Universal Integration Plane — Recon Report

## What exists today
- **Supabase integrations table** already tracks per-user integrations (`public.integrations`).
- **Supabase Edge function helpers** are available under `supabase/functions/_shared/` (CORS, validation, rate limiting, emergency controls, etc.).
- **OmniDash foundation** is implemented in the React app (`src/pages/OmniDash/*`) with admin-only RLS policies for existing tables.
- **Temporal orchestrator** exists in `orchestrator/` with workflow models and a Supabase provider allowlist, but no OmniLink-specific queue ingestion yet.

## What is added/changed
- **Universal OmniLink data model** (new migration) adds:
  - `omnilink_api_keys` (hash-only keys, prefix lookup, scopes JSONB)
  - `omnilink_events` (append-only, idempotent)
  - `omnilink_entities` (projection)
  - `omnilink_orchestration_requests` (commands + workflow run requests)
  - `omnilink_runs` + `omnilink_run_steps` (run status projection)
  - `omnilink_rate_limits` (atomic rate limiting buckets)
  - RPCs: `omnilink_ingest`, `omnilink_revoke_key`, `omnilink_set_approval`
- **Single OmniLink port** (new Edge Function `omnilink-port`) with:
  - health endpoint
  - key minting (admin-only)
  - event/command/workflow ingest using CloudEvents-style envelopes
  - idempotency + overload protection
- **OmniDash UI** adds demo-ready integrations, events, entities, runs, and approvals pages.
- **Sonar duplication reductions** via shared helpers and extracted test utilities.

## Why it is safe and minimal
- Reuses the existing `integrations` table rather than duplicating integration metadata.
- Uses existing Supabase Edge helper patterns and introduces only targeted shared helpers.
- All writes for events/commands/runs are restricted to service role or security-definer RPCs.
- No third-party vendors or services introduced.

## Universal compatibility
- Uses dependency-free, CloudEvents-inspired envelopes for events, commands, and workflow runs.
- Scopes and constraints are stored as JSONB allowlists so any app can integrate without app-specific assumptions.
- OmniDash uses tenant-scoped queries and shows data as a universal feed (events/entities/runs).

## Rollback strategy
- Revert migration `20260111000000_omnilink_universal_port.sql`.
- Remove `supabase/functions/omnilink-port` and related UI pages if needed.
- Remove OmniLink-specific UI routes and API helpers.
