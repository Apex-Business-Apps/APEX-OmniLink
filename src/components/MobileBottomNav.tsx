import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Plug, Activity, Mic, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCapabilities } from '@/hooks/useCapabilities';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  capability?: keyof typeof capabilities;
}

/**
 * MobileBottomNav - Touch-friendly bottom navigation for mobile/tablet
 * Modern, minimalist design with clear visual hierarchy
 */
export function MobileBottomNav() {
  const location = useLocation();
  const { capabilities } = useCapabilities();

  const navItems: NavItem[] = [
    {
      path: '/omnidash',
      label: 'Dash',
      icon: LayoutDashboard,
      capability: 'canViewOmniDash',
    },
    {
      path: '/integrations',
      label: 'Connect',
      icon: Plug,
      capability: 'canManageIntegrations',
    },
    {
      path: '/omnitrace',
      label: 'Trace',
      icon: Activity,
      capability: 'canViewOmniTrace',
    },
    {
      path: '/agent',
      label: 'Agent',
      icon: Mic,
      capability: 'canUseVoiceAgent',
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  // Filter items based on capabilities
  const visibleItems = navItems.filter((item) => {
    if (!item.capability) return true;
    return capabilities[item.capability];
  });

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/40 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all',
                'min-w-[64px] touch-manipulation',
                active
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              aria-label={item.label}
            >
              <Icon
                className={cn(
                  'w-5 h-5 transition-transform',
                  active && 'scale-110'
                )}
              />
              <span className={cn(
                'text-[10px] font-medium transition-all',
                active && 'text-primary'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
