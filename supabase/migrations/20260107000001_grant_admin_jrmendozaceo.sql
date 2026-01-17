-- Grant admin role to jrmendozaceo@apexbusiness-systems.com
-- This migration ensures the user has full admin access in OmniHub

-- =============================================================================
-- 1. Grant admin role if user already exists + audit notice
-- =============================================================================
DO $$
DECLARE
  target_email text := 'jrmendozaceo@apexbusiness-systems.com';
  target_user_id uuid;
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'::public.app_role
  FROM auth.users
  WHERE email = target_email
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Also ensure they have the base 'user' role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'user'::public.app_role
  FROM auth.users
  WHERE email = target_email
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;

  IF target_user_id IS NOT NULL THEN
    RAISE NOTICE 'Admin role granted to user: % (id: %)', target_email, target_user_id;
  ELSE
    RAISE NOTICE 'User % not found yet - admin role will be auto-granted upon registration', target_email;
  END IF;
END $$;

-- (Function definition skipped to avoid conflict with remediation migration 20260110)
