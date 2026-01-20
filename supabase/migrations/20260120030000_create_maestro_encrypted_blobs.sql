-- Migration: Create maestro_encrypted_blobs table
-- Description: E2EE blob metadata (NO PLAINTEXT CONTENT)
-- Author: MAESTRO Phase 4
-- Date: 2026-01-20

-- Create maestro_encrypted_blobs table
CREATE TABLE IF NOT EXISTS public.maestro_encrypted_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  blob_path TEXT NOT NULL, -- Path in Supabase Storage: maestro-encrypted/{tenant_id}/{blob_id}
  content_hash TEXT NOT NULL, -- SHA-256 of ciphertext (for deduplication)
  key_version INTEGER NOT NULL DEFAULT 1,
  locale TEXT NOT NULL, -- BCP-47 locale (e.g., en-US, fr-FR)
  tier TEXT CHECK (tier IN ('core', 'working', 'episodic', 'semantic', 'procedural')),
  size_bytes BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- For working tier TTL

  -- Deduplication: UNIQUE constraint on tenant_id + content_hash
  -- If same content_hash already exists, blob is already stored
  CONSTRAINT maestro_blobs_unique_hash UNIQUE (tenant_id, content_hash)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_maestro_blobs_tenant_tier_created
  ON public.maestro_encrypted_blobs(tenant_id, tier, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maestro_blobs_hash
  ON public.maestro_encrypted_blobs(content_hash);

CREATE INDEX IF NOT EXISTS idx_maestro_blobs_locale
  ON public.maestro_encrypted_blobs(tenant_id, locale);

CREATE INDEX IF NOT EXISTS idx_maestro_blobs_expires
  ON public.maestro_encrypted_blobs(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_maestro_blobs_created
  ON public.maestro_encrypted_blobs(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_maestro_blobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maestro_blobs_updated_at
BEFORE UPDATE ON public.maestro_encrypted_blobs
FOR EACH ROW
EXECUTE FUNCTION update_maestro_blobs_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.maestro_encrypted_blobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role has full access (for Edge Functions)
CREATE POLICY maestro_blobs_service_full_access
  ON public.maestro_encrypted_blobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can access their own blobs
CREATE POLICY maestro_blobs_user_access
  ON public.maestro_encrypted_blobs
  FOR ALL
  TO authenticated
  USING (tenant_id::text = auth.uid()::text)
  WITH CHECK (tenant_id::text = auth.uid()::text);

-- Function to cleanup expired blobs
CREATE OR REPLACE FUNCTION cleanup_expired_maestro_blobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.maestro_encrypted_blobs
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_maestro_blobs IS 'Cleanup expired blobs (working tier TTL). Run periodically via cron or pg_cron.';

-- Comments for documentation
COMMENT ON TABLE public.maestro_encrypted_blobs IS 'E2EE blob metadata ONLY. Server NEVER stores plaintext content. All content is encrypted client-side with AES-GCM.';
COMMENT ON COLUMN public.maestro_encrypted_blobs.blob_path IS 'Path in Supabase Storage bucket: maestro-encrypted/{tenant_id}/{blob_id}.enc';
COMMENT ON COLUMN public.maestro_encrypted_blobs.content_hash IS 'SHA-256 of ciphertext (NOT plaintext). Used for deduplication.';
COMMENT ON COLUMN public.maestro_encrypted_blobs.key_version IS 'Encryption key version (for key rotation)';
COMMENT ON COLUMN public.maestro_encrypted_blobs.locale IS 'BCP-47 locale for content (e.g., en-US, fr-FR, zh-CN)';
COMMENT ON COLUMN public.maestro_encrypted_blobs.tier IS 'Memory tier: core, working, episodic, semantic, procedural';
COMMENT ON COLUMN public.maestro_encrypted_blobs.expires_at IS 'Expiry timestamp for working tier (24h TTL)';
COMMENT ON CONSTRAINT maestro_blobs_unique_hash ON public.maestro_encrypted_blobs IS 'Deduplication: Same content_hash = same ciphertext = blob already stored';
