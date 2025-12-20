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
            Supabase Configuration Required
          </CardTitle>
          <CardDescription>
            Your Supabase backend needs to be configured to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing Supabase Configuration</AlertTitle>
            <AlertDescription>
              Supabase credentials are not configured. Please set up your environment variables.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="font-semibold">To fix this:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Create a <code className="bg-muted px-1 py-0.5 rounded">.env.local</code> file in your project root</li>
              <li>Add your Supabase credentials:
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
# OR use anon key:
VITE_SUPABASE_ANON_KEY=your-anon-key`}
                </pre>
              </li>
              <li>Get these values from your Supabase project: <strong>Settings → API</strong></li>
              <li>Restart your development server</li>
            </ol>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Note:</strong> Make sure <code className="bg-background px-1 py-0.5 rounded">.env.local</code> is in your <code className="bg-background px-1 py-0.5 rounded">.gitignore</code> to keep your credentials secure.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
