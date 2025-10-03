import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Link2, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="text-center space-y-6 max-w-2xl px-4">
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center">
            <Link2 className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-5xl font-bold">Welcome to OmniLink</h1>
        <p className="text-xl text-muted-foreground">
          Your unified platform for managing links, files, and automations in one place.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Button size="lg" onClick={() => navigate('/auth')}>
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/auth')}>
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
