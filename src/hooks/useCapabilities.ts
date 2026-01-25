import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePaidAccess } from '@/hooks/usePaidAccess';

export interface Capabilities {
  isAdmin: boolean;
  canViewOmniDash: boolean;
  canManageIntegrations: boolean;
  canViewOmniTrace: boolean;
  canReplayOmniTrace: boolean;
  canUseTranslation: boolean;
  canUseVoiceAgent: boolean;
  canViewPolicySummary: boolean;
  canAccessDiagnostics: boolean;
  canBypassMobileGate: boolean;
}

/**
 * Centralized capability/permission hook using role-based access control
 * Replaces email allowlists with database-driven roles
 */
export function useCapabilities() {
  const { user } = useAuth();
  const { tier } = usePaidAccess();

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-capabilities', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Capabilities> => {
      if (!user) {
        return getDefaultCapabilities(false);
      }

      // Check role from database
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) {
        console.error('Failed to fetch user role:', roleError);
        return getDefaultCapabilities(false);
      }

      const isAdmin = roleData?.role === 'admin';

      // Derive capabilities based on role and subscription tier
      return {
        isAdmin,
        canViewOmniDash: isAdmin || ['pro', 'enterprise'].includes(tier),
        canManageIntegrations: isAdmin || ['starter', 'pro', 'enterprise'].includes(tier),
        canViewOmniTrace: isAdmin || ['pro', 'enterprise'].includes(tier),
        canReplayOmniTrace: isAdmin || tier === 'enterprise',
        canUseTranslation: isAdmin || ['starter', 'pro', 'enterprise'].includes(tier),
        canUseVoiceAgent: isAdmin || ['pro', 'enterprise'].includes(tier),
        canViewPolicySummary: isAdmin || ['pro', 'enterprise'].includes(tier),
        canAccessDiagnostics: isAdmin,
        canBypassMobileGate: isAdmin,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    capabilities: data || getDefaultCapabilities(false),
    loading: isLoading,
    error,
  };
}

function getDefaultCapabilities(isAdmin: boolean): Capabilities {
  return {
    isAdmin,
    canViewOmniDash: isAdmin,
    canManageIntegrations: isAdmin,
    canViewOmniTrace: isAdmin,
    canReplayOmniTrace: isAdmin,
    canUseTranslation: isAdmin,
    canUseVoiceAgent: isAdmin,
    canViewPolicySummary: isAdmin,
    canAccessDiagnostics: isAdmin,
    canBypassMobileGate: isAdmin,
  };
}
