-- Create device_registry table for persistent device tracking
-- Replaces Lovable API dependency for device registry

CREATE TABLE IF NOT EXISTS public.device_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id text NOT NULL,
  device_info jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'suspect' CHECK (status IN ('trusted', 'suspect', 'blocked')),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_id)
);

-- Enable RLS
ALTER TABLE public.device_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device_registry
-- Users can view their own devices
CREATE POLICY "Users can view own devices"
  ON public.device_registry
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own devices
CREATE POLICY "Users can insert own devices"
  ON public.device_registry
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own devices
CREATE POLICY "Users can update own devices"
  ON public.device_registry
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own devices
CREATE POLICY "Users can delete own devices"
  ON public.device_registry
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role full access to device registry"
  ON public.device_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_device_registry_user_id ON public.device_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_device_registry_device_id ON public.device_registry(device_id);
CREATE INDEX IF NOT EXISTS idx_device_registry_status ON public.device_registry(status);
CREATE INDEX IF NOT EXISTS idx_device_registry_last_seen ON public.device_registry(last_seen DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER handle_device_registry_updated_at
  BEFORE UPDATE ON public.device_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
