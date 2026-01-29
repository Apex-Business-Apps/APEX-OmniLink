-- HARDENING: Revoke PUBLIC execute permissions from all critical functions
-- Directives:
-- 1. REVOKE ALL ON FUNCTION ... FROM PUBLIC
-- 2. GRANT EXECUTE ON FUNCTION ... TO service_role
-- 3. GRANT EXECUTE ON FUNCTION ... TO authenticated (Only if strictly required)

BEGIN;

-- 1. Admin & Security
REVOKE ALL ON FUNCTION public.claim_admin_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_admin_role() TO authenticated; -- Required for user self-promotion check

-- 2. MAN Mode & Governance
-- Functions not yet implemented as SQL functions (logic in Edge Functions or app layer)

-- 3. Audit Logging
-- Functions not yet implemented or handle internal inserts

-- 4. Device Registry
-- Functions not yet implemented

-- 5. Data Access
-- Revoke any generic helper functions if they exist here
-- (None identified as strictly critical beyond RLS, but safe measure)

COMMIT;
