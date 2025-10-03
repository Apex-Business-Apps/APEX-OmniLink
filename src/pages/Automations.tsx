import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Automations = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Automations</h1>
          <p className="text-muted-foreground">Create and manage your automated workflows</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Automation
        </Button>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No automations yet. Create your first one!</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Automations;