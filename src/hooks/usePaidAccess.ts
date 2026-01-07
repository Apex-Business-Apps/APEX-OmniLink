import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'paused';

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaidAccessResult {
  /** Whether the user has paid access (starter, pro, or enterprise tier) */
  isPaid: boolean;
  /** Current subscription tier */
  tier: SubscriptionTier;
  /** Current subscription status */
  status: SubscriptionStatus | null;
  /** Full subscription data */
  subscription: Subscription | null;
  /** Whether data is loading */
  loading: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Whether the subscription is in a trial period */
  isTrial: boolean;
  /** Whether the subscription will cancel at period end */
  willCancel: boolean;
  /** Days remaining in current period (null if no active period) */
  daysRemaining: number | null;
  /** Refetch subscription data */
  refetch: () => void;
}

/**
 * Hook to check if the current user has paid access to premium features
 *
 * Usage:
 * ```tsx
 * const { isPaid, tier, loading } = usePaidAccess();
 *
 * if (loading) return <Spinner />;
 * if (!isPaid) return <UpgradePrompt />;
 * return <PremiumContent />;
 * ```
 */
export function usePaidAccess(): PaidAccessResult {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Subscription | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Subscription | null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const subscription = data ?? null;
  const tier = subscription?.tier ?? 'free';
  const status = subscription?.status ?? null;

  // Calculate if user has active paid access
  const isPaid = (() => {
    if (!subscription) return false;
    if (tier === 'free') return false;

    const now = new Date();

    switch (status) {
      case 'active':
        // Check if within billing period
        if (subscription.current_period_end) {
          return new Date(subscription.current_period_end) > now;
        }
        return true; // No period end means unlimited

      case 'trialing':
        // Check if within trial period
        if (subscription.trial_end) {
          return new Date(subscription.trial_end) > now;
        }
        return false;

      case 'canceled':
        // Still valid until period end
        if (subscription.current_period_end) {
          return new Date(subscription.current_period_end) > now;
        }
        return false;

      default:
        return false;
    }
  })();

  // Calculate days remaining
  const daysRemaining = (() => {
    if (!subscription) return null;

    const now = new Date();
    let endDate: Date | null = null;

    if (status === 'trialing' && subscription.trial_end) {
      endDate = new Date(subscription.trial_end);
    } else if (subscription.current_period_end) {
      endDate = new Date(subscription.current_period_end);
    }

    if (!endDate || endDate <= now) return null;

    const diffMs = endDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  })();

  return {
    isPaid,
    tier,
    status,
    subscription,
    loading: isLoading,
    error: error as Error | null,
    isTrial: status === 'trialing',
    willCancel: subscription?.cancel_at_period_end ?? false,
    daysRemaining,
    refetch,
  };
}

/**
 * Hook to check if user has access to a specific tier level
 *
 * Usage:
 * ```tsx
 * const hasProAccess = useTierAccess('pro');
 * ```
 */
export function useTierAccess(requiredTier: SubscriptionTier): boolean {
  const { tier, isPaid } = usePaidAccess();

  if (!isPaid) return requiredTier === 'free';

  const tierLevels: Record<SubscriptionTier, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    enterprise: 3,
  };

  return tierLevels[tier] >= tierLevels[requiredTier];
}
