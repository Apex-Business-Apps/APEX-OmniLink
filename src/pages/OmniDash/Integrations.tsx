import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  createOmniLinkIntegration,
  createOmniLinkKey,
  fetchOmniLinkIntegrations,
  fetchOmniLinkKeys,
  revokeOmniLinkKey,
} from '@/omnidash/omnilink-api';

export const Integrations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [integrationName, setIntegrationName] = useState('');
  const [integrationType, setIntegrationType] = useState('custom');
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [keyName, setKeyName] = useState('Primary');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const integrationsQuery = useQuery({
    queryKey: ['omnilink-integrations', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      return fetchOmniLinkIntegrations(user.id);
    },
  });

  const keysQuery = useQuery({
    queryKey: ['omnilink-keys', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      return fetchOmniLinkKeys(user.id);
    },
  });

  const integrationOptions = useMemo(() => integrationsQuery.data ?? [], [integrationsQuery.data]);

  useEffect(() => {
    if (!selectedIntegration && integrationOptions.length > 0) {
      setSelectedIntegration(integrationOptions[0].id);
    }
  }, [integrationOptions, selectedIntegration]);

  const createIntegrationMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User required');
      if (!integrationName.trim()) throw new Error('Name required');
      return createOmniLinkIntegration(user.id, integrationName.trim(), integrationType.trim());
    },
    onSuccess: (data) => {
      setIntegrationName('');
      setIntegrationType('custom');
      setSelectedIntegration(data.id);
      queryClient.invalidateQueries({ queryKey: ['omnilink-integrations', user?.id] });
      toast({ title: 'Integration created', description: data.name });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIntegration) throw new Error('Select an integration');
      return createOmniLinkKey(selectedIntegration, keyName.trim(), {
        permissions: ['events:write', 'orchestrations:request'],
        constraints: {
          max_rpm: 60,
          max_concurrency: 5,
          max_payload_kb: 256,
        },
      });
    },
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      queryClient.invalidateQueries({ queryKey: ['omnilink-keys', user?.id] });
      toast({ title: 'Key generated', description: data.warning });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      if (!user) throw new Error('User required');
      await revokeOmniLinkKey(user.id, keyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omnilink-keys', user?.id] });
      toast({ title: 'Key revoked' });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Create an integration and mint scoped OmniLink keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Integration name"
              value={integrationName}
              onChange={(event) => setIntegrationName(event.target.value)}
            />
            <Input
              placeholder="Type (custom, webhook, calendar)"
              value={integrationType}
              onChange={(event) => setIntegrationType(event.target.value)}
            />
            <Button onClick={() => createIntegrationMutation.mutate()} disabled={createIntegrationMutation.isPending}>
              Create Integration
            </Button>
          </div>

          <div className="space-y-2">
            {integrationOptions.map((integration) => (
              <div key={integration.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-semibold">{integration.name}</p>
                  <p className="text-sm text-muted-foreground">{integration.type}</p>
                </div>
                <Badge variant="outline">{integration.status ?? 'active'}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Keys are shown once. Store them securely.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
              <SelectTrigger>
                <SelectValue placeholder="Select integration" />
              </SelectTrigger>
              <SelectContent>
                {integrationOptions.map((integration) => (
                  <SelectItem key={integration.id} value={integration.id}>
                    {integration.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Key name"
              value={keyName}
              onChange={(event) => setKeyName(event.target.value)}
            />
            <Button onClick={() => createKeyMutation.mutate()} disabled={createKeyMutation.isPending}>
              Generate Key
            </Button>
          </div>

          {generatedKey && (
            <div className="border rounded-lg p-3 bg-muted">
              <p className="text-sm font-semibold">Copy this key now (shown once):</p>
              <p className="text-sm break-all mt-1">{generatedKey}</p>
            </div>
          )}

          <div className="space-y-2">
            {keysQuery.data?.map((key) => (
              <div key={key.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-semibold">{key.name ?? 'API Key'}</p>
                  <p className="text-sm text-muted-foreground">Prefix: {key.key_prefix}</p>
                </div>
                <Button
                  variant="outline"
                  disabled={!!key.revoked_at}
                  onClick={() => revokeKeyMutation.mutate(key.id)}
                >
                  {key.revoked_at ? 'Revoked' : 'Revoke'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Integrations;
