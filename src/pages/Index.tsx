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
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        navigate('/auth');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left Column - Content */}
            <div className="max-w-[560px] space-y-6 lg:space-y-8">
              {/* H1 */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-[hsl(var(--navy))]">
                APEX OmniHub
              </h1>

              {/* Support Copy */}
              <p className="text-lg text-muted-foreground">
                Unified tools for work and life.
              </p>

              {/* CTA */}
              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={scrollToApps}
                  className="w-full md:w-auto bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))] text-white px-8"
                >
                  Explore Apps
                </Button>
              </div>
            </div>

            {/* Right Column - App Icon Grid */}
            <div className="relative">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-[500px] mx-auto">
                {apps.map((app, index) => (
                  <AppTile
                    key={index}
                    role="group"
                    aria-label={`${app.name} tile`}
                    className={`aspect-square rounded-xl p-4 flex flex-col items-center justify-center text-center transition-transform hover:scale-105 cursor-pointer ${app.icon
                        ? 'bg-white border-2 border-[hsl(var(--navy))] shadow-lg'
                        : 'bg-white border-2 border-dashed border-muted-foreground/30'
                      }`}
                    onClick={() => {
                      if (app.name === 'APEX' && isInstallable) {
                        handlePWAInstall();
                      } else if ('url' in app) {
                        window.open(app.url, '_blank', 'noopener,noreferrer');
                      } else if ('path' in app) {
                        navigate(app.path);
                      }
                    }}
                  >
                    {app.icon ? (
                      <>
                        <div className="relative">
                          <img
                            src={app.icon}
                            alt={app.alt}
                            className="w-icon-sm h-icon-sm md:w-icon-md md:h-icon-md mb-2 object-cover rounded-lg"
                          />
                          {app.name === 'APEX' && isInstallable && (
                            <div className="absolute -top-1 -right-1 bg-[hsl(var(--navy))] text-white rounded-full p-1 shadow-lg animate-pulse">
                              <Download className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs md:text-sm font-medium text-[hsl(var(--navy))]">
                          {app.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs md:text-sm text-muted-foreground">
                        {app.name}
                      </span>
                    )}
                  </div>
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
                role="group"
                aria-label={`${app.name} tile`}
                className={`aspect-square rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all hover:scale-105 cursor-pointer ${app.icon
                    ? 'bg-white border-2 border-[hsl(var(--navy))] shadow-lg hover:shadow-xl'
                    : 'bg-white border-2 border-dashed border-muted-foreground/30'
                  }`}
                onClick={() => {
                  if (app.name === 'APEX' && isInstallable) {
                    handlePWAInstall();
                  } else if ('url' in app) {
                    window.open(app.url, '_blank', 'noopener,noreferrer');
                  } else if ('path' in app) {
                    navigate(app.path);
                  }
                }}
              >
                {app.icon ? (
                  <>
                    <div className="relative">
                      <img
                        src={app.icon}
                        alt={app.alt}
                        className="w-icon-lg h-icon-lg md:w-icon-xl md:h-icon-xl mb-3 object-cover rounded-lg"
                      />
                      {app.name === 'APEX' && isInstallable && (
                        <div className="absolute -top-2 -right-2 bg-[hsl(var(--navy))] text-white rounded-full p-2 shadow-lg animate-pulse">
                          <Download className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm md:text-base font-semibold text-[hsl(var(--navy))]">
                      {app.name}
                    </span>
                  </>
                ) : (
                  <span className="text-sm md:text-base text-muted-foreground font-medium">
                    {app.name}
                  </span>
                )}
              </div>
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
