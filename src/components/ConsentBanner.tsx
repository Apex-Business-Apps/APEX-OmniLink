import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'apex-privacy-consent';

export const ConsentBanner = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already given consent
    const hasConsented = localStorage.getItem(CONSENT_KEY);
    if (!hasConsented) {
      // Show banner after a brief delay for better UX
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }));
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      accepted: false,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-description"
    >
      <Card className="max-w-2xl w-full animate-in slide-in-from-bottom-4 duration-300">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <CardTitle id="consent-title">Your Privacy Matters</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDecline}
              aria-label="Close privacy notice"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription id="consent-description" className="pt-2">
            Welcome to APEX Business Systems! Here's how we protect your data:
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="text-primary font-semibold">✓</span>
              <p>Your data never leaves your device unless you explicitly save it to the cloud</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary font-semibold">✓</span>
              <p>All files and links are encrypted and stored securely in your private account</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary font-semibold">✓</span>
              <p>We never sell your data to third parties or use it for advertising</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary font-semibold">✓</span>
              <p>Analytics and telemetry are completely opt-in and anonymized</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            By continuing, you agree to our data practices. You can change your preferences anytime.{' '}
            <Link to="/privacy" className="text-primary hover:underline" onClick={() => setShowBanner(false)}>
              Read our full Privacy Policy
            </Link>
          </p>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button onClick={handleAccept} className="flex-1">
            I Understand
          </Button>
          <Button onClick={handleDecline} variant="outline" className="flex-1">
            Decline
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
