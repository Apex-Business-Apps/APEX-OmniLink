import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link2, FileText, Zap, Package, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logError } from '@/lib/monitoring';

const Dashboard = () => {
  const { user } = useAuth();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const [linksRes, filesRes, automationsRes, integrationsRes] = await Promise.all([
        supabase.from('links').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('files').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('automations').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('integrations').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      const errors = [linksRes.error, filesRes.error, automationsRes.error, integrationsRes.error].filter(Boolean);
      if (errors.length > 0) {
        throw new Error(errors[0]?.message || 'Failed to fetch statistics');
      }

      return {
        links: linksRes.count || 0,
        files: filesRes.count || 0,
        automations: automationsRes.count || 0,
        integrations: integrationsRes.count || 0,
      };
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
    onError: (error) => {
      logError(error as Error, { action: 'dashboard_stats_fetch', userId: user?.id });
    },
  });

  const statCards = useMemo(() => {
    const defaultStats = { links: 0, files: 0, automations: 0, integrations: 0 };
    const currentStats = stats || defaultStats;
    
    return [
      { title: 'Links', value: currentStats.links, icon: Link2, color: 'text-blue-500' },
      { title: 'Files', value: currentStats.files, icon: FileText, color: 'text-green-500' },
      { title: 'Automations', value: currentStats.automations, icon: Zap, color: 'text-yellow-500' },
      { title: 'Integrations', value: currentStats.integrations, icon: Package, color: 'text-purple-500' },
    ];
  }, [stats]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-destructive">
          <h2 className="text-xl font-semibold mb-2">Error loading dashboard</h2>
          <p>{error instanceof Error ? error.message : 'Failed to load statistics'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default React.memo(Dashboard);