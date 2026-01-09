-- Create chain_tx_log table for Alchemy webhook idempotency
-- Author: OmniLink APEX
-- Date: 2026-01-09

CREATE TABLE IF NOT EXISTS public.chain_tx_log (
  id text PRIMARY KEY,
  tx_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chain_tx_log_status_valid CHECK (status IN ('pending', 'confirmed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_chain_tx_log_tx_hash ON public.chain_tx_log(tx_hash);
CREATE INDEX IF NOT EXISTS idx_chain_tx_log_status_created_at ON public.chain_tx_log(status, created_at DESC);

ALTER TABLE public.chain_tx_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chain_tx_log'
      AND policyname = 'Service role has full access to chain_tx_log'
  ) THEN
    CREATE POLICY "Service role has full access to chain_tx_log"
      ON public.chain_tx_log
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_chain_tx_log_updated_at ON public.chain_tx_log;
CREATE TRIGGER update_chain_tx_log_updated_at
  BEFORE UPDATE ON public.chain_tx_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
