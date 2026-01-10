-- Idempotency Receipts Table
-- Stores idempotency receipts for event deduplication across restarts
--
-- USAGE:
--   Run this migration in Supabase SQL editor or via migration tool
--
-- FEATURES:
--   - Unique constraint on idempotency_key for atomicity
--   - TTL-based expiration with automatic cleanup
--   - Tenant isolation for multi-tenancy
--   - JSON payload storage for request/response tracking
--   - Indexed for fast lookups

CREATE TABLE IF NOT EXISTS idempotency_receipts (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idempotency key (unique per event)
  idempotency_key TEXT NOT NULL UNIQUE,

  -- Event correlation
  correlation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,

  -- Tenant isolation
  tenant_id TEXT NOT NULL,

  -- Request/response tracking
  request_payload JSONB,
  response_payload JSONB,

  -- Attempt tracking
  attempt_count INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_idempotency_receipts_idempotency_key
  ON idempotency_receipts(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_idempotency_receipts_correlation_id
  ON idempotency_receipts(correlation_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_receipts_tenant_id
  ON idempotency_receipts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_receipts_event_type
  ON idempotency_receipts(event_type);

CREATE INDEX IF NOT EXISTS idx_idempotency_receipts_expires_at
  ON idempotency_receipts(expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_receipts_created_at
  ON idempotency_receipts(created_at DESC);

-- Composite index for tenant + expiration queries
CREATE INDEX IF NOT EXISTS idx_idempotency_receipts_tenant_expires
  ON idempotency_receipts(tenant_id, expires_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_idempotency_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
DROP TRIGGER IF EXISTS update_idempotency_receipts_updated_at_trigger
  ON idempotency_receipts;

CREATE TRIGGER update_idempotency_receipts_updated_at_trigger
  BEFORE UPDATE ON idempotency_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_idempotency_receipts_updated_at();

-- Function to clean up expired receipts
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_receipts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_receipts
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to run cleanup daily (requires pg_cron extension)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule(
--   'cleanup-expired-idempotency-receipts',
--   '0 2 * * *', -- Run at 2 AM daily
--   $$ SELECT cleanup_expired_idempotency_receipts(); $$
-- );

-- Row Level Security (RLS) for tenant isolation
ALTER TABLE idempotency_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tenant's receipts
CREATE POLICY idempotency_receipts_tenant_isolation
  ON idempotency_receipts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- Policy: Service role can see all receipts (for admin/cleanup)
CREATE POLICY idempotency_receipts_service_role
  ON idempotency_receipts
  FOR ALL
  TO service_role
  USING (true);

-- Comments for documentation
COMMENT ON TABLE idempotency_receipts IS
  'Stores idempotency receipts for event deduplication. Receipts expire based on TTL.';

COMMENT ON COLUMN idempotency_receipts.idempotency_key IS
  'Unique key for event idempotency. Prevents duplicate processing.';

COMMENT ON COLUMN idempotency_receipts.correlation_id IS
  'Correlation ID for tracing related events across services.';

COMMENT ON COLUMN idempotency_receipts.event_type IS
  'Type of event being processed (e.g., tradeline247:call.received).';

COMMENT ON COLUMN idempotency_receipts.tenant_id IS
  'Tenant ID for multi-tenancy isolation.';

COMMENT ON COLUMN idempotency_receipts.request_payload IS
  'Original request payload (for debugging and replay).';

COMMENT ON COLUMN idempotency_receipts.response_payload IS
  'Cached response payload (returned for duplicate requests).';

COMMENT ON COLUMN idempotency_receipts.attempt_count IS
  'Number of times this event was attempted (including retries).';

COMMENT ON COLUMN idempotency_receipts.expires_at IS
  'Expiration timestamp. Receipts are deleted after this time.';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_receipts TO authenticated;
GRANT ALL ON idempotency_receipts TO service_role;

-- Create a view for active receipts (not expired)
CREATE OR REPLACE VIEW active_idempotency_receipts AS
SELECT *
FROM idempotency_receipts
WHERE expires_at > NOW();

COMMENT ON VIEW active_idempotency_receipts IS
  'View of non-expired idempotency receipts.';

GRANT SELECT ON active_idempotency_receipts TO authenticated;
GRANT SELECT ON active_idempotency_receipts TO service_role;
