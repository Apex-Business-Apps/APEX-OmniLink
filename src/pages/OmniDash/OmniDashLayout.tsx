import { Outlet } from 'react-router-dom';
import { AlertCircle, Activity, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAdminAccess, useOmniDashSettings } from '@/omnidash/hooks';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchHealthSnapshot, updateSettings } from '@/omnidash/api';
import { OMNIDASH_FLAG, OMNIDASH_SAFE_ENABLE_NOTE, OMNIDASH_NAV_ITEMS } from '@/omnidash/types';
import { OmniDashNavIconButton } from '@/components/OmniDashNavIconButton';

export const OmniDashLayout = () => {
  const { user } = useAuth();
  const { isAdmin, loading, featureEnabled } = useAdminAccess();
  const settings = useOmniDashSettings();

  const health = useQuery({
    queryKey: ['omnidash-health', user?.id],
    enabled: !!user && featureEnabled,
    queryFn: async () => {
      if (!user) throw new Error('User missing');
      return fetchHealthSnapshot(user.id);
    },
    refetchInterval: 60_000,
  });

  if (!OMNIDASH_FLAG) {
    return (
      <div className="p-6 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <span>OmniDash is disabled. Set OMNIDASH_ENABLED=1 to enable. {OMNIDASH_SAFE_ENABLE_NOTE}</span>
        </div>
      </div>
    );
  }

  if (loading || settings.isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-6 w-32 bg-muted rounded" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>OmniDash is limited to admin users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Request admin access or add your email to VITE_OMNIDASH_ADMIN_EMAILS.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleSetting = async (key: 'demo_mode' | 'show_connected_ecosystem' | 'anonymize_kpis' | 'freeze_mode', value: boolean) => {
    await updateSettings(user!.id, { [key]: value });
    await settings.refetch();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 border-b bg-background flex items-center px-4 md:px-6">
        <div className="flex items-center justify-between w-full max-w-full">
          {/* Left: Brand */}
          <div className="min-w-0 flex-shrink">
            <h1 className="text-xl font-bold truncate">APEX OmniHub</h1>
          </div>
          {/* Center: Icon Strip */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {OMNIDASH_NAV_ITEMS.map((item) => (
              <OmniDashNavIconButton
                key={item.key}
                to={item.to}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </div>
          {/* Right: Controls */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {health.data?.lastUpdated && (
              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Last updated: {new Date(health.data.lastUpdated).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm hidden sm:inline">Demo</span>
              <Switch
                checked={settings.data?.demo_mode}
                onCheckedChange={(v) => toggleSetting('demo_mode', v)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t flex items-center justify-around py-2 px-4 safe-bottom">
        {OMNIDASH_NAV_ITEMS.map((item) => (
          <OmniDashNavIconButton
            key={item.key}
            to={item.to}
            label={item.label}
            icon={item.icon}
          />
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <Outlet />
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sales Demo Toggles</CardTitle>
                <CardDescription>Controls for redaction and demo stories.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Demo Mode</p>
                    <p className="text-sm text-muted-foreground">Redacts client names, PII, and buckets $ values.</p>
                  </div>
                  <Switch
                    checked={settings.data?.demo_mode}
                    onCheckedChange={(v) => toggleSetting('demo_mode', v)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Connected Ecosystem</p>
                    <p className="text-sm text-muted-foreground">Stub card for ecosystem view (no hub build required).</p>
                  </div>
                  <Switch
                    checked={settings.data?.show_connected_ecosystem}
                    onCheckedChange={(v) => toggleSetting('show_connected_ecosystem', v)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Anonymize KPIs</p>
                    <p className="text-sm text-muted-foreground">Buckets KPI values while in demo mode.</p>
                  </div>
                  <Switch
                    checked={settings.data?.anonymize_kpis}
                    onCheckedChange={(v) => toggleSetting('anonymize_kpis', v)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Freeze switch</p>
                    <p className="text-sm text-muted-foreground">When ON, limit work to bugfix + onboarding only.</p>
                  </div>
                  <Switch
                    checked={settings.data?.freeze_mode}
                    onCheckedChange={(v) => toggleSetting('freeze_mode', v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Connected Ecosystem</CardTitle>
                  <CardDescription>Stubbed for demo storytelling.</CardDescription>
                </div>
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                This card intentionally stubs the connected ecosystem view to keep the hub secure while enabling demo narratives.
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OmniDashLayout;
