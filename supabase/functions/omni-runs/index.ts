/**
 * OmniTrace Runs API - Edge Function for reading workflow runs
 *
 * Endpoints:
 *   GET /runs?limit=50  -> List runs for authenticated user
 *   GET /runs/:workflow_id -> Get run details with events (replay bundle)
 *
 * Security:
 *   - Requires authenticated Supabase user (no anon access)
 *   - RLS enforces user_id = auth.uid() filter
 *   - CORS fail-closed via shared allowlist
 */

import { buildCorsHeaders, corsErrorResponse, handlePreflight } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabaseClient.ts';

const MAX_RUNS_LIMIT = 100;
const DEFAULT_RUNS_LIMIT = 50;
const MAX_PAYLOAD_DISPLAY_SIZE = 10000; // 10KB max for displayed payload

interface OmniRun {
  id: string;
  workflow_id: string;
  trace_id: string;
  user_id: string | null;
  status: string;
  input_redacted: Record<string, unknown>;
  output_redacted: Record<string, unknown> | null;
  input_hash: string;
  output_hash: string | null;
  event_count: number;
  created_at: string;
  updated_at: string;
}

interface OmniRunEvent {
  id: string;
  workflow_id: string;
  event_key: string;
  kind: string;
  name: string;
  latency_ms: number | null;
  data_redacted: Record<string, unknown>;
  data_hash: string;
  created_at: string;
}

interface RunsListResponse {
  runs: OmniRun[];
  total: number;
  limit: number;
}

interface RunDetailResponse {
  run: OmniRun;
  events: OmniRunEvent[];
  replay_bundle: {
    workflow_id: string;
    input_hash: string;
    output_hash: string | null;
    event_count: number;
    events_truncated: boolean;
  };
}

function parseRoute(pathname: string): { route: string; workflowId: string | null } {
  const segments = pathname.split('/').filter(Boolean);
  const runsIndex = segments.indexOf('omni-runs');
  if (runsIndex === -1) return { route: '', workflowId: null };

  const afterRuns = segments.slice(runsIndex + 1);
  if (afterRuns.length === 0 || afterRuns[0] === 'runs') {
    return { route: 'list', workflowId: null };
  }

  // Check for /runs/:workflow_id pattern
  if (afterRuns[0] === 'runs' && afterRuns[1]) {
    return { route: 'detail', workflowId: afterRuns[1] };
  }

  // Direct /:workflow_id pattern
  return { route: 'detail', workflowId: afterRuns[0] };
}

function truncatePayload(data: Record<string, unknown> | null, maxSize: number): Record<string, unknown> | null {
  if (!data) return null;

  const serialized = JSON.stringify(data);
  if (serialized.length <= maxSize) return data;

  // Return truncated indicator
  return {
    _truncated: true,
    _original_size: serialized.length,
    _preview: serialized.slice(0, 500) + '...',
  };
}

async function getUserFromAuth(req: Request): Promise<{ userId: string; error: null } | { userId: null; error: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { userId: null, error: 'Missing Authorization header' };
  }

  try {
    // Create client with user's auth token
    const supabase = createAnonClient(authHeader);

    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { userId: null, error: error?.message ?? 'Invalid or expired token' };
    }

    return { userId: user.id, error: null };
  } catch (e) {
    return { userId: null, error: `Auth error: ${(e as Error).message}` };
  }
}

async function handleListRuns(
  req: Request,
  userId: string,
  origin: string | null
): Promise<Response> {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(
    Math.max(1, parseInt(limitParam ?? String(DEFAULT_RUNS_LIMIT), 10) || DEFAULT_RUNS_LIMIT),
    MAX_RUNS_LIMIT
  );

  try {
    const supabase = createServiceClient();

    // Query runs for user (RLS would also enforce this, but we're explicit)
    const { data: runs, error, count } = await supabase
      .from('omni_runs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch runs:', error);
      return corsErrorResponse('FETCH_ERROR', 'Failed to fetch runs', 500, origin);
    }

    // Truncate payloads for list view
    const sanitizedRuns = (runs ?? []).map((run) => ({
      ...run,
      input_redacted: truncatePayload(run.input_redacted, MAX_PAYLOAD_DISPLAY_SIZE),
      output_redacted: truncatePayload(run.output_redacted, MAX_PAYLOAD_DISPLAY_SIZE),
    }));

    const response: RunsListResponse = {
      runs: sanitizedRuns,
      total: count ?? sanitizedRuns.length,
      limit,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...buildCorsHeaders(origin),
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    console.error('List runs error:', e);
    return corsErrorResponse('INTERNAL_ERROR', 'Internal server error', 500, origin);
  }
}

async function handleGetRunDetail(
  workflowId: string,
  userId: string,
  origin: string | null
): Promise<Response> {
  try {
    const supabase = createServiceClient();

    // Fetch run with user_id check
    const { data: run, error: runError } = await supabase
      .from('omni_runs')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return corsErrorResponse(
        'NOT_FOUND',
        'Run not found or access denied',
        404,
        origin
      );
    }

    // Fetch events for this run
    const { data: events, error: eventsError } = await supabase
      .from('omni_run_events')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true })
      .limit(500); // Cap events returned

    if (eventsError) {
      console.error('Failed to fetch events:', eventsError);
      return corsErrorResponse('FETCH_ERROR', 'Failed to fetch run events', 500, origin);
    }

    const eventsList = events ?? [];

    // Truncate event data for display
    const sanitizedEvents = eventsList.map((event) => ({
      ...event,
      data_redacted: truncatePayload(event.data_redacted, MAX_PAYLOAD_DISPLAY_SIZE),
    }));

    const response: RunDetailResponse = {
      run: {
        ...run,
        input_redacted: truncatePayload(run.input_redacted, MAX_PAYLOAD_DISPLAY_SIZE),
        output_redacted: truncatePayload(run.output_redacted, MAX_PAYLOAD_DISPLAY_SIZE),
      },
      events: sanitizedEvents,
      replay_bundle: {
        workflow_id: run.workflow_id,
        input_hash: run.input_hash,
        output_hash: run.output_hash,
        event_count: run.event_count,
        events_truncated: eventsList.length >= 500,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...buildCorsHeaders(origin),
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    console.error('Get run detail error:', e);
    return corsErrorResponse('INTERNAL_ERROR', 'Internal server error', 500, origin);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return corsErrorResponse('METHOD_NOT_ALLOWED', 'Only GET requests are allowed', 405, origin);
  }

  // Authenticate user
  const authResult = await getUserFromAuth(req);
  if (authResult.error) {
    return corsErrorResponse('UNAUTHORIZED', authResult.error, 401, origin);
  }

  const userId = authResult.userId!;

  // Parse route
  const url = new URL(req.url);
  const { route, workflowId } = parseRoute(url.pathname);

  // Route to handler
  switch (route) {
    case 'list':
      return handleListRuns(req, userId, origin);

    case 'detail':
      if (!workflowId) {
        return corsErrorResponse('BAD_REQUEST', 'Missing workflow_id', 400, origin);
      }
      return handleGetRunDetail(workflowId, userId, origin);

    default:
      return corsErrorResponse('NOT_FOUND', 'Unknown route', 404, origin);
  }
});
