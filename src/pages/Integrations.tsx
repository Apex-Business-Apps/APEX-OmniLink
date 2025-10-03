import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Integrations = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect external services and APIs</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No integrations yet. Add your first one!</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Integrations;