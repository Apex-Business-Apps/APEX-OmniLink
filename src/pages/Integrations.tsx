import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Check, X, MessageCircle, Facebook, Mail, Youtube, Instagram, Music, Zap, Server, Bot, BarChart3, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WalletConnect } from '@/components/WalletConnect';
import { Separator } from '@/components/ui/separator';

interface Integration {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: unknown;
  requiresApiKey: boolean;
  requiresUsername?: boolean;
}

const Integrations = () => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<unknown[]>([]);
  const [formData, setFormData] = useState({
    apiKey: '',
    apiUsername: '',
  });

  const availableIntegrations: Integration[] = [
    { id: '1', name: 'TradeLine 24/7', type: 'tradeline247', description: 'Analytics and business intelligence', icon: BarChart3, requiresApiKey: true },
    { id: '2', name: 'WhatsApp', type: 'whatsapp', description: 'Business messaging platform', icon: MessageCircle, requiresApiKey: true },
    { id: '3', name: 'Facebook', type: 'facebook', description: 'Social media integration', icon: Facebook, requiresApiKey: true },
    { id: '4', name: 'Messenger', type: 'messenger', description: 'Facebook Messenger integration', icon: MessageCircle, requiresApiKey: true },
    { id: '5', name: 'Google Apps', type: 'google', description: 'Google Workspace integration', icon: Mail, requiresApiKey: true },
    { id: '6', name: 'YouTube', type: 'youtube', description: 'Video platform integration', icon: Youtube, requiresApiKey: true },
    { id: '7', name: 'Instagram', type: 'instagram', description: 'Social media integration', icon: Instagram, requiresApiKey: true },
    { id: '8', name: 'TikTok', type: 'tiktok', description: 'Short video platform', icon: Music, requiresApiKey: true },
    { id: '9', name: 'Zapier', type: 'zapier', description: 'Automation platform', icon: Zap, requiresApiKey: true },
    { id: '10', name: 'Klaviyo', type: 'klaviyo', description: 'Email marketing automation', icon: Mail, requiresApiKey: true },
    { id: '11', name: 'Gmail', type: 'gmail', description: 'Email service integration', icon: Mail, requiresApiKey: true },
    { id: '12', name: 'IONOS.ca', type: 'ionos', description: 'Hosting and domain services', icon: Server, requiresApiKey: true, requiresUsername: true },
    { id: '13', name: 'Webnames.ca', type: 'webnames', description: 'Domain management', icon: Globe, requiresApiKey: true, requiresUsername: true },
    { id: '14', name: 'Samsung Apps', type: 'samsung', description: 'Native Samsung integrations', icon: Smartphone, requiresApiKey: false },
    { id: '15', name: 'ChatGPT', type: 'chatgpt', description: 'AI assistant integration', icon: Bot, requiresApiKey: true },
    { id: '16', name: 'Grok', type: 'grok', description: 'AI assistant by xAI', icon: Bot, requiresApiKey: true },
  ];

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

  const isConnected = (type: string) => {
    return connectedIntegrations.some(int => int.type === type);
  };

  const getConnectedIntegration = (type: string) => {
    return connectedIntegrations.find(int => int.type === type);
  };

  const openConnectDialog = (integration: Integration) => {
    setSelectedIntegration(integration);
    setFormData({ apiKey: '', apiUsername: '' });
    setIsDialogOpen(true);
  };

  const testConnection = async (integrationId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { integrationId },
      });

      if (error) throw error;

      if (data.connected) {
        toast.success(data.message || 'Integration is working correctly');
      } else {
        toast.error(data.message || 'Unable to connect to service');
      }

      fetchIntegrations();
    } catch (error: unknown) {
      toast.error(error.message || 'Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntegration) return;
    
    setIsLoading(true);

    try {
      const config: unknown = {};
      if (selectedIntegration.requiresApiKey) {
        config.apiKey = formData.apiKey;
      }
      if (selectedIntegration.requiresUsername) {
        config.apiUsername = formData.apiUsername;
      }

      const { data, error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user?.id,
          name: selectedIntegration.name,
          type: selectedIntegration.type,
          status: 'pending',
          config,
        })
        .select()
        .single();

      if (error) throw error;

      // Test the connection immediately
      await testConnection(data.id);

      setIsDialogOpen(false);
      setFormData({ apiKey: '', apiUsername: '' });
      setSelectedIntegration(null);
      fetchIntegrations();
    } catch (error) {
      console.error('Error connecting integration:', error);
      toast.error('Failed to connect integration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
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
    } catch (error) {
      console.error('Error disconnecting integration:', error);
      toast.error('Failed to disconnect integration');
    }
  };

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
          const Icon = integration.icon;
          
          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
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
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          const connectedInt = getConnectedIntegration(integration.type);
                          if (connectedInt) testConnection(connectedInt.id);
                        }}
                        disabled={isLoading}
                      >
                        Test
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDisconnect(integration)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
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

      {/* Connection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>
              {selectedIntegration?.requiresApiKey 
                ? `Enter your ${selectedIntegration.name} API credentials to connect your account.`
                : `Configure your ${selectedIntegration?.name} integration.`
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConnect} className="space-y-4">
            {selectedIntegration?.requiresUsername && (
              <div className="space-y-2">
                <Label htmlFor="apiUsername">Username / Account ID</Label>
                <Input
                  id="apiUsername"
                  placeholder="Your username or account ID"
                  value={formData.apiUsername}
                  onChange={(e) => setFormData({ ...formData, apiUsername: e.target.value })}
                  required
                />
              </div>
            )}
            {selectedIntegration?.requiresApiKey && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Your API key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Connect Integration'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Integrations;