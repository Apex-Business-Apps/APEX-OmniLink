-- REPLACEMENT MIGRATION: Dynamic Admin Seeding
-- Removes dependency on hardcoded user emails/IDs.
-- Usage: Grants admin based on a secure claim injected during auth.

create or replace function public.claim_admin_role()
returns void
language plpgsql
security definer
as $$
declare
  user_is_admin boolean;
begin
  -- Check for custom claim in JWT
  user_is_admin := (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean;

  if user_is_admin = true then
    insert into public.user_roles (user_id, role)
    values (auth.uid(), 'admin')
    on conflict (user_id, role) do nothing;
  else
    raise exception 'Access Denied: Insufficient Privileges';
  end if;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.claim_admin_role() to authenticated;

comment on function public.claim_admin_role() is 
'Dynamic admin role assignment based on app_metadata.is_admin claim. No hardcoded emails or UUIDs in the schema.';
