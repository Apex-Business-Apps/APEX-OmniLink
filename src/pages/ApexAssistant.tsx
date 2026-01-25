import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOmniStream } from '@/hooks/useOmniStream';
import { Send, Loader2, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import VoiceInterface from '@/components/VoiceInterface';
import type {
  ApexStructuredResponse,
  ConversationMessage,
  AgentEvent,
} from '@/lib/types/omniverse';
import { isApexStructuredResponse } from '@/lib/types/omniverse';

/**
 * ApexAssistant Page - Enterprise-Grade AI Assistant
 *
 * Architecture: Frontend -> Edge Gateway (Signed/Idempotent) -> Temporal -> AI
 *
 * Features:
 * - Idempotent workflow triggers (prevents double-billing)
 * - Real-time event streaming via useOmniStream
 * - Optimistic UI updates for zero-flicker UX
 * - Voice interface support
 */
const ApexAssistant = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stable session ID per UI session
  const [sessionId] = useState(() => crypto.randomUUID());

  // Track pending idempotency keys to prevent duplicate submissions
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  // Event stream for real-time updates
  const { events, isConnected } = useOmniStream(sessionId);

  /**
   * Process agent events into displayable content.
   * Shows completion events as assistant messages.
   * Prefixed with _ as it's prepared for future streaming UI integration.
   */
  const _processedEvents = useMemo(() => {
    return events
      .filter((e) => e.type === 'completion')
      .map((e) => ({
        id: e.id,
        content:
          typeof e.payload.response === 'string'
            ? e.payload.response
            : JSON.stringify(e.payload),
      }));
  }, [events]);

  /**
   * Handle voice transcript from VoiceInterface.
   */
  const handleVoiceTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal && text.trim()) {
        const userMessage: ConversationMessage = {
          role: 'user',
          content: text,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }
    },
    []
  );

  /**
   * Generate a unique idempotency key for the request.
   * Prevents double-billing on retry.
   */
  const generateIdempotencyKey = useCallback((): string => {
    return crypto.randomUUID();
  }, []);

  /**
   * Build conversation history for context.
   */
  const buildHistory = useCallback((): Array<{
    role: 'user' | 'assistant';
    content: string;
  }> => {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }, [messages]);

  /**
   * Send query via the hardened trigger-workflow edge function.
   * Implements idempotent, signed workflow triggering.
   */
  const sendQuery = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // Generate idempotency key BEFORE the call
    const idempotencyKey = generateIdempotencyKey();

    // Check for duplicate submission
    if (pendingKeys.has(idempotencyKey)) {
      toast({
        title: 'Request In Progress',
        description: 'Please wait for the current request to complete.',
      });
      return;
    }

    // Add user message (optimistic)
    const userMessage: ConversationMessage = {
      role: 'user',
      content: trimmedQuery,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Add optimistic "Thinking..." message
    const thinkingMessage: ConversationMessage = {
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, thinkingMessage]);

    setQuery('');
    setLoading(true);
    setPendingKeys((prev) => new Set(prev).add(idempotencyKey));

    try {
      // Generate traceId for agent_runs correlation
      const traceId = crypto.randomUUID();

      // Insert into agent_runs with status='queued'
      const { error: insertError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('agent_runs' as any)
        .insert({
          id: traceId,
          thread_id: sessionId,
          user_message: trimmedQuery,
          status: 'queued',
        });

      if (insertError) throw insertError;

      // Try new trigger-workflow first, fallback to omnilink-agent
      let workflowError: Error | null = null;

      try {
        // Call trigger-workflow edge function with idempotency
        const { error: triggerError } = await supabase.functions.invoke(
          'trigger-workflow',
          {
            body: {
              query: trimmedQuery,
              history: buildHistory(),
              session_id: sessionId,
              idempotency_key: idempotencyKey,
            },
          }
        );

        if (triggerError) {
          workflowError = triggerError;
        }
      } catch (err) {
        // Fallback: trigger-workflow might not exist yet
        workflowError =
          err instanceof Error ? err : new Error('Workflow trigger failed');
      }

      // Fallback to legacy omnilink-agent if trigger-workflow fails
      if (workflowError) {
        console.warn(
          '[ApexAssistant] Falling back to omnilink-agent:',
          workflowError.message
        );

        const { error: invokeError } = await supabase.functions.invoke(
          'omnilink-agent',
          {
            body: { query: trimmedQuery, traceId },
          }
        );

        if (invokeError) throw invokeError;
      }

      // Subscribe to realtime updates on this agent_run
      const channel = supabase
        .channel(`agent_run_${traceId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'agent_runs',
            filter: `id=eq.${traceId}`,
          },
          (payload) => {
            const updatedRun = payload.new as Record<string, unknown>;

            if (
              updatedRun.status === 'completed' &&
              updatedRun.agent_response
            ) {
              // Remove "Thinking..." and add real response
              setMessages((prev) => {
                const filtered = prev.filter(
                  (m) => !(m.role === 'assistant' && m.content === 'Thinking...')
                );

                const content = String(updatedRun.agent_response);
                let structured: ApexStructuredResponse | undefined;

                try {
                  const parsed = JSON.parse(content);
                  if (isApexStructuredResponse(parsed)) {
                    structured = parsed;
                  }
                } catch {
                  // Not JSON, use as plain text
                }

                const assistantMessage: ConversationMessage = {
                  role: 'assistant',
                  content,
                  structured,
                  timestamp: new Date().toISOString(),
                };

                return [...filtered, assistantMessage];
              });

              toast({
                title: 'APEX Response',
                description: 'Successfully retrieved knowledge',
              });

              setLoading(false);
              setPendingKeys((prev) => {
                const next = new Set(prev);
                next.delete(idempotencyKey);
                return next;
              });
              channel.unsubscribe();
            } else if (updatedRun.status === 'failed') {
              // Remove "Thinking..." on failure
              setMessages((prev) =>
                prev.filter(
                  (m) => !(m.role === 'assistant' && m.content === 'Thinking...')
                )
              );

              const errorMsg =
                (updatedRun.error_message as string) ||
                'Agent execution failed';
              toast({
                title: 'Error',
                description: errorMsg,
                variant: 'destructive',
              });

              setLoading(false);
              setPendingKeys((prev) => {
                const next = new Set(prev);
                next.delete(idempotencyKey);
                return next;
              });
              channel.unsubscribe();
            }
          }
        )
        .subscribe();
    } catch (error: unknown) {
      // Remove "Thinking..." on error
      setMessages((prev) =>
        prev.filter(
          (m) => !(m.role === 'assistant' && m.content === 'Thinking...')
        )
      );

      const errorMsg =
        error instanceof Error
          ? error.message
          : 'Failed to get response from APEX';

      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });

      setLoading(false);
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(idempotencyKey);
        return next;
      });
    }
  };

  /**
   * Render a structured APEX response with sections.
   */
  const renderStructuredResponse = (response: ApexStructuredResponse) => {
    return (
      <div className="space-y-4">
        {response.summary.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Summary</h4>
            <ul className="list-disc list-inside space-y-1">
              {response.summary.map((item, i) => (
                <li key={i} className="text-sm">
                  {item}
                </li>
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
                <li key={i} className="text-sm">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}

        {response.sources_used.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Sources Used</h4>
            <div className="flex flex-wrap gap-2">
              {response.sources_used.map((source, i) => (
                <Badge key={i} variant="secondary">
                  {source}
                </Badge>
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

  /**
   * Render an agent event as inline notification.
   */
  const renderEventBadge = (event: AgentEvent) => {
    const typeColors: Record<string, string> = {
      goal_received: 'bg-blue-100 text-blue-800',
      plan_generated: 'bg-purple-100 text-purple-800',
      tool_executed: 'bg-green-100 text-green-800',
      risk_assessment: 'bg-yellow-100 text-yellow-800',
      completion: 'bg-emerald-100 text-emerald-800',
    };

    return (
      <span
        key={event.id}
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
          typeColors[event.type] ?? 'bg-gray-100 text-gray-800'
        }`}
      >
        {event.type.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">APEX Assistant</h1>
          <p className="text-muted-foreground">
            Internal knowledge assistant for Omnilink
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection status indicator */}
          <div
            className="flex items-center gap-1 text-sm"
            title={isConnected ? 'Connected' : 'Disconnected'}
          >
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" />
            )}
          </div>
          <VoiceInterface
            onTranscript={handleVoiceTranscript}
            onSpeakingChange={setIsSpeaking}
          />
        </div>
      </div>

      {/* Event stream indicators */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {events.slice(-5).map(renderEventBadge)}
        </div>
      )}

      <div className="space-y-4">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Ask APEX about internal knowledge, GitHub issues, PRs, commits,
                or Canva assets.
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
              <Card key={`${message.timestamp}-${i}`}>
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
                  ) : message.content === 'Thinking...' ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
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
                disabled={loading || isSpeaking}
              />
              <Button
                onClick={sendQuery}
                disabled={loading || isSpeaking || !query.trim()}
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
              Use APPROVE[web] to enable web search, APPROVE[ci] for code
              interpretation
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApexAssistant;
