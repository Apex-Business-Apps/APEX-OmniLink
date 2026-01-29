import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';
import { AppTile, AppData } from '@/components/AppTile';
const placeholderIcon = '/placeholder.svg';

const Index = () => {
  const navigate = useNavigate();
  const { isInstallable, installPWA } = usePWAInstall();

  const handlePWAInstall = () => {
    installPWA();
    toast.success('Installing APEX App...');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleOpenUrl = (url: string) => {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        navigate('/auth');
      }
    };
    globalThis.addEventListener('keydown', handleKeyPress);
    return () => globalThis.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  const scrollToApps = () => {
    document.getElementById('apps-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  const apps: AppData[] = [
    { name: 'TradeLine 24/7', icon: placeholderIcon, alt: 'TradeLine 24/7 app icon', url: 'https://tradeline247ai.com' },
    { name: 'Built Canadian', icon: placeholderIcon, alt: 'Built Canadian app icon', path: '/apps/built-canadian' },
    { name: 'AutoRepAi', icon: placeholderIcon, alt: 'AutoRepAi app icon', url: 'https://autorepai.ca' },
    { name: 'FLOWBills', icon: placeholderIcon, alt: 'FLOWBills app icon', url: 'https://flowbills.ca' },
    { name: 'RobuxMinerPro', icon: placeholderIcon, alt: 'RobuxMinerPro app icon', url: 'https://robuxminer.pro' },
    { name: 'APEX', icon: placeholderIcon, alt: 'APEX app icon', path: '/dashboard' },
    { name: 'StrideGuide', icon: placeholderIcon, alt: 'StrideGuide app icon', url: 'https://strideguide.cam' },
    { name: 'KeepSafe', icon: placeholderIcon, alt: 'KeepSafe icon', url: 'https://keepsafe.icu' },
    { name: 'JubeeLove', icon: placeholderIcon, alt: 'JubeeLove icon', url: 'https://jubee.love' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="px-4 py-16 md:py-20 lg:py-24 pt-20 md:pt-24 lg:pt-28">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center" data-testid="hero">

            {/* Left Column - Content */}
            <div className="max-w-[560px] space-y-6 lg:space-y-8">
              {/* H1 */}
              <h1 
                className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-[hsl(var(--navy))]"
                data-testid="hero-headline"
              >
                APEX OmniHub
              </h1>

              {/* Subhead */}
              <p 
                className="mt-5 text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl"
                data-testid="hero-subhead"
              >
                Unified tools for work and life.
              </p>

              {/* Proof Chips (Stubbed for visuals) */}
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium text-slate-500">
                 {/*  Add actual proof points here if provided, keeping layout ready */}
              </div>

              {/* CTA Row */}
              <div className="pt-2 flex items-center gap-3">
                <Button
                  size="lg"
                  onClick={scrollToApps}
                  data-testid="hero-cta-primary"
                  className="h-11 px-6 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 transition-all"
                >
                  Explore Apps
                </Button>
                
                {/* Secondary CTA (Placeholder/Optional) */}
                 {/* <Button variant="ghost" ...>Watch Demo</Button> */}
              </div>
            </div>

            {/* Right Column - App Icon Grid */}
            <div className="relative">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-[500px] mx-auto">
                {apps.map((app, index) => (
                  <AppTile
                    key={index}
                    app={app}
                    isInstallable={isInstallable}
                    onInstall={handlePWAInstall}
                    onNavigate={handleNavigate}
                    onOpenUrl={handleOpenUrl}
                    variant="small"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Apps Grid Section */}
      <section id="apps-grid" className="px-4 py-16 md:py-20 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[hsl(var(--navy))] mb-12">
            Our Applications
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {apps.map((app, index) => (
              <AppTile
                key={index}
                app={app}
                isInstallable={isInstallable}
                onInstall={handlePWAInstall}
                onNavigate={handleNavigate}
                onOpenUrl={handleOpenUrl}
                variant="large"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © APEX Business Systems
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
