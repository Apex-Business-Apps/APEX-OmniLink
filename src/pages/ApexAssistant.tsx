import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, ExternalLink } from 'lucide-react';
import VoiceInterface from '@/components/VoiceInterface';

interface ApexResponse {
  summary: string[];
  details: Array<{
    n: number;
    finding: string;
    source_url: string;
  }>;
  next_actions: string[];
  sources_used: string[];
  notes?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  structured?: ApexResponse;
}

const ApexAssistant = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setIsSpeaking] = useState(false);
  const [threadId] = useState(() => crypto.randomUUID()); // Stable per UI session
  const { toast } = useToast();

  const handleVoiceTranscript = (text: string, isFinal: boolean) => {
    if (isFinal) {
      // Add user message when transcript is final
      const userMessage: Message = {
        role: 'user',
        content: text,
      };
      setMessages(prev => [...prev, userMessage]);
    }
  };

  const sendQuery = async () => {
    if (!query.trim()) return;

    const userMessage: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      // Generate traceId (this becomes the agent_run.id)
      const traceId = crypto.randomUUID();

      // Insert into agent_runs with status='queued'
      const { error: insertError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('agent_runs' as any)
        .insert({
          id: traceId,
          thread_id: threadId,
          user_message: query,
          status: 'queued'
        });

      if (insertError) throw insertError;

      // Call omnilink-agent with { query, traceId }
      const { error: invokeError } = await supabase.functions.invoke('omnilink-agent', {
        body: { query, traceId },
      });

      if (invokeError) throw invokeError;

      // Subscribe to realtime updates on this agent_run
      const channel = supabase
        .channel(`agent_run_${traceId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'agent_runs',
            filter: `id=eq.${traceId}`
          },
          (payload) => {
            const updatedRun = payload.new;

            if (updatedRun.status === 'completed' && updatedRun.agent_response) {
              try {
                // Parse the agent_response as structured data
                const structuredResponse = JSON.parse(updatedRun.agent_response);
                const assistantMessage: Message = {
                  role: 'assistant',
                  content: updatedRun.agent_response,
                  structured: structuredResponse,
                };
                setMessages(prev => [...prev, assistantMessage]);

                toast({
                  title: 'APEX Response',
                  description: 'Successfully retrieved knowledge',
                });
              } catch {
                // If not JSON, treat as plain text
                const assistantMessage: Message = {
                  role: 'assistant',
                  content: updatedRun.agent_response,
                };
                setMessages(prev => [...prev, assistantMessage]);
              } finally {
                setLoading(false);
                channel.unsubscribe();
              }
            } else if (updatedRun.status === 'failed') {
              const errorMsg = updatedRun.error_message || 'Agent execution failed';
              toast({
                title: 'Error',
                description: errorMsg,
                variant: 'destructive',
              });
              setLoading(false);
              channel.unsubscribe();
            }
          }
        )
        .subscribe();

    } catch (error: unknown) {
      const errorMsg = error.message || 'Failed to get response from APEX';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const renderStructuredResponse = (response: ApexResponse) => {
    return (
      <div className="space-y-4">
        {response.summary.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Summary</h4>
            <ul className="list-disc list-inside space-y-1">
              {response.summary.map((item, i) => (
                <li key={i} className="text-sm">{item}</li>
              ))}
            </ul>
          </div>
        )}

        {response.details.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Details</h4>
            <div className="space-y-2">
              {response.details.map((detail) => (
                <Card key={detail.n}>
                  <CardContent className="pt-4">
                    <p className="text-sm mb-2">{detail.finding}</p>
                    {detail.source_url && (
                      <a
                        href={detail.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {response.next_actions.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Next Actions</h4>
            <ul className="list-disc list-inside space-y-1">
              {response.next_actions.map((action, i) => (
                <li key={i} className="text-sm">{action}</li>
              ))}
            </ul>
          </div>
        )}

        {response.sources_used.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Sources Used</h4>
            <div className="flex flex-wrap gap-2">
              {response.sources_used.map((source, i) => (
                <Badge key={i} variant="secondary">{source}</Badge>
              ))}
            </div>
          </div>
        )}

        {response.notes && (
          <div>
            <h4 className="font-semibold mb-2">Notes</h4>
            <p className="text-sm text-muted-foreground">{response.notes}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">APEX Assistant</h1>
          <p className="text-muted-foreground">Internal knowledge assistant for Omnilink</p>
        </div>
        <VoiceInterface 
          onTranscript={handleVoiceTranscript}
          onSpeakingChange={setIsSpeaking}
        />
      </div>

      <div className="space-y-4">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Ask APEX about internal knowledge, GitHub issues, PRs, commits, or Canva assets.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge>GitHub Issues</Badge>
                <Badge>Pull Requests</Badge>
                <Badge>Commits</Badge>
                <Badge>Canva Assets</Badge>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {messages.map((message, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {message.role === 'user' ? 'You' : 'APEX'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {message.role === 'user' ? (
                    <p className="text-sm">{message.content}</p>
                  ) : message.structured ? (
                    renderStructuredResponse(message.structured)
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask APEX about internal knowledge..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendQuery();
                  }
                }}
                rows={3}
                disabled={loading}
              />
              <Button
                onClick={sendQuery}
                disabled={loading || !query.trim()}
                size="icon"
                className="h-auto"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use APPROVE[web] to enable web search, APPROVE[ci] for code interpretation
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApexAssistant;
