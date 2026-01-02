# Evidence-Required Developer Checklist

Use this checklist before claiming a change is complete.

## Required evidence (no exceptions)
- **Files inspected:** list exact paths and relevant snippets.
- **Commands run:** include the exact command and the outcome.
- **Unknowns:** explicitly call out anything not verified yet.

## Suggested format
- `File:` `path/to/file.ts` — include the exact lines or key excerpt.
- `Command:` `npm test` — include output or failure summary.
- `Unknown:` `Supabase schema in prod` — list verification command needed.

## Examples
- `File:` `src/integrations/omnilink/port.ts` — idempotency key handling.
- `Command:` `npm run typecheck` — ✅ success.
- `Unknown:` `OmniLink /health endpoint exists` — run `curl $OMNILINK_BASE_URL/health`.
