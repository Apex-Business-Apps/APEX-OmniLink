-- Push Notification Device Registry
-- Stores device tokens for APNS (iOS) and FCM (Android) push notifications

CREATE TABLE IF NOT EXISTS push_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Device identification
  device_id TEXT NOT NULL, -- Unique device identifier
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  
  -- Push token
  token TEXT NOT NULL,
  
  -- Token metadata
  app_version TEXT,
  os_version TEXT,
  device_model TEXT,
  
  -- Status tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one active token per device
  CONSTRAINT uq_push_device_tokens_device UNIQUE (user_id, device_id)
);

-- Index for efficient token lookups
CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user_active 
  ON push_device_tokens(user_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_platform 
  ON push_device_tokens(platform, is_active) 
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE push_device_tokens ENABLE ROW LEVEL SECURITY;

-- Service role full access (for Edge Functions)
CREATE POLICY "Service role full access to push_device_tokens"
  ON push_device_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can manage their own device tokens
CREATE POLICY "Users can manage own device tokens"
  ON push_device_tokens
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to upsert device token
CREATE OR REPLACE FUNCTION upsert_push_device_token(
  p_user_id UUID,
  p_device_id TEXT,
  p_platform TEXT,
  p_token TEXT,
  p_app_version TEXT DEFAULT NULL,
  p_os_version TEXT DEFAULT NULL,
  p_device_model TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO push_device_tokens (
    user_id, device_id, platform, token,
    app_version, os_version, device_model,
    is_active, last_used_at, updated_at
  )
  VALUES (
    p_user_id, p_device_id, p_platform, p_token,
    p_app_version, p_os_version, p_device_model,
    true, NOW(), NOW()
  )
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET
    token = EXCLUDED.token,
    platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version,
    os_version = EXCLUDED.os_version,
    device_model = EXCLUDED.device_model,
    is_active = true,
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

COMMENT ON TABLE push_device_tokens IS 'Device tokens for native push notifications (APNS/FCM)';
COMMENT ON FUNCTION upsert_push_device_token IS 'Upsert device token for push notifications';
