# Sonar Duplication Map

| File | Duplicated block | Extraction target |
| --- | --- | --- |
| `sim/tests/guard-rails.test.ts` | Repeated guard rail config setup | `sim/tests/_helpers/guardRails.ts` |
| `apps/omnihub-site/src/content/site.ts` | Repeated section object literals | `buildTechSpecSection` helper |
| `supabase/functions/web3-nonce/index.ts` | Origin validation, wallet validation, rate limiting | `supabase/functions/_shared/cors.ts`, `validation.ts`, `ratelimit.ts` |
| `supabase/functions/web3-verify/index.ts` | Origin validation, wallet validation, rate limiting | `supabase/functions/_shared/cors.ts`, `validation.ts`, `ratelimit.ts` |
| `supabase/functions/verify-nft/index.ts` | Rate limiting and headers | `supabase/functions/_shared/ratelimit.ts` |
| `supabase/functions/lovable-audit/index.ts` | Supabase client instantiation | `supabase/functions/_shared/supabaseClient.ts` |
| `supabase/functions/lovable-device/index.ts` | Supabase client instantiation | `supabase/functions/_shared/supabaseClient.ts` |
| `supabase/functions/test-integration/index.ts` | Supabase client instantiation | `supabase/functions/_shared/supabaseClient.ts` |
| `supabase/functions/storage-upload-url/index.ts` | Supabase client instantiation | `supabase/functions/_shared/supabaseClient.ts` |
| `supabase/functions/execute-automation/index.ts` | Supabase client instantiation | `supabase/functions/_shared/supabaseClient.ts` |
| `supabase/functions/apex-assistant/index.ts` | Unused duplicated rate limit import | Removed unused import |
| `supabase/migrations/20251221000000_omnilink_agentic_rag.sql` | Repeated service role policies | DO-loop policy creation in migration |
| `supabase/migrations/20251221000001_omnilink_ops_pack.sql` | Repeated service role policies | DO-loop policy creation in migration |
| `src/lib/storage/providers/supabase.ts` | Supabase client creation | `src/lib/supabase/client.ts` |
| `src/lib/database/providers/supabase.ts` | Supabase client creation | `src/lib/supabase/client.ts` |
