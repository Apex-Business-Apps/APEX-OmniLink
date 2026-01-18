import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOmniLinkEvents } from '@/omnidash/omnilink-api';

export const Events = () => {
  const { user } = useAuth();
  const eventsQuery = useQuery({
    queryKey: ['omnilink-events', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      return fetchOmniLinkEvents(user.id);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>OmniLink Events</CardTitle>
        <CardDescription>Latest universal events ingested through the OmniLink port.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {eventsQuery.data?.map((event) => (
          <div key={event.id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{event.type}</p>
                <p className="text-sm text-muted-foreground">{event.source}</p>
              </div>
              <Badge variant="outline">{new Date(event.time).toLocaleString()}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Envelope ID: {event.envelope_id}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default Events;
