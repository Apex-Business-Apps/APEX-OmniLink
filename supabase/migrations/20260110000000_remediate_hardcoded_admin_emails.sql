-- =============================================================================
-- SECURITY REMEDIATION: Remove Hardcoded Admin Emails
-- =============================================================================
-- This migration removes the hardcoded admin email array from handle_new_user()
-- and replaces it with a dynamic lookup from app_settings table.
--
-- CVE Remediation: Hardcoded credentials in source control
-- =============================================================================

-- 1. Create app_settings table if not exists (for storing admin emails securely)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write app_settings (no client access)
CREATE POLICY IF NOT EXISTS "Service role only" ON public.app_settings
  FOR ALL USING (false);

-- 2. Migrate existing hardcoded admin emails to app_settings
-- TODO: After deployment, add admin emails via Supabase dashboard or service role
INSERT INTO public.app_settings (key, value)
VALUES ('admin_emails', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Replace handle_new_user() with secure version (no hardcoded emails)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  admin_emails_json jsonb;
  admin_emails text[];
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id) VALUES (new.id);

  -- Grant base 'user' role to all new users
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');

  -- Dynamically load admin emails from app_settings (not hardcoded)
  SELECT value INTO admin_emails_json
  FROM public.app_settings
  WHERE key = 'admin_emails';

  -- Convert JSON array to text array
  IF admin_emails_json IS NOT NULL THEN
    SELECT array_agg(elem::text) INTO admin_emails
    FROM jsonb_array_elements_text(admin_emails_json) AS elem;

    -- Auto-grant 'admin' role if email is in admin list
    IF admin_emails IS NOT NULL AND new.email = ANY(admin_emails) THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (new.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- =============================================================================
-- IMPORTANT: After applying this migration, add admin emails via:
--
--   UPDATE public.app_settings
--   SET value = '["admin@example.com", "ceo@company.com"]'::jsonb
--   WHERE key = 'admin_emails';
--
-- This removes hardcoded credentials from version control.
-- =============================================================================

COMMENT ON FUNCTION public.handle_new_user() IS
  'SECURITY: Admin emails now loaded from app_settings table, not hardcoded. See migration 20260110000000.';
