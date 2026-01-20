-- Migration: Create maestro_audit table
-- Description: Append-only audit log for MAESTRO operations
-- Author: MAESTRO Phase 4
-- Date: 2026-01-20

-- Create maestro_audit table
CREATE TABLE IF NOT EXISTS public.maestro_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trace_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  risk_lane TEXT CHECK (risk_lane IN ('GREEN', 'YELLOW', 'RED')),
  content_hash TEXT, -- SHA-256 of ciphertext (not plaintext!)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_maestro_audit_tenant_created
  ON public.maestro_audit(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maestro_audit_trace
  ON public.maestro_audit(trace_id);

CREATE INDEX IF NOT EXISTS idx_maestro_audit_event_type
  ON public.maestro_audit(event_type);

CREATE INDEX IF NOT EXISTS idx_maestro_audit_risk
  ON public.maestro_audit(risk_lane)
  WHERE risk_lane = 'RED';

CREATE INDEX IF NOT EXISTS idx_maestro_audit_created
  ON public.maestro_audit(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.maestro_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role has full access (for Edge Functions)
CREATE POLICY maestro_audit_service_full_access
  ON public.maestro_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can read their own audit logs
CREATE POLICY maestro_audit_user_read
  ON public.maestro_audit
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.uid()::text);

-- RLS Policy: Authenticated users can insert their own audit logs
CREATE POLICY maestro_audit_user_insert
  ON public.maestro_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id::text = auth.uid()::text);

-- Function to auto-cleanup old audit logs (optional, for data retention)
CREATE OR REPLACE FUNCTION cleanup_old_maestro_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.maestro_audit
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_maestro_audit_logs IS 'Cleanup audit logs older than retention_days (default: 90). Run periodically via cron or pg_cron.';

-- Comments for documentation
COMMENT ON TABLE public.maestro_audit IS 'Append-only audit log for all MAESTRO operations. Use for compliance, debugging, and security monitoring.';
COMMENT ON COLUMN public.maestro_audit.trace_id IS 'Distributed trace ID for correlating related events across frontend/backend';
COMMENT ON COLUMN public.maestro_audit.event_type IS 'Type of event: memory_sync, execution_request, translation_failed, injection_detected, etc.';
COMMENT ON COLUMN public.maestro_audit.risk_lane IS 'Risk classification: GREEN (safe), YELLOW (review), RED (requires MAN Mode approval)';
COMMENT ON COLUMN public.maestro_audit.content_hash IS 'SHA-256 of ciphertext (NOT plaintext). Server never sees plaintext content.';
