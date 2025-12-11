import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Phone, Clock, DollarSign, Shield, Zap, BarChart3 } from 'lucide-react';

const placeholderIcon = '/placeholder.svg';

const TradeLine247 = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-20 px-4 py-16 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img 
            src={placeholderIcon} 
            alt="TradeLine 24/7"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(var(--navy))] mb-4">
            TradeLine 24/7
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your 24/7 AI Receptionist - Never miss a call. Work while you sleep.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline">
              <Phone className="mr-2 h-4 w-4" />
              587-742-8885
            </Button>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">2 hrs</CardTitle>
              <CardDescription>Response Time</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Free</CardTitle>
              <CardDescription>Setup Cost</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">14 days</CardTitle>
              <CardDescription>Trial Period</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">24/7</CardTitle>
              <CardDescription>AI Availability</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Features */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Key Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Clock className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>24/7 Availability</CardTitle>
              <CardDescription>
                AI receptionist that never sleeps, never takes breaks, and handles calls round the clock
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <DollarSign className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>ROI Tracking</CardTitle>
              <CardDescription>
                Track recovered appointments and revenue with detailed analytics and reporting
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Enterprise Security</CardTitle>
              <CardDescription>
                Bank-level security with full compliance and data protection
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Zap className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Instant Setup</CardTitle>
              <CardDescription>
                Get started in just 10 minutes with our streamlined onboarding process
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Call Analytics</CardTitle>
              <CardDescription>
                Comprehensive insights into call patterns, conversion rates, and missed opportunities
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Phone className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Smart Call Routing</CardTitle>
              <CardDescription>
                Intelligent call distribution and appointment scheduling based on your business rules
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Pricing */}
        <Card className="bg-muted/20 border-2 border-[hsl(var(--navy))]">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Flexible Pricing</CardTitle>
            <CardDescription className="text-lg">Choose what works for your business</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Commission Plan</CardTitle>
                <CardDescription>Pay only for successful appointments</CardDescription>
                <div className="text-3xl font-bold text-[hsl(var(--navy))] mt-4">
                  3097% ROI
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
                  Start Zero-Monthly
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Predictable Plan</CardTitle>
                <CardDescription>Fixed monthly rate for consistent budgeting</CardDescription>
                <div className="text-3xl font-bold text-[hsl(var(--navy))] mt-4">
                  1398% ROI
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
                  Choose Predictable
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TradeLine247;
