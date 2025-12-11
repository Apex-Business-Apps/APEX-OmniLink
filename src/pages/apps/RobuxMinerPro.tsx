import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Coins, Zap, Shield, TrendingUp, Trophy, Users } from 'lucide-react';

const placeholderIcon = '/placeholder.svg';

const RobuxMinerPro = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-20 px-4 py-16 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img 
            src={placeholderIcon} 
            alt="RobuxMinerPro"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(var(--navy))] mb-4">
            RobuxMinerPro
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Professional Roblox Gaming Enhancement - Elevate your gameplay with advanced tools and insights
          </p>
          <Button size="lg" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
            Start Mining
          </Button>
        </div>

        {/* Features */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Pro Gaming Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Coins className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Smart Mining</CardTitle>
              <CardDescription>
                Optimize your in-game currency earning with intelligent strategies and automation
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Zap className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Maximize efficiency with cutting-edge performance optimization tools
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Secure & Safe</CardTitle>
              <CardDescription>
                100% compliant with platform guidelines with built-in safety features
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Progress Tracking</CardTitle>
              <CardDescription>
                Monitor your gaming achievements with detailed analytics and insights
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Trophy className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Achievement System</CardTitle>
              <CardDescription>
                Unlock special rewards and track your milestones with our comprehensive system
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Users className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Community Hub</CardTitle>
              <CardDescription>
                Connect with fellow gamers, share strategies, and compete on leaderboards
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-600))] text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Ready to Level Up?</CardTitle>
            <CardDescription className="text-white/80 text-lg">
              Join thousands of pro gamers using RobuxMinerPro
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button size="lg" variant="secondary" className="bg-white text-[hsl(var(--navy))] hover:bg-white/90">
              Get Started Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RobuxMinerPro;
