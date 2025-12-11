import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Camera, FileText, Bell, Lock, Wifi, Heart } from 'lucide-react';

const placeholderIcon = '/placeholder.svg';

const KeepSafe = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-20 px-4 py-16 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img 
            src={placeholderIcon} 
            alt="KeepSafe"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(var(--navy))] mb-4">
            KeepSafe
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Next-Gen Home Protection - Secure Your Entire Life with AI-powered inventory and recall monitoring
          </p>
          <Button size="lg" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
            Get Started
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            2-min setup • No credit card to start • Start free, upgrade anytime
          </p>
        </div>

        {/* Key Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">10,000+</CardTitle>
              <CardDescription>Items Protected</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">99.9%</CardTitle>
              <CardDescription>Uptime</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">500+</CardTitle>
              <CardDescription>Happy Families</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Features */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Built for Maximum Protection
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Camera className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Scan & Store</CardTitle>
              <CardDescription>
                Instantly capture product barcodes and receipts with your camera. Never lose warranty info again.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <FileText className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Digital Binder</CardTitle>
              <CardDescription>
                Export your entire inventory to a professional PDF binder. Perfect for insurance claims.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Bell className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Recall Monitoring</CardTitle>
              <CardDescription>
                Automatic alerts when your items are recalled. Stay informed and keep your family safe.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Lock className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Your data is encrypted and protected. You control your information, always.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Wifi className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Works Offline</CardTitle>
              <CardDescription>
                Access your inventory anytime, anywhere. Progressive web app works without internet.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Heart className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Peace of Mind</CardTitle>
              <CardDescription>
                Track warranties, purchase dates, and values. Be prepared for insurance claims.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Testimonials */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Loved by Thousands
        </h2>
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardDescription className="text-base">
                "KeepSafe saved me thousands when my house was burglarized. Had everything documented for insurance."
              </CardDescription>
              <CardTitle className="text-lg mt-4">Sarah M.</CardTitle>
              <p className="text-sm text-muted-foreground">Homeowner</p>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <CardDescription className="text-base">
                "The recall alerts are amazing. Got notified about a crib recall before it was on the news."
              </CardDescription>
              <CardTitle className="text-lg mt-4">Michael T.</CardTitle>
              <p className="text-sm text-muted-foreground">Parent</p>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <CardDescription className="text-base">
                "So easy to use. Took me 30 minutes to catalog my entire home. Worth every second."
              </CardDescription>
              <CardTitle className="text-lg mt-4">Jessica L.</CardTitle>
              <p className="text-sm text-muted-foreground">Young Professional</p>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-600))] text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Ready to Protect Everything?</CardTitle>
            <CardDescription className="text-white/80 text-lg">
              Join the security revolution. Start cataloging in under 5 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button size="lg" variant="secondary" className="bg-white text-[hsl(var(--navy))] hover:bg-white/90">
              Start Now - It's Free
            </Button>
            <p className="text-white/80 mt-4 text-sm">No credit card • 2min setup</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KeepSafe;
