import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import tradeline247 from '@/assets/icons/icon-1.svg';
import icon2 from '@/assets/icons/icon-2.svg';
import icon3 from '@/assets/icons/icon-3.svg';
import icon4 from '@/assets/icons/icon-4.svg';
import icon5 from '@/assets/icons/icon-5.svg';
import icon6 from '@/assets/icons/icon-6.svg';
import keepsafeIcon from '@/assets/keepsafe_appicon.svg';
import icon8 from '@/assets/icons/icon-8.svg';
import icon9 from '@/assets/icons/icon-9.svg';
import strideGuide from '@/assets/icons/strideguide.png';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        navigate('/login');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  const scrollToApps = () => {
    document.getElementById('apps-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  const apps = [
    { name: 'TradeLine 24/7', icon: tradeline247, alt: 'TradeLine 24/7 app icon' },
    { name: 'Built Canadian', icon: icon2, alt: 'Built Canadian app icon' },
    { name: 'AutoRepAi', icon: icon3, alt: 'AutoRepAi app icon' },
    { name: 'FLOWBills', icon: icon4, alt: 'FLOWBills app icon' },
    { name: 'RBP', icon: icon5, alt: 'RBP app icon' },
    { name: 'APEX', icon: icon6, alt: 'APEX app icon' },
    { name: 'StrideGuide', icon: strideGuide, alt: 'StrideGuide app icon' },
    { name: 'KeepSafe', icon: keepsafeIcon, alt: 'KeepSafe icon' },
    { name: 'JubeeLove', icon: icon8, alt: 'JubeeLove icon' },
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
              {/* Eyebrow */}
              <p className="text-sm font-medium text-[hsl(var(--navy))] tracking-wide uppercase">
                APEX Business Systems
              </p>

              {/* H1 */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-[hsl(var(--navy))]">
                APEX Business Systems, Apps for Life!
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
                  <div
                    key={index}
                    role="group"
                    aria-label={`${app.name} tile`}
                    className={`aspect-square rounded-xl p-4 flex flex-col items-center justify-center text-center transition-transform hover:scale-105 ${
                      app.icon 
                        ? 'bg-white border-2 border-[hsl(var(--navy))] shadow-lg' 
                        : 'bg-white border-2 border-dashed border-muted-foreground/30'
                    }`}
                  >
                    {app.icon ? (
                      <>
                        <img 
                          src={app.icon} 
                          alt={app.alt}
                          className="w-icon-sm h-icon-sm md:w-icon-md md:h-icon-md mb-2 object-cover rounded-lg"
                        />
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
              <div
                key={index}
                role="group"
                aria-label={`${app.name} tile`}
                className={`aspect-square rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all hover:scale-105 ${
                  app.icon 
                    ? 'bg-white border-2 border-[hsl(var(--navy))] shadow-lg hover:shadow-xl' 
                    : 'bg-white border-2 border-dashed border-muted-foreground/30'
                }`}
              >
                {app.icon ? (
                  <>
                    <img 
                      src={app.icon} 
                      alt={app.alt}
                      className="w-icon-lg h-icon-lg md:w-icon-xl md:h-icon-xl mb-3 object-cover rounded-lg"
                    />
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
