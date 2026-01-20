-- Migration: Create maestro_receipts table
-- Description: Idempotency receipts for MAESTRO sync operations
-- Author: MAESTRO Phase 4
-- Date: 2026-01-20

-- Create maestro_receipts table
CREATE TABLE IF NOT EXISTS public.maestro_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  canonical_event JSONB NOT NULL,
  outcome JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency enforcement: UNIQUE constraint on tenant_id + idempotency_key
  -- This is the CRITICAL constraint that prevents duplicate side effects
  CONSTRAINT maestro_receipts_unique_key UNIQUE (tenant_id, idempotency_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_maestro_receipts_tenant_created
  ON public.maestro_receipts(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maestro_receipts_key
  ON public.maestro_receipts(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_maestro_receipts_created
  ON public.maestro_receipts(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_maestro_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maestro_receipts_updated_at
BEFORE UPDATE ON public.maestro_receipts
FOR EACH ROW
EXECUTE FUNCTION update_maestro_receipts_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.maestro_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role has full access (for Edge Functions)
CREATE POLICY maestro_receipts_service_full_access
  ON public.maestro_receipts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can read their own receipts
CREATE POLICY maestro_receipts_user_read
  ON public.maestro_receipts
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.uid()::text);

-- RLS Policy: Authenticated users can insert their own receipts
CREATE POLICY maestro_receipts_user_insert
  ON public.maestro_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id::text = auth.uid()::text);

-- Comments for documentation
COMMENT ON TABLE public.maestro_receipts IS 'Idempotency receipts for MAESTRO sync operations. UNIQUE(tenant_id, idempotency_key) enforces exactly-once semantics.';
COMMENT ON COLUMN public.maestro_receipts.idempotency_key IS 'SHA-256 hash: tenant_id|subject_id|canonical_action|canonical_object|time_bucket|source_event_id|recipe_version';
COMMENT ON COLUMN public.maestro_receipts.canonical_event IS 'Immutable snapshot of the event that triggered this receipt';
COMMENT ON COLUMN public.maestro_receipts.outcome IS 'Result of the operation (success, error, reference to created resource)';
COMMENT ON CONSTRAINT maestro_receipts_unique_key ON public.maestro_receipts IS 'CRITICAL: Prevents duplicate side effects. Duplicate insert returns error, allowing server to return cached outcome.';
