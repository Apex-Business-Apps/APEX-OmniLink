import { ReactNode, useEffect, useState } from 'react';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useSearchParams } from 'react-router-dom';
import { Smartphone, Monitor } from 'lucide-react';

interface MobileOnlyGateProps {
  children: ReactNode;
}

const TABLET_BREAKPOINT = 1024; // >= 1024px is desktop
const FEATURE_FLAG = import.meta.env.VITE_OMNILINK_MOBILE_ONLY !== 'false';

/**
 * MobileOnlyGate - Enforces mobile/tablet-only access to OmniLink
 *
 * Desktop users see a friendly message unless:
 * - User has admin role (canBypassMobileGate)
 * - Query param ?desktop=1 is present (admin only)
 */
export function MobileOnlyGate({ children }: MobileOnlyGateProps) {
  const isMobile = useIsMobile(); // 768px breakpoint
  const { capabilities, loading } = useCapabilities();
  const [searchParams] = useSearchParams();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= TABLET_BREAKPOINT);
    };

    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Feature flag check - if disabled, always allow access
  if (!FEATURE_FLAG) {
    return <>{children}</>;
  }

  // Loading state - show nothing while checking permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Admin bypass via query param
  const hasDesktopOverride = searchParams.get('desktop') === '1' && capabilities.canBypassMobileGate;

  // Allow if: mobile/tablet, admin, or admin with override
  const shouldAllow = !isDesktop || capabilities.canBypassMobileGate || hasDesktopOverride;

  if (shouldAllow) {
    return <>{children}</>;
  }

  // Desktop block screen
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Monitor className="w-32 h-32" />
          </div>
          <Smartphone className="w-20 h-20 mx-auto relative text-primary" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            OmniLink Mobile
          </h1>
          <p className="text-lg text-muted-foreground">
            Your portal to intelligence
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <div className="bg-muted/30 rounded-lg p-6 space-y-2 border border-border/40">
            <p className="text-sm font-medium">
              OmniLink is optimized for tablet and mobile devices
            </p>
            <p className="text-xs text-muted-foreground">
              Please access from a mobile device or reduce your window size
            </p>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>✓ iOS & Android supported</p>
            <p>✓ Install as PWA for best experience</p>
            <p>✓ Works offline after installation</p>
          </div>
        </div>

        <div className="pt-6 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            Need desktop access?{' '}
            <a
              href="mailto:support@apexbusiness-systems.com"
              className="text-primary hover:underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
