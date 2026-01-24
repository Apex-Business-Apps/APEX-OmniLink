-- Secure MAN Tasks Table Migration
-- Priority 1: Enable RLS and set up proper policies for man_tasks table

-- Reset existing policies to avoid duplication on re-run
DROP POLICY IF EXISTS "service_role_full_access" ON public.man_tasks;
DROP POLICY IF EXISTS "authenticated_read_pending_tasks" ON public.man_tasks;
DROP POLICY IF EXISTS "admin_update_man_tasks" ON public.man_tasks;
DROP POLICY IF EXISTS "admin_insert_man_tasks" ON public.man_tasks;
DROP POLICY IF EXISTS "admin_delete_man_tasks" ON public.man_tasks;

-- Enable Row Level Security on man_tasks table
ALTER TABLE public.man_tasks ENABLE ROW LEVEL SECURITY;

-- Service Role Policy: Allow service_role to perform ALL operations
CREATE POLICY "service_role_full_access" ON public.man_tasks
FOR ALL USING (true)
WITH CHECK (true);

-- Read Policy: Allow authenticated users to SELECT only PENDING tasks
CREATE POLICY "authenticated_read_pending_tasks" ON public.man_tasks
FOR SELECT USING (
  auth.role() = 'authenticated' AND
  status = 'PENDING'
);

-- Admin Policy: Allow UPDATE operations only for admin users
CREATE POLICY "admin_update_man_tasks" ON public.man_tasks
FOR UPDATE USING (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Admin Policy: Allow INSERT operations for admin users
CREATE POLICY "admin_insert_man_tasks" ON public.man_tasks
FOR INSERT WITH CHECK (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Admin Policy: Allow DELETE operations for admin users
CREATE POLICY "admin_delete_man_tasks" ON public.man_tasks
FOR DELETE USING (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
