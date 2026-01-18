import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, Key, RefreshCw, Server, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationDef } from '@/omniconnect/core/registry'; // Use explicit path to avoid ambiguity
import { toast } from 'sonner';

interface ConnectorKitProps {
    integration: IntegrationDef;
    onConnect?: () => void;
}

export const ConnectorKit = ({ integration, onConnect }: ConnectorKitProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [generatedKey, setGeneratedKey] = useState<{ key: string; prefix: string } | null>(null);

    const serverUrl = import.meta.env.VITE_SUPABASE_URL || 'https://api.apex-omnihub.com'; // Fallback or env
    const publicUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;

    const handleGenerateKey = async () => {
        setIsLoading(true);
        try {
            // NOTE: The edge function expects the subrouting /keys.
            // We use raw fetch to be safe and precise, relying on the session.

            const session = (await supabase.auth.getSession()).data.session;
            if (!session) {
                toast.error("You must be logged in");
                return;
            }

            const response = await fetch(`${serverUrl}/functions/v1/omnilink-port/keys`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    integration_id: integration.id,
                    name: `${integration.name} Connector`,
                    scopes: integration.scopes
                })
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || responseData.message || 'Failed to generate key');
            }

            setGeneratedKey({
                key: responseData.key,
                prefix: responseData.key_prefix
            });

            toast.success("New API Key generated successfully");
            if (onConnect) onConnect();

        } catch (error: any) {
            console.error('Error generating key:', error);
            toast.error(error.message || 'Failed to generate key');
        } finally {
            setIsLoading(false);
        }
    };

    const config = {
        serverUrl,
        publicUrl,
        authorization: generatedKey ? `Bearer ${generatedKey.key}` : 'Bearer <YOUR_API_KEY>',
        integrationId: integration.id,
    };

    const copyConfig = () => {
        navigator.clipboard.writeText(JSON.stringify(config, null, 2));
        toast.success("Configuration copied to clipboard");
    };

    const copyKey = () => {
        if (generatedKey) {
            navigator.clipboard.writeText(generatedKey.key);
            toast.success("API Key copied to clipboard");
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Server URL</Label>
                        <div className="relative">
                            <Input readOnly value={serverUrl} className="pr-10 bg-muted" />
                            <Server className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">The endpoint for the OmniHub Edge Function.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Public URL</Label>
                        <div className="relative">
                            <Input readOnly value={publicUrl} className="pr-10 bg-muted" />
                            <ExternalLink className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">Your publicly accessible instance URL.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Authentication</Label>
                        <div className="space-y-3">
                            {!generatedKey ? (
                                <div className="flex flex-col gap-2">
                                    <Button onClick={handleGenerateKey} disabled={isLoading} className="w-full">
                                        {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                                        Generate New API Key
                                    </Button>
                                    <p className="text-xs text-muted-foreground text-center">
                                        Generating a key will enable this integration.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                        <AlertTriangle className="h-4 w-4 !text-orange-600 dark:!text-orange-400" />
                                        <AlertTitle>Copy this key immediately</AlertTitle>
                                        <AlertDescription>
                                            We only show this key once. If you lose it, you'll need to regenerate it.
                                        </AlertDescription>
                                    </Alert>
                                    <div className="relative group">
                                        <Input
                                            readOnly
                                            value={generatedKey.key}
                                            className="pr-24 font-mono text-sm bg-muted/50 border-orange-200 dark:border-orange-900"
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="absolute right-1 top-1 h-7"
                                            onClick={copyKey}
                                        >
                                            <Copy className="h-4 w-4 mr-1" /> Copy
                                        </Button>
                                    </div>
                                    <Button onClick={handleGenerateKey} variant="outline" size="sm" className="w-full text-xs h-8">
                                        <RefreshCw className="mr-2 h-3 w-3" />
                                        Regenerate (Rotates Key)
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Card className="bg-muted/30 border-dashed">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span>Quick Configuration</span>
                        <Button variant="outline" size="sm" onClick={copyConfig} disabled={!generatedKey}>
                            <Copy className="h-3 w-3 mr-2" />
                            Copy JSON
                        </Button>
                    </CardTitle>
                    <CardDescription>Use this configuration to connect your external service.</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="text-xs bg-black/90 text-white p-4 rounded-lg overflow-x-auto font-mono">
                        {JSON.stringify(config, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
};
