import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { decideOmniLinkApproval, fetchOmniLinkApprovals } from '@/omnidash/omnilink-api';

export const Approvals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const approvalsQuery = useQuery({
    queryKey: ['omnilink-approvals', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      return fetchOmniLinkApprovals(user.id);
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ requestId, decision }: { requestId: string; decision: 'approved' | 'denied' }) => {
      if (!user) throw new Error('User required');
      await decideOmniLinkApproval(user.id, requestId, decision);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omnilink-approvals', user?.id] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approvals</CardTitle>
        <CardDescription>MAN Mode approvals for high-risk orchestrations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {approvalsQuery.data?.map((request) => (
          <div key={request.id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{request.type}</p>
                <p className="text-sm text-muted-foreground">{request.request_type}</p>
              </div>
              <Badge variant="outline">{request.status}</Badge>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => approvalMutation.mutate({ requestId: request.id, decision: 'approved' })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => approvalMutation.mutate({ requestId: request.id, decision: 'denied' })}
              >
                Deny
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default Approvals;
