import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Flag, Award, Users, MapPin, TrendingUp, Heart } from 'lucide-react';

const placeholderIcon = '/placeholder.svg';

const BuiltCanadian = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-20 px-4 py-16 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img 
            src={placeholderIcon} 
            alt="Built Canadian"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(var(--navy))] mb-4">
            Built Canadian
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Celebrate Canadian Excellence - Discover and support proudly Canadian-made products and businesses
          </p>
          <Button size="lg" className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-600))]">
            Explore Canadian Brands
          </Button>
        </div>

        {/* Features */}
        <h2 className="text-3xl font-bold text-center text-[hsl(var(--navy))] mb-12">
          Why Choose Canadian
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Flag className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Verified Canadian</CardTitle>
              <CardDescription>
                Browse a curated directory of authentically Canadian-made products and services
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Award className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Quality Guaranteed</CardTitle>
              <CardDescription>
                Access premium products meeting Canadian standards of excellence and craftsmanship
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Users className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Support Local</CardTitle>
              <CardDescription>
                Connect directly with Canadian entrepreneurs and businesses making a difference
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <MapPin className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Regional Discovery</CardTitle>
              <CardDescription>
                Explore products and services by province or territory across Canada
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Business Growth</CardTitle>
              <CardDescription>
                Help Canadian businesses thrive with reviews, ratings, and community support
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Heart className="h-12 w-12 text-[hsl(var(--navy))] mb-4" />
              <CardTitle>Community First</CardTitle>
              <CardDescription>
                Join a passionate community dedicated to strengthening the Canadian economy
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-600))] text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Proud to be Canadian</CardTitle>
            <CardDescription className="text-white/80 text-lg">
              Join thousands supporting Canadian businesses and excellence
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button size="lg" variant="secondary" className="bg-white text-[hsl(var(--navy))] hover:bg-white/90">
              Start Exploring
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BuiltCanadian;
