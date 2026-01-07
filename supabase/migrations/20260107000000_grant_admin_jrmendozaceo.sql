-- Grant admin role to jrmendozaceo@apexbusiness-systems.com
-- This migration ensures the user has full admin access in OmniHub

-- =============================================================================
-- 1. Grant admin role if user already exists
-- =============================================================================
-- Insert admin role for the user (if they exist in auth.users)
-- Uses ON CONFLICT to prevent duplicate entries
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'jrmendozaceo@apexbusiness-systems.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also ensure they have the base 'user' role (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::public.app_role
FROM auth.users
WHERE email = 'jrmendozaceo@apexbusiness-systems.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- =============================================================================
-- 2. Update handle_new_user() to auto-grant admin for designated emails
-- =============================================================================
-- This ensures CEO/founder emails automatically receive admin role upon signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  admin_emails text[] := ARRAY[
    'jrmendozaceo@apexbusiness-systems.com'
  ];
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id) VALUES (new.id);

  -- Grant base 'user' role to all new users
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');

  -- Auto-grant 'admin' role to designated admin emails
  IF new.email = ANY(admin_emails) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- =============================================================================
-- 3. Log administrative action
-- =============================================================================
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'jrmendozaceo@apexbusiness-systems.com';

  IF target_user_id IS NOT NULL THEN
    RAISE NOTICE 'Admin role granted to user: jrmendozaceo@apexbusiness-systems.com (id: %)', target_user_id;
  ELSE
    RAISE NOTICE 'User jrmendozaceo@apexbusiness-systems.com not found yet - admin role will be auto-granted upon registration';
  END IF;
END $$;
