import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import appIcon from '@/assets/app_icon.svg';
import { Header } from '@/components/Header';
const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showAdminLink = searchParams.get('admin') === '1';
  const [appSlots] = useState(Array.from({
    length: 12
  }, (_, i) => ({
    id: i + 1,
    name: `App ${i + 1}`,
    icon: null
  })));
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
        <div className="text-center space-y-6 max-w-[920px] w-full">
          <div className="flex justify-center mb-8">
            
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
            {appSlots.map(slot => <Card key={slot.id} className="border-dashed border-2 hover:border-muted-foreground/50 transition-colors">
                <CardContent className="p-6 flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                    {slot.icon ? <img src={slot.icon} alt={slot.name} className="w-full h-full object-contain" /> : <span className="text-4xl text-muted-foreground/30">+</span>}
                  </div>
                  <p className="text-sm text-muted-foreground text-center">{slot.name}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="h-8 px-2">
                      {slot.icon ? <RefreshCw className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </Button>
                    {slot.icon && <Button size="sm" variant="ghost" className="h-8 px-2">
                        <Trash2 className="h-3 w-3" />
                      </Button>}
                  </div>
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