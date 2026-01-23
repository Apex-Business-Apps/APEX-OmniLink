-- Secure MAN Tasks Table Migration
-- Priority 1: Enable RLS and set up proper policies for man_tasks table

-- Enable Row Level Security on man_tasks table
ALTER TABLE man_tasks ENABLE ROW LEVEL SECURITY;

-- Service Role Policy: Allow service_role to perform ALL operations
-- This is required for backend operations and admin functions
CREATE POLICY "service_role_full_access" ON man_tasks
FOR ALL USING (true)
WITH CHECK (true);

-- Read Policy: Allow authenticated users to SELECT only PENDING tasks
-- This provides transparency for users to see tasks awaiting approval
CREATE POLICY "authenticated_read_pending_tasks" ON man_tasks
FOR SELECT USING (
  auth.role() = 'authenticated' AND
  status = 'PENDING'
);

-- Admin Policy: Allow UPDATE operations only for admin users
-- Uses auth.jwt() to check app_metadata.role or user metadata for admin rights
CREATE POLICY "admin_update_man_tasks" ON man_tasks
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

-- Admin Policy: Allow INSERT operations for admin users (for creating new tasks)
CREATE POLICY "admin_insert_man_tasks" ON man_tasks
FOR INSERT WITH CHECK (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Admin Policy: Allow DELETE operations for admin users
CREATE POLICY "admin_delete_man_tasks" ON man_tasks
FOR DELETE USING (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);