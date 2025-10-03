import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import apexWordmark from '@/assets/apex_wordmark_hero.svg';
import appTradeline247 from '@/assets/app_tradeline247.svg';
import { Header } from '@/components/Header';
const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showAdminLink = searchParams.get('admin') === '1';
  const [appSlots] = useState([
    { id: 1, name: 'TradeLine 24/7', icon: appTradeline247 },
    ...Array.from({ length: 11 }, (_, i) => ({
      id: i + 2,
      name: `App ${i + 2}`,
      icon: null
    }))
  ]);
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
    document.getElementById('our-apps')?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  return <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="flex min-h-screen items-center justify-center px-4 py-20 pt-28">
        <div className="text-center space-y-4 max-w-[920px] w-full">
          <div className="flex justify-center mb-3 md:mb-4">
            <img 
              src={apexWordmark} 
              alt="APEX Business Systems wordmark" 
              className="w-[280px] md:w-[480px] h-auto" 
            />
          </div>
          <h1 className="text-6xl md:text-7xl font-bold leading-tight tracking-tight">
            APEX Business Systems, Apps for Life!
          </h1>
          <p className="text-lg text-muted-foreground">
            Unified tools for work and life.
          </p>
          <div className="pt-4">
            <Button size="lg" onClick={scrollToApps} variant="outline">
              Explore Apps
            </Button>
          </div>
        </div>
      </section>

      {/* Icon Grid Section */}
      <section id="our-apps" className="px-4 py-20 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Apps</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {appSlots.map(slot => <Card 
                key={slot.id} 
                className={slot.icon ? "hover:shadow-lg transition-shadow" : "border-dashed border-2 hover:border-muted-foreground/50 transition-colors"}
              >
                <CardContent className="p-6 flex flex-col items-center gap-4" role="group" aria-label={`${slot.name} app tile`}>
                  <div className={`rounded-lg flex items-center justify-center ${slot.icon ? "w-24 h-24 md:w-32 md:h-32" : "w-24 h-24 bg-muted"}`}>
                    {slot.icon ? (
                      <img 
                        src={slot.icon} 
                        alt={`${slot.name} icon`} 
                        className="w-full h-full object-contain" 
                      />
                    ) : (
                      <span className="text-4xl text-muted-foreground/30">+</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground text-center">{slot.name}</p>
                  {!slot.icon && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-8 px-2">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © APEX Business Systems
            {showAdminLink && <>
                {' · '}
                <button onClick={() => navigate('/login')} className="text-muted-foreground hover:text-foreground underline">
                  Admin
                </button>
              </>}
          </p>
        </div>
      </footer>
    </div>;
};
export default Index;