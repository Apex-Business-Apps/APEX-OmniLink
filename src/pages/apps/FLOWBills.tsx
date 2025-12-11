import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { FileText, DollarSign, Clock, BarChart3, Zap, Shield } from 'lucide-react';

const placeholderIcon = '/placeholder.svg';

const FLOWBills = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-20 px-4 py-16 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img 
            src={placeholderIcon} 
            alt="FLOWBills"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(var(--navy))] mb-4">
            FLOWBills
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Streamlined Invoicing & Payment Management - Get paid faster with automated billing and smart payment tracking
          </p>
          <Button size="lg" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
            Start Free Trial
          </Button>
        </div>

        {/* Features */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Powerful Billing Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <FileText className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Smart Invoicing</CardTitle>
              <CardDescription>
                Create professional invoices in seconds with customizable templates and automated numbering
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <DollarSign className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Payment Tracking</CardTitle>
              <CardDescription>
                Monitor all payments in real-time with automatic reconciliation and reminders
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Clock className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Recurring Billing</CardTitle>
              <CardDescription>
                Set up automatic recurring invoices for subscription-based services and retainers
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>
                Comprehensive insights into your cash flow with detailed analytics and forecasting
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Zap className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Quick Payments</CardTitle>
              <CardDescription>
                Accept payments instantly with integrated payment processing and multiple payment methods
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Secure & Compliant</CardTitle>
              <CardDescription>
                Bank-level security with full tax compliance and automated bookkeeping integration
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-600))] text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Ready to Streamline Your Billing?</CardTitle>
            <CardDescription className="text-white/80 text-lg">
              Join businesses that get paid 3x faster with FLOWBills
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button size="lg" variant="secondary" className="bg-white text-[hsl(var(--navy))] hover:bg-white/90">
              Start Your Free Trial
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FLOWBills;
