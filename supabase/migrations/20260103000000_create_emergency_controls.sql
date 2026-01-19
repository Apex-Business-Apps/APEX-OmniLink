-- ============================================================================
-- EMERGENCY CONTROLS SYSTEM
-- ============================================================================
-- Purpose: Operator supremacy controls for OmniHub platform
--
-- Features:
-- 1. OMNIHUB_KILL_SWITCH: Disable all OmniHub operations globally
-- 2. EXECUTION_SAFE_MODE: Advisory-only mode (no side effects)
-- 3. OPERATOR_TAKEOVER: Require manual approval for all operations
-- 4. ALLOWED_OPERATIONS: Whitelist of permitted operations (when OPERATOR_TAKEOVER enabled)
--
-- Security: Admin-only access via RLS policies
-- Audit: All changes logged to audit_logs table
-- ============================================================================

-- Create emergency_controls table
CREATE TABLE IF NOT EXISTS public.emergency_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Emergency control flags
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  safe_mode BOOLEAN NOT NULL DEFAULT false,
  operator_takeover BOOLEAN NOT NULL DEFAULT false,

  -- Allowed operations (when operator_takeover is true)
  allowed_operations TEXT[] NOT NULL DEFAULT '{}',

  -- Metadata
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),

  -- Ensure only one row exists (singleton pattern)
  CONSTRAINT emergency_controls_singleton CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Insert default row (all controls OFF)
INSERT INTO public.emergency_controls (
  id,
  kill_switch,
  safe_mode,
  operator_takeover,
  allowed_operations,
  reason,
  updated_by
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  false,  -- kill_switch OFF
  false,  -- safe_mode OFF
  false,  -- operator_takeover OFF
  '{}',   -- no allowed operations
  'System initialized - all controls disabled',
  NULL    -- system initialization
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on updated_at for audit queries
CREATE INDEX IF NOT EXISTS emergency_controls_updated_at_idx
  ON public.emergency_controls(updated_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.emergency_controls ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view emergency controls
CREATE POLICY emergency_controls_admin_read ON public.emergency_controls
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: Admin users can update emergency controls
CREATE POLICY emergency_controls_admin_update ON public.emergency_controls
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: Prevent deletion (emergency controls should never be deleted)
CREATE POLICY emergency_controls_no_delete ON public.emergency_controls
  FOR DELETE
  USING (false);

-- Policy: Prevent insertion (only one row allowed via constraint)
CREATE POLICY emergency_controls_no_insert ON public.emergency_controls
  FOR INSERT
  WITH CHECK (false);

-- ============================================================================
-- AUDIT TRIGGER
-- ============================================================================

-- Function to audit emergency control changes
CREATE OR REPLACE FUNCTION audit_emergency_controls_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log change to audit_logs table
  INSERT INTO public.audit_logs (
    action,
    resource_type,
    resource_id,
    metadata,
    actor_id,
    ip_address
  ) VALUES (
    'emergency_control_updated',
    'emergency_controls',
    NEW.id,
    jsonb_build_object(
      'old_state', jsonb_build_object(
        'kill_switch', OLD.kill_switch,
        'safe_mode', OLD.safe_mode,
        'operator_takeover', OLD.operator_takeover,
        'allowed_operations', OLD.allowed_operations
      ),
      'new_state', jsonb_build_object(
        'kill_switch', NEW.kill_switch,
        'safe_mode', NEW.safe_mode,
        'operator_takeover', NEW.operator_takeover,
        'allowed_operations', NEW.allowed_operations
      ),
      'reason', NEW.reason,
      'timestamp', now()
    ),
    NEW.updated_by,
    NULL  -- IP address (to be filled by application if available)
  );

  -- Update updated_at timestamp
  NEW.updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit trigger
CREATE TRIGGER emergency_controls_audit_trigger
  BEFORE UPDATE ON public.emergency_controls
  FOR EACH ROW
  EXECUTE FUNCTION audit_emergency_controls_changes();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if kill switch is enabled (callable from edge functions)
CREATE OR REPLACE FUNCTION is_kill_switch_enabled()
RETURNS BOOLEAN AS $$
DECLARE
  is_enabled BOOLEAN;
BEGIN
  SELECT kill_switch INTO is_enabled
  FROM public.emergency_controls
  WHERE id = '00000000-0000-0000-0000-000000000001';

  RETURN COALESCE(is_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if safe mode is enabled
CREATE OR REPLACE FUNCTION is_safe_mode_enabled()
RETURNS BOOLEAN AS $$
DECLARE
  is_enabled BOOLEAN;
BEGIN
  SELECT safe_mode INTO is_enabled
  FROM public.emergency_controls
  WHERE id = '00000000-0000-0000-0000-000000000001';

  RETURN COALESCE(is_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if operator takeover is enabled
CREATE OR REPLACE FUNCTION is_operator_takeover_enabled()
RETURNS BOOLEAN AS $$
DECLARE
  is_enabled BOOLEAN;
BEGIN
  SELECT operator_takeover INTO is_enabled
  FROM public.emergency_controls
  WHERE id = '00000000-0000-0000-000000000001';

  RETURN COALESCE(is_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if operation is allowed (when operator_takeover is enabled)
CREATE OR REPLACE FUNCTION is_operation_allowed(operation_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  is_takeover_enabled BOOLEAN;
  allowed_ops TEXT[];
BEGIN
  SELECT operator_takeover, allowed_operations
  INTO is_takeover_enabled, allowed_ops
  FROM public.emergency_controls
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- If operator takeover is disabled, all operations are allowed
  IF NOT is_takeover_enabled THEN
    RETURN true;
  END IF;

  -- If operator takeover is enabled, check if operation is in allowed list
  RETURN operation_name = ANY(allowed_ops);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get emergency controls status (for health checks)
CREATE OR REPLACE FUNCTION get_emergency_controls_status()
RETURNS jsonb AS $$
DECLARE
  status jsonb;
BEGIN
  SELECT jsonb_build_object(
    'kill_switch', kill_switch,
    'safe_mode', safe_mode,
    'operator_takeover', operator_takeover,
    'allowed_operations', allowed_operations,
    'last_updated', updated_at,
    'updated_by', updated_by,
    'reason', reason
  ) INTO status
  FROM public.emergency_controls
  WHERE id = '00000000-0000-0000-0000-000000000001';

  RETURN COALESCE(status, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.emergency_controls IS
'Operator supremacy controls for OmniHub platform. Singleton table (only one row).';

COMMENT ON COLUMN public.emergency_controls.kill_switch IS
'If TRUE, all OmniHub operations are disabled globally. Emergency stop button.';

COMMENT ON COLUMN public.emergency_controls.safe_mode IS
'If TRUE, all operations run in advisory-only mode (no side effects, read-only).';

COMMENT ON COLUMN public.emergency_controls.operator_takeover IS
'If TRUE, all operations require manual operator approval (only allowed_operations can execute).';

COMMENT ON COLUMN public.emergency_controls.allowed_operations IS
'Array of operation names that are permitted when operator_takeover is TRUE.';

COMMENT ON COLUMN public.emergency_controls.reason IS
'Human-readable explanation for why emergency controls were changed.';

COMMENT ON FUNCTION is_kill_switch_enabled() IS
'Check if kill switch is enabled. Used by edge functions before executing any operation.';

COMMENT ON FUNCTION is_safe_mode_enabled() IS
'Check if safe mode is enabled. If TRUE, operations should be read-only/advisory.';

COMMENT ON FUNCTION is_operator_takeover_enabled() IS
'Check if operator takeover is enabled. If TRUE, operations need manual approval.';

COMMENT ON FUNCTION is_operation_allowed(TEXT) IS
'Check if a specific operation is allowed when operator_takeover is enabled.';

COMMENT ON FUNCTION get_emergency_controls_status() IS
'Get current emergency controls status as JSON. Used for /health/omn endpoint.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant SELECT to authenticated users (for health checks)
GRANT SELECT ON public.emergency_controls TO authenticated;

-- Grant SELECT to anon (for public health check endpoint)
GRANT SELECT ON public.emergency_controls TO anon;

-- Execute permissions for helper functions
GRANT EXECUTE ON FUNCTION is_kill_switch_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION is_safe_mode_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION is_operator_takeover_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION is_operation_allowed(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_emergency_controls_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_emergency_controls_status() TO anon;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration in audit_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'audit_logs'
      AND column_name IN ('action', 'resource_type', 'resource_id', 'metadata', 'actor_id')
      GROUP BY table_name
      HAVING COUNT(*) = 5
    )
  THEN
    INSERT INTO public.audit_logs (
      action,
      resource_type,
      resource_id,
      metadata,
      actor_id
    ) VALUES (
      'migration_applied',
      'database_migration',
      '20260103000000',
      jsonb_build_object(
        'migration_name', 'create_emergency_controls',
        'description', 'Emergency controls system for operator supremacy',
        'applied_at', now()
      ),
      NULL  -- system migration
    );
  END IF;
END $$;
