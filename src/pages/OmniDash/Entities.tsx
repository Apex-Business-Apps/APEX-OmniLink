import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOmniLinkEntities } from '@/omnidash/omnilink-api';

export const Entities = () => {
  const { user } = useAuth();
  const entitiesQuery = useQuery({
    queryKey: ['omnilink-entities', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      return fetchOmniLinkEntities(user.id);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entities</CardTitle>
        <CardDescription>Universal entity projections for instant demos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entitiesQuery.data?.map((entity) => (
          <div key={entity.id} className="border rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">{entity.display_name ?? entity.external_id}</p>
              <p className="text-sm text-muted-foreground">{entity.entity_type}</p>
            </div>
            <Badge variant="outline">{new Date(entity.updated_at).toLocaleDateString()}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default Entities;
