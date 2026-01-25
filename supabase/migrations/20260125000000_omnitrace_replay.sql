-- =============================================================================
-- OmniTrace Replay MVP - Run Recording + Event Timeline
-- =============================================================================
-- Idempotent storage for workflow runs and events with replay support.
-- Key guarantees:
--   1. Atomic upserts on workflow_id (retries don't duplicate)
--   2. Event deduplication via (workflow_id, event_key) constraint
--   3. RLS enforces tenant isolation
-- =============================================================================

-- =============================================================================
-- TABLE: omni_runs
-- =============================================================================
-- Stores workflow run metadata with redacted inputs/outputs for replay.

CREATE TABLE IF NOT EXISTS omni_runs (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Correlation keys (workflow_id is the idempotency key)
  workflow_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,

  -- Ownership (nullable for system-initiated runs)
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Run state
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

  -- Redacted payloads (allowlist keys only, sensitive data hashed)
  input_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_redacted JSONB NULL,

  -- Content hashes for integrity verification
  input_hash TEXT NOT NULL,
  output_hash TEXT NULL,

  -- Event tracking (denormalized for quick access)
  event_count INT NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- CRITICAL: Makes upsert idempotent per workflow
  CONSTRAINT uq_omni_runs_workflow_id UNIQUE (workflow_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_omni_runs_created_at_desc ON omni_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_runs_user_id ON omni_runs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_omni_runs_trace_id ON omni_runs (trace_id);
CREATE INDEX IF NOT EXISTS idx_omni_runs_status ON omni_runs (status);

-- =============================================================================
-- TABLE: omni_run_events
-- =============================================================================
-- Stores individual events within a run (tool calls, model calls, etc.)

CREATE TABLE IF NOT EXISTS omni_run_events (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Join key (denormalized to avoid needing run_id lookup)
  workflow_id TEXT NOT NULL,

  -- Idempotency key: "tool:{step_id}:{tool_name}:{attempt}"
  event_key TEXT NOT NULL,

  -- Event classification
  kind TEXT NOT NULL CHECK (kind IN ('tool', 'model', 'policy', 'cache', 'system')),
  name TEXT NOT NULL,

  -- Performance metrics
  latency_ms INT NULL,

  -- Redacted event data
  data_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_hash TEXT NOT NULL,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- CRITICAL: Prevents duplicate events on retry
  CONSTRAINT uq_omni_run_events_workflow_event UNIQUE (workflow_id, event_key)
);

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_omni_run_events_workflow_created
  ON omni_run_events (workflow_id, created_at);
CREATE INDEX IF NOT EXISTS idx_omni_run_events_kind ON omni_run_events (kind);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE omni_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_run_events ENABLE ROW LEVEL SECURITY;

-- omni_runs: Service role can do everything (orchestrator writes)
CREATE POLICY "Service role full access to omni_runs"
  ON omni_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- omni_runs: Authenticated users can only read their own runs
CREATE POLICY "Users can view own runs"
  ON omni_runs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- omni_run_events: Service role can do everything
CREATE POLICY "Service role full access to omni_run_events"
  ON omni_run_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- omni_run_events: Users can read events for their own runs
CREATE POLICY "Users can view events for own runs"
  ON omni_run_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM omni_runs r
      WHERE r.workflow_id = omni_run_events.workflow_id
        AND r.user_id = auth.uid()
    )
  );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to upsert a run (idempotent on workflow_id)
CREATE OR REPLACE FUNCTION omnitrace_upsert_run(
  p_workflow_id TEXT,
  p_trace_id TEXT,
  p_user_id UUID,
  p_status TEXT,
  p_input_redacted JSONB,
  p_output_redacted JSONB,
  p_input_hash TEXT,
  p_output_hash TEXT,
  p_event_count INT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO omni_runs (
    workflow_id, trace_id, user_id, status,
    input_redacted, output_redacted, input_hash, output_hash,
    event_count, updated_at
  )
  VALUES (
    p_workflow_id, p_trace_id, p_user_id, p_status,
    p_input_redacted, p_output_redacted, p_input_hash, p_output_hash,
    p_event_count, NOW()
  )
  ON CONFLICT (workflow_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    output_redacted = COALESCE(EXCLUDED.output_redacted, omni_runs.output_redacted),
    output_hash = COALESCE(EXCLUDED.output_hash, omni_runs.output_hash),
    event_count = GREATEST(omni_runs.event_count, EXCLUDED.event_count),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Function to insert event (idempotent - skips on conflict)
CREATE OR REPLACE FUNCTION omnitrace_insert_event(
  p_workflow_id TEXT,
  p_event_key TEXT,
  p_kind TEXT,
  p_name TEXT,
  p_latency_ms INT,
  p_data_redacted JSONB,
  p_data_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO omni_run_events (
    workflow_id, event_key, kind, name,
    latency_ms, data_redacted, data_hash
  )
  VALUES (
    p_workflow_id, p_event_key, p_kind, p_name,
    p_latency_ms, p_data_redacted, p_data_hash
  )
  ON CONFLICT (workflow_id, event_key) DO NOTHING
  RETURNING id INTO v_id;

  -- Update event count on parent run
  IF v_id IS NOT NULL THEN
    UPDATE omni_runs
    SET event_count = event_count + 1, updated_at = NOW()
    WHERE workflow_id = p_workflow_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Function to get run with events (for replay bundle)
CREATE OR REPLACE FUNCTION omnitrace_get_run_bundle(
  p_workflow_id TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  run_data JSONB,
  events_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb(r.*) AS run_data,
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(e.*) ORDER BY e.created_at)
        FROM omni_run_events e
        WHERE e.workflow_id = r.workflow_id
      ),
      '[]'::jsonb
    ) AS events_data
  FROM omni_runs r
  WHERE r.workflow_id = p_workflow_id
    AND r.user_id = p_user_id;
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE omni_runs IS 'OmniTrace run records - workflow execution metadata with redacted payloads';
COMMENT ON TABLE omni_run_events IS 'OmniTrace run events - individual tool/model/policy events within a run';
COMMENT ON COLUMN omni_runs.workflow_id IS 'Temporal workflow ID - idempotency key for upserts';
COMMENT ON COLUMN omni_runs.input_redacted IS 'Allowlist-filtered input (sensitive data removed or hashed)';
COMMENT ON COLUMN omni_run_events.event_key IS 'Idempotency key format: tool:{step_id}:{tool_name}:{attempt}';
COMMENT ON FUNCTION omnitrace_upsert_run IS 'Idempotent run upsert - safe for Temporal retries';
COMMENT ON FUNCTION omnitrace_insert_event IS 'Idempotent event insert - ON CONFLICT DO NOTHING';
