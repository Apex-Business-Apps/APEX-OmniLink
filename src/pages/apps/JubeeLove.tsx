import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Heart, Calendar, MessageCircle, Gift, Users, Star } from 'lucide-react';

const placeholderIcon = '/placeholder.svg';

const JubeeLove = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-20 px-4 py-16 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img 
            src={placeholderIcon} 
            alt="JubeeLove"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(var(--navy))] mb-4">
            JubeeLove
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Celebrate Every Moment - Plan, organize, and cherish life's special occasions with the ones you love
          </p>
          <Button size="lg" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
            Start Celebrating
          </Button>
        </div>

        {/* Features */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Features for Every Occasion
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Heart className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Relationship Tracking</CardTitle>
              <CardDescription>
                Keep track of important dates, anniversaries, and milestones with smart reminders
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Calendar className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Event Planning</CardTitle>
              <CardDescription>
                Plan perfect celebrations with integrated calendars, guest lists, and to-do management
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <MessageCircle className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Memory Sharing</CardTitle>
              <CardDescription>
                Share photos, messages, and moments with loved ones in private, secure spaces
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Gift className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Gift Registry</CardTitle>
              <CardDescription>
                Create and manage gift wishlists for any occasion with easy sharing options
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Users className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Family Hub</CardTitle>
              <CardDescription>
                Connect with family members and coordinate celebrations together
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Star className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Special Moments</CardTitle>
              <CardDescription>
                Create lasting memories with digital scrapbooks and timeline features
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-600))] text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Make Every Moment Count</CardTitle>
            <CardDescription className="text-white/80 text-lg">
              Join families celebrating life's beautiful moments with JubeeLove
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button size="lg" variant="secondary" className="bg-white text-[hsl(var(--navy))] hover:bg-white/90">
              Start Your Journey
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JubeeLove;
