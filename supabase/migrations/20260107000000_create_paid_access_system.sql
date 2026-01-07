-- Paid Access System - Dashboard Tier Access Control
-- Migration: Create subscription tiers and paid access verification
-- Author: OmniLink APEX
-- Date: 2026-01-07

-- ========================================
-- Enum: subscription_tier
-- Purpose: Define available subscription tiers
-- ========================================
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM (
    'free',      -- Basic free tier (no dashboard access)
    'starter',   -- Entry paid tier (basic dashboard)
    'pro',       -- Professional tier (full dashboard + features)
    'enterprise' -- Enterprise tier (all features + priority support)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- Enum: subscription_status
-- Purpose: Track subscription lifecycle states
-- ========================================
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'active',    -- Currently paid and active
    'trialing',  -- In trial period
    'past_due',  -- Payment failed, grace period
    'canceled',  -- User canceled, still valid until period_end
    'expired',   -- Subscription has ended
    'paused'     -- Temporarily paused
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- Table: subscriptions
-- Purpose: Track user subscription status and tier
-- ========================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier public.subscription_tier NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',

  -- Payment provider integration
  stripe_customer_id text,
  stripe_subscription_id text,

  -- Billing period
  current_period_start timestamptz,
  current_period_end timestamptz,

  -- Trial management
  trial_start timestamptz,
  trial_end timestamptz,

  -- Cancellation tracking
  canceled_at timestamptz,
  cancel_at_period_end boolean DEFAULT false,

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_billing_period CHECK (
    current_period_start IS NULL OR current_period_end IS NULL OR
    current_period_end > current_period_start
  ),
  CONSTRAINT valid_trial_period CHECK (
    trial_start IS NULL OR trial_end IS NULL OR
    trial_end > trial_start
  )
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end) WHERE status IN ('active', 'trialing', 'canceled');

-- ========================================
-- Function: is_paid_user
-- Purpose: Check if a user has an active paid subscription
-- Used in RLS policies for dashboard access control
-- ========================================
CREATE OR REPLACE FUNCTION public.is_paid_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND tier IN ('starter', 'pro', 'enterprise')
      AND status IN ('active', 'trialing', 'canceled')
      AND (
        -- Active subscription within billing period
        (status = 'active' AND (current_period_end IS NULL OR current_period_end > now()))
        OR
        -- In trial period
        (status = 'trialing' AND trial_end > now())
        OR
        -- Canceled but still within paid period
        (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_paid_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_paid_user(uuid) TO service_role;

-- ========================================
-- Function: get_user_tier
-- Purpose: Get the current tier for a user
-- Returns 'free' if no subscription exists
-- ========================================
CREATE OR REPLACE FUNCTION public.get_user_tier(_user_id uuid)
RETURNS public.subscription_tier
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT tier FROM public.subscriptions
      WHERE user_id = _user_id
        AND status IN ('active', 'trialing', 'canceled')
        AND (
          (status = 'active' AND (current_period_end IS NULL OR current_period_end > now()))
          OR (status = 'trialing' AND trial_end > now())
          OR (status = 'canceled' AND current_period_end > now())
        )
      LIMIT 1
    ),
    'free'::public.subscription_tier
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tier(uuid) TO service_role;

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only service role can insert/update/delete subscriptions
-- (prevents users from modifying their own subscription status)
CREATE POLICY "Service role has full access to subscriptions"
  ON public.subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- Trigger: Auto-update updated_at
-- ========================================

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Function: Auto-create subscription on user signup
-- Purpose: Ensure every user has a subscription record
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create subscription on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();

-- ========================================
-- Backfill: Create subscription records for existing users
-- ========================================
INSERT INTO public.subscriptions (user_id, tier, status, created_at)
SELECT id, 'free', 'active', now()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- ========================================
-- Comments for documentation
-- ========================================

COMMENT ON TABLE public.subscriptions IS 'User subscription status and tier information for access control';
COMMENT ON COLUMN public.subscriptions.tier IS 'Subscription tier: free, starter, pro, enterprise';
COMMENT ON COLUMN public.subscriptions.status IS 'Current subscription status for billing lifecycle';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID for payment integration';
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'Stripe subscription ID for webhook reconciliation';
COMMENT ON FUNCTION public.is_paid_user(uuid) IS 'Check if user has active paid access (starter, pro, or enterprise tier)';
COMMENT ON FUNCTION public.get_user_tier(uuid) IS 'Get current subscription tier for a user, defaults to free';
