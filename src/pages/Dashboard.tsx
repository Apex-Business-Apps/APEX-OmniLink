import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link2, FileText, Zap, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    links: 0,
    files: 0,
    automations: 0,
    integrations: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      const [linksRes, filesRes, automationsRes, integrationsRes] = await Promise.all([
        supabase.from('links').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('files').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('automations').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('integrations').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setStats({
        links: linksRes.count || 0,
        files: filesRes.count || 0,
        automations: automationsRes.count || 0,
        integrations: integrationsRes.count || 0,
      });
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { title: 'Links', value: stats.links, icon: Link2, color: 'text-blue-500' },
    { title: 'Files', value: stats.files, icon: FileText, color: 'text-green-500' },
    { title: 'Automations', value: stats.automations, icon: Zap, color: 'text-yellow-500' },
    { title: 'Integrations', value: stats.integrations, icon: Package, color: 'text-purple-500' },
  ];

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

export default Dashboard;