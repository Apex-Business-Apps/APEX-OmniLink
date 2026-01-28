import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOmniTraceRuns, fetchOmniTraceRunDetail } from '@/omnidash/omnilink-api';
import type { OmniTraceRun, OmniTraceRunDetailResponse } from '@/omnidash/types';
import { Download, Play, Pause, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'secondary',
  completed: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

const EVENT_KIND_COLORS: Record<string, string> = {
  tool: 'bg-blue-100 text-blue-800',
  model: 'bg-purple-100 text-purple-800',
  policy: 'bg-yellow-100 text-yellow-800',
  cache: 'bg-green-100 text-green-800',
  system: 'bg-gray-100 text-gray-800',
};

function truncateWorkflowId(id: string): string {
  if (id.length <= 20) return id;
  return `${id.slice(0, 10)}...${id.slice(-8)}`;
}

function formatPayload(data: Record<string, unknown> | null, maxLength: number = 500): string {
  if (!data) return '(empty)';
  const str = JSON.stringify(data, null, 2);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '\n... (truncated)';
}

function RunDetailPanel({ workflowId }: { workflowId: string }) {
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['omnitrace-run-detail', workflowId],
    queryFn: () => fetchOmniTraceRunDetail(workflowId),
  });

  if (detailQuery.isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading events...</div>;
  }

  if (detailQuery.error) {
    return (
      <div className="text-sm text-destructive p-4">
        Failed to load: {(detailQuery.error as Error).message}
      </div>
    );
  }

  const detail = detailQuery.data as OmniTraceRunDetailResponse;

  // Filter policy events for dedicated view
  const policyEvents = detail.events.filter((e) => e.kind === 'policy');

  // Download replay bundle as JSON
  const handleDownloadBundle = () => {
    const bundle = JSON.stringify(detail.replay_bundle, null, 2);
    const blob = new Blob([bundle], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-${workflowId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Replay bundle downloaded');
  };

  // Auto-play replay (time-travel through events)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPlaying) {
      intervalId = setInterval(() => {
        setReplayIndex((currentIndex) => {
          if (currentIndex >= detail.events.length - 1) {
            setIsPlaying(false);
            return currentIndex;
          }
          return currentIndex + 1;
        });
      }, 500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, detail.events.length]);

  const toggleReplay = () => {
    setIsPlaying(!isPlaying);
  };

  const currentEvent = detail.events[replayIndex];

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      {/* Truncation Warning */}
      {detail.replay_bundle.events_truncated && (
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-900 dark:text-yellow-200">Events Truncated</p>
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              Some events were truncated. Full replay bundle available via API.
            </p>
          </div>
        </div>
      )}

      {/* Replay Controls */}
      {detail.events.length > 0 && (
        <div className="space-y-3 p-4 bg-background rounded-lg border">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Replay Timeline</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleReplay}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Play
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadBundle}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Slider
              value={[replayIndex]}
              onValueChange={(val) => setReplayIndex(val[0])}
              max={detail.events.length - 1}
              step={1}
              className="w-full"
              disabled={isPlaying}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Event {replayIndex + 1} of {detail.events.length}</span>
              <span>{currentEvent?.name}</span>
            </div>
          </div>

          {/* Current Event Detail */}
          {currentEvent && (
            <div className="p-3 bg-muted/50 rounded border">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_KIND_COLORS[currentEvent.kind] ?? EVENT_KIND_COLORS.system
                    }`}
                >
                  {currentEvent.kind}
                </span>
                <span className="font-mono text-sm">{currentEvent.name}</span>
                {currentEvent.latency_ms !== null && (
                  <Badge variant="outline" className="text-xs">
                    {currentEvent.latency_ms}ms
                  </Badge>
                )}
              </div>
              {currentEvent.data_redacted && Object.keys(currentEvent.data_redacted).length > 0 && (
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                  {JSON.stringify(currentEvent.data_redacted, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Policy Decisions (OmniPolicy) */}
      {policyEvents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h4 className="font-medium">Policy Decisions ({policyEvents.length})</h4>
          </div>
          <div className="space-y-2">
            {policyEvents.map((event) => {
              const decision = (event.data_redacted?.decision as string) || undefined;
              const reason = (event.data_redacted?.reason as string) || undefined;
              return (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border ${decision === 'deny'
                    ? 'bg-destructive/10 border-destructive/20'
                    : 'bg-primary/10 border-primary/20'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={decision === 'deny' ? 'destructive' : 'default'}>
                      {decision || 'unknown'}
                    </Badge>
                    <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  {event.data_redacted && Object.keys(event.data_redacted).length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                      {JSON.stringify(event.data_redacted).slice(0, 100)}
                      {Object.keys(event.data_redacted).length > 2 && '...'}
                    </div>
                  )}
                  {reason && (
                    <p className="text-sm text-muted-foreground">{reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Events Timeline */}
      <div>
        <h4 className="font-medium mb-2">All Events ({detail.events.length})</h4>
        {detail.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {detail.events.map((event, idx) => (
              <div
                key={event.id}
                className={`flex items-start gap-2 text-sm border-l-2 pl-3 transition-all ${idx === replayIndex
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/20'
                  }`}
              >
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_KIND_COLORS[event.kind] ?? EVENT_KIND_COLORS.system
                    }`}
                >
                  {event.kind}
                </span>
                <span className="font-mono">{event.name}</span>
                {event.latency_ms !== null && (
                  <span className="text-muted-foreground">{event.latency_ms}ms</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Replay Bundle */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            View Raw Replay Bundle
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 text-xs bg-background p-3 rounded border overflow-x-auto max-h-48 overflow-y-auto">
            {formatPayload(detail.replay_bundle as unknown as Record<string, unknown>, 2000)}
          </pre>
        </CollapsibleContent>
      </Collapsible>

      {/* Output */}
      {detail.run.output_redacted && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              View Output
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 text-xs bg-background p-3 rounded border overflow-x-auto max-h-48 overflow-y-auto">
              {formatPayload(detail.run.output_redacted)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function RunCard({ run }: { run: OmniTraceRun }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={STATUS_COLORS[run.status] ?? 'outline'}>
                  {run.status}
                </Badge>
                <div>
                  <p className="font-mono text-sm">{truncateWorkflowId(run.workflow_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.event_count} events
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm">{new Date(run.created_at).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {run.input_hash.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <RunDetailPanel workflowId={run.workflow_id} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export const Runs = () => {
  const { user } = useAuth();

  const runsQuery = useQuery({
    queryKey: ['omnitrace-runs', user?.id],
    enabled: !!user,
    queryFn: () => fetchOmniTraceRuns(50),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>OmniTrace Runs</CardTitle>
        <CardDescription>
          Workflow execution history with event timeline and replay bundles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {runsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading runs...</p>
        )}

        {runsQuery.error && (
          <p className="text-sm text-destructive">
            Failed to load runs: {(runsQuery.error as Error).message}
          </p>
        )}

        {runsQuery.data?.runs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No workflow runs recorded yet. Runs will appear here once workflows are executed.
          </p>
        )}

        {runsQuery.data?.runs.map((run) => (
          <RunCard key={run.id} run={run} />
        ))}

        {runsQuery.data && (
          <p className="text-xs text-muted-foreground text-right">
            Showing {runsQuery.data.runs.length} of {runsQuery.data.total} runs
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default Runs;
