-- =============================================================================
-- OmniPort Dead Letter Queue (DLQ) - The Ingress Buffer
-- =============================================================================
-- The fortified ingress buffer for APEX OmniHub's proprietary ingress engine.
-- Captures failed ingestion attempts with risk scoring for prioritized replay.
-- =============================================================================

-- Create the DLQ status enum for type-safe status tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dlq_status') THEN
    CREATE TYPE dlq_status AS ENUM ('pending', 'replaying', 'failed');
  END IF;
END$$;

-- Create the ingress_buffer table (Dead Letter Queue)
CREATE TABLE IF NOT EXISTS ingress_buffer (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Correlation ID for distributed tracing (indexed for fast lookups)
  correlation_id TEXT NOT NULL,

  -- The raw input payload that failed processing
  raw_input JSONB NOT NULL,

  -- Human-readable error reason for debugging
  error_reason TEXT NOT NULL,

  -- Processing status with enum constraint
  status dlq_status NOT NULL DEFAULT 'pending',

  -- MOAT FEATURE: Risk score for prioritizing high-value failure replays
  -- Higher scores indicate more critical failures (e.g., financial transactions)
  -- Range: 0 (low priority) to 100 (critical)
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),

  -- Timestamp tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Optional: Track replay attempts
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  -- Optional: Source metadata for debugging
  source_type TEXT,
  user_id UUID
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Fast correlation ID lookups for tracing
CREATE INDEX IF NOT EXISTS idx_ingress_buffer_correlation_id
  ON ingress_buffer(correlation_id);

-- Fast filtering by status for replay processing
CREATE INDEX IF NOT EXISTS idx_ingress_buffer_status
  ON ingress_buffer(status);

-- Prioritize high-risk failures for replay (risk_score DESC)
CREATE INDEX IF NOT EXISTS idx_ingress_buffer_risk_priority
  ON ingress_buffer(status, risk_score DESC, created_at ASC)
  WHERE status = 'pending';

-- Fast user-based queries for debugging
CREATE INDEX IF NOT EXISTS idx_ingress_buffer_user_id
  ON ingress_buffer(user_id)
  WHERE user_id IS NOT NULL;

-- Time-based queries for retention policies
CREATE INDEX IF NOT EXISTS idx_ingress_buffer_created_at
  ON ingress_buffer(created_at);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS for tenant isolation
ALTER TABLE ingress_buffer ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access to ingress_buffer"
  ON ingress_buffer
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only view their own DLQ entries
CREATE POLICY "Users can view own DLQ entries"
  ON ingress_buffer
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get pending entries prioritized by risk score
CREATE OR REPLACE FUNCTION get_pending_dlq_entries(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  correlation_id TEXT,
  raw_input JSONB,
  error_reason TEXT,
  risk_score INTEGER,
  created_at TIMESTAMPTZ,
  retry_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ib.id,
    ib.correlation_id,
    ib.raw_input,
    ib.error_reason,
    ib.risk_score,
    ib.created_at,
    ib.retry_count
  FROM ingress_buffer ib
  WHERE ib.status = 'pending'
  ORDER BY ib.risk_score DESC, ib.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Function to mark entries as replaying (atomic claim)
CREATE OR REPLACE FUNCTION claim_dlq_entries_for_replay(
  p_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE ingress_buffer
  SET
    status = 'replaying',
    last_retry_at = NOW(),
    retry_count = retry_count + 1
  WHERE id = ANY(p_ids) AND status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to clean up old failed entries (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_dlq_entries(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM ingress_buffer
  WHERE status = 'failed'
    AND created_at < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE ingress_buffer IS 'OmniPort Dead Letter Queue - stores failed ingestion attempts for replay';
COMMENT ON COLUMN ingress_buffer.correlation_id IS 'Distributed tracing correlation ID';
COMMENT ON COLUMN ingress_buffer.raw_input IS 'Original input payload that failed processing';
COMMENT ON COLUMN ingress_buffer.error_reason IS 'Human-readable failure reason';
COMMENT ON COLUMN ingress_buffer.status IS 'Processing status: pending, replaying, or failed';
COMMENT ON COLUMN ingress_buffer.risk_score IS 'Priority score (0-100) for replay ordering - higher = more critical';
COMMENT ON FUNCTION get_pending_dlq_entries IS 'Retrieves pending DLQ entries prioritized by risk score';
COMMENT ON FUNCTION claim_dlq_entries_for_replay IS 'Atomically claims entries for replay processing';
COMMENT ON FUNCTION cleanup_old_dlq_entries IS 'Removes old failed entries per retention policy';
