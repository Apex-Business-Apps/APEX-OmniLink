import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

const Files = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Files</h1>
          <p className="text-muted-foreground">Manage your files and documents</p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload File
        </Button>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No files yet. Upload your first one!</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Files;