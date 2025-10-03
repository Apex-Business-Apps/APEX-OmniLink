import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const CloudSetupMessage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Lovable Cloud Setup Required
          </CardTitle>
          <CardDescription>
            Your backend needs to be configured to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing Supabase Configuration</AlertTitle>
            <AlertDescription>
              The Lovable Cloud backend credentials are not configured in your preview environment.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="font-semibold">To fix this:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Open your Lovable project settings</li>
              <li>Navigate to the <strong>Cloud</strong> tab</li>
              <li>Complete the Lovable Cloud setup if you haven't already</li>
              <li>Ensure your Supabase project is properly connected</li>
              <li>Refresh this preview once setup is complete</li>
            </ol>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Note:</strong> Lovable Cloud provides a complete backend with authentication, 
              database, storage, and serverless functions. Once configured, your environment 
              variables will be automatically injected into your preview.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
