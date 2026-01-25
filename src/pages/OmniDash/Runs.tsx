import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOmniTraceRuns, fetchOmniTraceRunDetail } from '@/omnidash/omnilink-api';
import type { OmniTraceRun, OmniTraceRunDetailResponse } from '@/omnidash/types';

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

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      {/* Events Timeline */}
      <div>
        <h4 className="font-medium mb-2">Events ({detail.events.length})</h4>
        {detail.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {detail.events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2 text-sm border-l-2 border-muted-foreground/20 pl-3"
              >
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    EVENT_KIND_COLORS[event.kind] ?? EVENT_KIND_COLORS.system
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
        {detail.replay_bundle.events_truncated && (
          <p className="text-xs text-muted-foreground mt-2">
            Events truncated. Full list available via API.
          </p>
        )}
      </div>

      {/* Replay Bundle */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            View Replay Bundle
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
