import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOmniLinkRuns } from '@/omnidash/omnilink-api';

export const Runs = () => {
  const { user } = useAuth();
  const runsQuery = useQuery({
    queryKey: ['omnilink-runs', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      return fetchOmniLinkRuns(user.id);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orchestration Runs</CardTitle>
        <CardDescription>Queued and executed OmniLink commands/workflows.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {runsQuery.data?.map((run) => (
          <div key={run.id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{run.external_run_id ?? run.id}</p>
                <p className="text-sm text-muted-foreground">Status: {run.status}</p>
              </div>
              <Badge variant="outline">{new Date(run.created_at).toLocaleString()}</Badge>
            </div>
            {run.error_message && (
              <p className="text-sm text-destructive mt-2">{run.error_message}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default Runs;
