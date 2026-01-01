-- Add NFT-related columns to profiles table
-- Migration: 20260101000001_add_nft_profile_columns
-- Author: OmniLink APEX
-- Date: 2026-01-01

-- Add has_premium_nft column to track NFT ownership
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_premium_nft BOOLEAN NOT NULL DEFAULT FALSE;

-- Add nft_verified_at timestamp to track last verification
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nft_verified_at TIMESTAMPTZ;

-- Add index for efficient NFT queries
CREATE INDEX IF NOT EXISTS idx_profiles_has_premium_nft
  ON public.profiles(has_premium_nft)
  WHERE has_premium_nft = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.has_premium_nft IS 'Indicates if user owns APEXMembershipNFT for premium access';
COMMENT ON COLUMN public.profiles.nft_verified_at IS 'Last time NFT ownership was verified via blockchain or webhook';

-- Ensure RLS allows users to read their own NFT status
-- (Existing policy should cover this, but verify)
-- Users can read their own profile
-- Service role can update NFT status via webhook
