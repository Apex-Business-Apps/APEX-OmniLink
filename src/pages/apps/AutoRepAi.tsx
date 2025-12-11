import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Car, FileText, CreditCard, Shield, Zap, TrendingUp } from 'lucide-react';

const placeholderIcon = '/placeholder.svg';

const AutoRepAi = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-20 px-4 py-16 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img 
            src={placeholderIcon} 
            alt="AutoRepAi"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(var(--navy))] mb-4">
            AutoRepAi
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Close More Deals. Work Less. Transform your dealership with AI that automates leads, quotes, and credit applications.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline">
              View Live Demo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • Setup in 5 minutes • Cancel anytime
          </p>
        </div>

        {/* Key Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">10K+</CardTitle>
              <CardDescription>Leads Processed</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">95%</CardTitle>
              <CardDescription>Customer Satisfaction</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">3x</CardTitle>
              <CardDescription>Faster Processing</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">24/7</CardTitle>
              <CardDescription>AI Support</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Features */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Everything You Need to Scale
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Car className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>AI Lead Management</CardTitle>
              <CardDescription>
                Intelligent lead capture, scoring, and automated follow-ups that convert prospects into customers
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <FileText className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Smart Quoting</CardTitle>
              <CardDescription>
                Canadian tax calculations, F&I products, and instant secure sharing with customers
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <CreditCard className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Instant Credit Apps</CardTitle>
              <CardDescription>
                FCRA-compliant applications with automated decisioning in seconds, not hours
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Enterprise Security</CardTitle>
              <CardDescription>
                E2EE encryption, CASL/TCPA/GDPR compliance with full audit trails included
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Zap className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Automated Workflows</CardTitle>
              <CardDescription>
                Streamline your entire sales process from first contact to delivery
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Revenue Analytics</CardTitle>
              <CardDescription>
                Real-time insights into your dealership performance and opportunities
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* ROI Calculator CTA */}
        <Card className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-600))] text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Calculate Your ROI</CardTitle>
            <CardDescription className="text-white/80 text-lg">
              See how much more revenue your dealership could generate
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-6">
              <div className="text-5xl font-bold mb-2">$161,438+</div>
              <p className="text-white/80">Potential Additional Monthly Revenue</p>
            </div>
            <Button size="lg" variant="secondary" className="bg-white text-[hsl(var(--navy))] hover:bg-white/90">
              Start Your Free Trial
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AutoRepAi;
