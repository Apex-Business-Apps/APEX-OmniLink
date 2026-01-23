-- SIWE (Sign-In With Ethereum) Foundation
-- Migration: Create SIWE authentication tables with proper indexes
-- Author: APEX OmniHub
-- Date: 2026-01-24
-- Phase: 0 - NFT Verification with Revocation

-- ========================================
-- Table: auth_nonces
-- Purpose: Cryptographic nonces for SIWE authentication
-- ========================================
CREATE TABLE IF NOT EXISTS public.auth_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nonce data
  nonce text NOT NULL UNIQUE,
  wallet_address text NOT NULL,
  chain_id integer NOT NULL DEFAULT 80002, -- Polygon Amoy

  -- Expiration tracking
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,

  -- SIWE message binding
  domain text, -- Expected domain for verification
  uri text, -- Expected URI for verification
  statement text, -- Human-readable statement

  -- Request metadata (for audit/debugging)
  request_id text, -- Client-provided idempotency key
  ip_address text,
  user_agent text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT auth_nonces_wallet_format CHECK (wallet_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT auth_nonces_chain_positive CHECK (chain_id > 0),
  CONSTRAINT auth_nonces_expires_future CHECK (expires_at > created_at)
);

-- ========================================
-- Indexes for auth_nonces
-- ========================================

-- Primary query pattern: find valid unused nonce
CREATE INDEX IF NOT EXISTS idx_auth_nonces_used_expires
  ON public.auth_nonces(used, expires_at)
  WHERE used = false;

-- Lookup by nonce value (already has UNIQUE constraint, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_auth_nonces_nonce_lookup
  ON public.auth_nonces(nonce)
  WHERE used = false;

-- Lookup by wallet address for rate limiting
CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet_created
  ON public.auth_nonces(wallet_address, created_at DESC);

-- Idempotency lookup by request_id
CREATE INDEX IF NOT EXISTS idx_auth_nonces_request_id
  ON public.auth_nonces(request_id)
  WHERE request_id IS NOT NULL;

-- ========================================
-- Table: user_wallets
-- Purpose: Link users to verified wallets with active status
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Wallet data (lowercase normalized)
  wallet_address text NOT NULL,
  chain_id integer NOT NULL DEFAULT 80002,

  -- Verification data
  signature text NOT NULL,
  message text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  deactivated_at timestamptz,
  deactivation_reason text,

  -- NFT verification
  has_premium_nft boolean NOT NULL DEFAULT false,
  nft_balance integer NOT NULL DEFAULT 0,
  nft_verified_at timestamptz,
  nft_contract_address text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT user_wallets_address_format CHECK (wallet_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT user_wallets_chain_positive CHECK (chain_id > 0),
  UNIQUE(wallet_address, chain_id)
);

-- ========================================
-- Indexes for user_wallets
-- ========================================

-- Active wallets by user (for premium checks)
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_active
  ON public.user_wallets(user_id)
  WHERE is_active = true;

-- Lookup by wallet address
CREATE INDEX IF NOT EXISTS idx_user_wallets_address
  ON public.user_wallets(wallet_address);

-- Premium NFT holders
CREATE INDEX IF NOT EXISTS idx_user_wallets_premium
  ON public.user_wallets(user_id)
  WHERE has_premium_nft = true AND is_active = true;

-- ========================================
-- Row Level Security
-- ========================================

-- auth_nonces: Service role only (managed by edge functions)
ALTER TABLE public.auth_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to auth_nonces"
  ON public.auth_nonces
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- user_wallets: Users can view their own wallets
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallets"
  ON public.user_wallets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to user_wallets"
  ON public.user_wallets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- Trigger: Auto-update updated_at
-- ========================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists before creating
DROP TRIGGER IF EXISTS set_user_wallets_updated_at ON public.user_wallets;

CREATE TRIGGER set_user_wallets_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- ========================================
-- Function: Mark nonce as used (atomic)
-- ========================================

CREATE OR REPLACE FUNCTION public.use_auth_nonce(
  p_nonce text,
  p_wallet_address text,
  p_chain_id integer DEFAULT 80002
)
RETURNS TABLE (
  success boolean,
  nonce_id uuid,
  error_code text
) AS $$
DECLARE
  v_nonce_id uuid;
  v_expires_at timestamptz;
  v_used boolean;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT id, expires_at, used INTO v_nonce_id, v_expires_at, v_used
  FROM public.auth_nonces
  WHERE nonce = p_nonce
    AND wallet_address = lower(p_wallet_address)
    AND chain_id = p_chain_id
  FOR UPDATE;

  -- Check if nonce exists
  IF v_nonce_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'NONCE_NOT_FOUND'::text;
    RETURN;
  END IF;

  -- Check if already used
  IF v_used THEN
    RETURN QUERY SELECT false, v_nonce_id, 'NONCE_ALREADY_USED'::text;
    RETURN;
  END IF;

  -- Check if expired
  IF v_expires_at < now() THEN
    RETURN QUERY SELECT false, v_nonce_id, 'NONCE_EXPIRED'::text;
    RETURN;
  END IF;

  -- Mark as used atomically
  UPDATE public.auth_nonces
  SET used = true, used_at = now()
  WHERE id = v_nonce_id;

  RETURN QUERY SELECT true, v_nonce_id, NULL::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.use_auth_nonce(text, text, integer) TO service_role;

-- ========================================
-- Function: Cleanup expired nonces
-- ========================================

CREATE OR REPLACE FUNCTION public.cleanup_auth_nonces()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete nonces that expired more than 1 hour ago
  DELETE FROM public.auth_nonces
  WHERE expires_at < now() - interval '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_auth_nonces() TO service_role;

-- ========================================
-- Function: Revoke NFT access (on transfer)
-- ========================================

CREATE OR REPLACE FUNCTION public.revoke_nft_access(
  p_wallet_address text,
  p_chain_id integer DEFAULT 80002
)
RETURNS void AS $$
BEGIN
  -- Update wallet record
  UPDATE public.user_wallets
  SET
    has_premium_nft = false,
    nft_balance = 0,
    nft_verified_at = now(),
    updated_at = now()
  WHERE wallet_address = lower(p_wallet_address)
    AND chain_id = p_chain_id;

  -- Update associated user profile
  UPDATE public.profiles
  SET
    has_premium_nft = false,
    nft_verified_at = now()
  WHERE id IN (
    SELECT user_id FROM public.user_wallets
    WHERE wallet_address = lower(p_wallet_address)
      AND chain_id = p_chain_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.revoke_nft_access(text, integer) TO service_role;

-- ========================================
-- Function: Grant NFT access
-- ========================================

CREATE OR REPLACE FUNCTION public.grant_nft_access(
  p_user_id uuid,
  p_wallet_address text,
  p_nft_balance integer,
  p_nft_contract text DEFAULT NULL,
  p_chain_id integer DEFAULT 80002
)
RETURNS void AS $$
BEGIN
  -- Update wallet record
  UPDATE public.user_wallets
  SET
    has_premium_nft = true,
    nft_balance = p_nft_balance,
    nft_verified_at = now(),
    nft_contract_address = p_nft_contract,
    updated_at = now()
  WHERE user_id = p_user_id
    AND wallet_address = lower(p_wallet_address)
    AND chain_id = p_chain_id;

  -- Update user profile
  UPDATE public.profiles
  SET
    has_premium_nft = true,
    nft_verified_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.grant_nft_access(uuid, text, integer, text, integer) TO service_role;

-- ========================================
-- Comments
-- ========================================

COMMENT ON TABLE public.auth_nonces IS 'SIWE authentication nonces with replay protection';
COMMENT ON TABLE public.user_wallets IS 'User wallet linkages with NFT verification status';
COMMENT ON FUNCTION public.use_auth_nonce IS 'Atomically mark nonce as used (prevents replay)';
COMMENT ON FUNCTION public.revoke_nft_access IS 'Revoke premium NFT access on transfer';
COMMENT ON FUNCTION public.grant_nft_access IS 'Grant premium NFT access after verification';
