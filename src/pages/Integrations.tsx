/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WalletConnect } from '@/components/WalletConnect';
import { Separator } from '@/components/ui/separator';
import { availableIntegrations, IntegrationDef } from '../omniconnect/core/registry';
import { ConnectorKit } from '@/components/ConnectorKit';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Json } from '@/integrations/supabase/types';

interface ConnectedIntegration {
  id: string;
  name: string;
  type: string;
  status: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Json;
  created_at?: string | null;
}

const Integrations = () => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationDef | null>(null);
  const [connectedIntegrations, setConnectedIntegrations] = useState<ConnectedIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form data for external keys (outbound)
  const [formData, setFormData] = useState({
    apiKey: '',
    apiUsername: '',
  });

  const fetchIntegrations = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id);

    if (!error && data) {
      setConnectedIntegrations(data);
    }
  }, [user]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const getConnectedIntegration = (type: string) => {
    return connectedIntegrations.find(int => int.type === type);
  };

  const isConnected = (type: string) => {
    return !!getConnectedIntegration(type);
  };

  const openConnectDialog = (integration: IntegrationDef) => {
    setSelectedIntegration(integration);
    setFormData({ apiKey: '', apiUsername: '' });
    setIsDialogOpen(true);
  };

  const handleCreateIntegration = async () => {
    if (!selectedIntegration || !user) return;
    setIsLoading(true);
    try {
      const config: { apiKey?: string; apiUsername?: string } = {};
      // If we have form data filled, include it
      if (formData.apiKey) config.apiKey = formData.apiKey;
      if (formData.apiUsername) config.apiUsername = formData.apiUsername;

      const { error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          name: selectedIntegration.name,
          type: selectedIntegration.type,
          status: 'active', // Default to active so we can generate keys
          config,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchIntegrations(); // Refresh list to get the new UUID
      toast.success("Integration enabled");
    } catch (error: unknown) {
      console.error("Error creating integration:", error);
      toast.error("Failed to enable integration");
    } finally {
      setIsLoading(false);
    }
  }

  const handleDisconnect = async (integration: IntegrationDef) => {
    const connected = getConnectedIntegration(integration.type);
    if (!connected) return;

    try {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', connected.id);

      if (error) throw error;

      toast.success(`${integration.name} integration disconnected`);
      fetchIntegrations();
    } catch (error: unknown) {
      console.error('Error disconnecting integration:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const currentDbRecord = selectedIntegration ? getConnectedIntegration(selectedIntegration.type) : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Connect external services and APIs to enhance your workflow</p>
      </div>

      {/* Web3 Wallet Integration */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Web3 Wallet</h2>
          <p className="text-sm text-muted-foreground">Connect your crypto wallet for NFT-gated features and blockchain verification</p>
        </div>
        <div className="flex justify-center md:justify-start">
          <WalletConnect />
        </div>
      </div>

      <Separator className="my-8" />

      <div>
        <h2 className="text-xl font-semibold mb-4">External Services</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {availableIntegrations.map((integration) => {
          const connected = isConnected(integration.type);
          // Cast icon for rendering
          const Icon = integration.icon;

          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {Icon && <Icon className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                    </div>
                  </div>
                  {connected && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <CardDescription className="text-xs mt-2">
                  {integration.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {connected ? (
                    <div className="flex gap-2 w-full">
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="outline"
                        onClick={() => openConnectDialog(integration)}
                      >
                        Configure
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnect(integration)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => openConnectDialog(integration)}
                      disabled={isLoading}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connection / Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentDbRecord ? `Configure ${selectedIntegration?.name}` : `Connect ${selectedIntegration?.name}`}</DialogTitle>
            <DialogDescription>
              {currentDbRecord
                ? "Manage your integration keys and settings."
                : "Enable this integration to generate keys and connect."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {selectedIntegration && (
              <>
                {/* Pre-connection: Ask for external keys if required and NOT connected yet */}
                {!currentDbRecord && (selectedIntegration.requiresApiKey || selectedIntegration.requiresUsername) && (
                  <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                    <h4 className="font-semibold text-sm">External Credentials (Optional)</h4>
                    <p className="text-xs text-muted-foreground">If you have existing credentials, enter them here. Otherwise, you can skip this to just use the Universal Port.</p>

                    {selectedIntegration.requiresUsername && (
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          value={formData.apiUsername}
                          onChange={e => setFormData({ ...formData, apiUsername: e.target.value })}
                          placeholder="Username"
                        />
                      </div>
                    )}
                    {selectedIntegration.requiresApiKey && (
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          value={formData.apiKey}
                          onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                          placeholder="API Key"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Main State Logic */}
                {currentDbRecord ? (
                  // Connected: Show ConnectorKit (Inbound) + Config
                  <div className="space-y-6">
                    {/* Pass the DB Record ID to ConnectorKit */}
                    <ConnectorKit
                      integration={{ ...selectedIntegration, id: currentDbRecord.id }}
                      onConnect={fetchIntegrations}
                    />
                  </div>
                ) : (
                  // Not Connected: Show Enable Button
                  <div className="flex flex-col gap-4">
                    <Button onClick={handleCreateIntegration} disabled={isLoading} className="w-full">
                      {isLoading ? "Enabling..." : `Enable ${selectedIntegration.name}`}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Enabling will create an integration record and allow you to generate access keys.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Integrations;
