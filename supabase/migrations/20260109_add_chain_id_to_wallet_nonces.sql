-- Add chain_id to wallet_nonces for chain-bound nonce validation
-- Author: OmniLink APEX
-- Date: 2026-01-09

ALTER TABLE public.wallet_nonces
  ADD COLUMN IF NOT EXISTS chain_id integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallet_nonces_chain_id_positive'
  ) THEN
    ALTER TABLE public.wallet_nonces
      ADD CONSTRAINT wallet_nonces_chain_id_positive CHECK (chain_id > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_nonces_wallet_address_chain_id
  ON public.wallet_nonces(wallet_address, chain_id);
