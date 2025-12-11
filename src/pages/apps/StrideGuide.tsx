import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { MapPin, Navigation, Users, Target, TrendingUp, Heart } from 'lucide-react';

const placeholderIcon = '/placeholder.svg';

const StrideGuide = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-20 px-4 py-16 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img 
            src={placeholderIcon} 
            alt="StrideGuide"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(var(--navy))] mb-4">
            StrideGuide
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your Personal Fitness Journey Companion - Track, guide, and achieve your health goals with intelligent coaching
          </p>
          <Button size="lg" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
            Start Your Journey
          </Button>
        </div>

        {/* Features */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Features Designed for Success
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <MapPin className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Route Tracking</CardTitle>
              <CardDescription>
                GPS-powered tracking of your walks, runs, and outdoor activities with detailed route analysis
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Navigation className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Smart Guidance</CardTitle>
              <CardDescription>
                AI-powered coaching that adapts to your fitness level and helps you reach your goals
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Users className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Community Support</CardTitle>
              <CardDescription>
                Connect with others on similar journeys, share achievements, and stay motivated together
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Target className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Goal Setting</CardTitle>
              <CardDescription>
                Set personalized fitness goals and track your progress with detailed analytics
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Progress Analytics</CardTitle>
              <CardDescription>
                Comprehensive insights into your fitness journey with charts and milestone tracking
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Heart className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Health Monitoring</CardTitle>
              <CardDescription>
                Track vital health metrics and get personalized recommendations for optimal wellness
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-600))] text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Ready to Transform Your Health?</CardTitle>
            <CardDescription className="text-white/80 text-lg">
              Join thousands who are achieving their fitness goals with StrideGuide
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button size="lg" variant="secondary" className="bg-white text-[hsl(var(--navy))] hover:bg-white/90">
              Get Started Free
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StrideGuide;
