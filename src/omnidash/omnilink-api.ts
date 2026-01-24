import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/debug-logger';
import type {
  OmniLinkApiKey,
  OmniLinkEntity,
  OmniLinkEvent,
  OmniLinkIntegration,
  OmniLinkOrchestrationRequest,
  OmniLinkRun,
  OmniTraceRunsListResponse,
  OmniTraceRunDetailResponse,
} from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function requireSupabaseUrl(): string {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL is not configured');
  }
  return SUPABASE_URL;
}

export async function fetchOmniLinkIntegrations(userId: string): Promise<OmniLinkIntegration[]> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logError(error, { action: 'omnilink_fetch_integrations' });
    throw error;
  }

  return (data ?? []) as OmniLinkIntegration[];
}

export async function fetchOmniLinkKeys(userId: string): Promise<OmniLinkApiKey[]> {
  const { data, error } = await supabase
    .from('omnilink_api_keys')
    .select('*')
    .eq('tenant_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logError(error, { action: 'omnilink_fetch_keys' });
    throw error;
  }

  return (data ?? []) as OmniLinkApiKey[];
}

export async function createOmniLinkIntegration(userId: string, name: string, type: string): Promise<OmniLinkIntegration> {
  const { data, error } = await supabase
    .from('integrations')
    .insert({ user_id: userId, name, type, status: 'active' })
    .select()
    .single();

  if (error) {
    logError(error, { action: 'omnilink_create_integration' });
    throw error;
  }

  return data as OmniLinkIntegration;
}

export async function createOmniLinkKey(
  integrationId: string,
  name: string,
  scopes: Record<string, unknown>
): Promise<{ key: string; key_prefix: string; warning: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new Error('No authenticated session found');
  }

  const url = `${requireSupabaseUrl()}/functions/v1/omnilink-port/keys`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ integration_id: integrationId, name, scopes }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create key (${response.status}): ${text}`);
  }

  return (await response.json()) as { key: string; key_prefix: string; warning: string };
}

export async function revokeOmniLinkKey(userId: string, keyId: string): Promise<void> {
  const { error } = await supabase.rpc('omnilink_revoke_key', {
    p_key_id: keyId,
    p_user_id: userId,
  });

  if (error) {
    logError(error, { action: 'omnilink_revoke_key' });
    throw error;
  }
}

export async function fetchOmniLinkEvents(userId: string): Promise<OmniLinkEvent[]> {
  const { data, error } = await supabase
    .from('omnilink_events')
    .select('*')
    .eq('tenant_id', userId)
    .order('received_at', { ascending: false })
    .limit(50);

  if (error) {
    logError(error, { action: 'omnilink_fetch_events' });
    throw error;
  }

  return (data ?? []) as OmniLinkEvent[];
}

export async function fetchOmniLinkEntities(userId: string): Promise<OmniLinkEntity[]> {
  const { data, error } = await supabase
    .from('omnilink_entities')
    .select('*')
    .eq('tenant_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    logError(error, { action: 'omnilink_fetch_entities' });
    throw error;
  }

  return (data ?? []) as OmniLinkEntity[];
}

export async function fetchOmniLinkRuns(userId: string): Promise<OmniLinkRun[]> {
  const { data, error } = await supabase
    .from('omnilink_runs')
    .select('*')
    .eq('tenant_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logError(error, { action: 'omnilink_fetch_runs' });
    throw error;
  }

  return (data ?? []) as OmniLinkRun[];
}

export async function fetchOmniLinkApprovals(userId: string): Promise<OmniLinkOrchestrationRequest[]> {
  const { data, error } = await supabase
    .from('omnilink_orchestration_requests')
    .select('*')
    .eq('tenant_id', userId)
    .eq('status', 'waiting_approval')
    .order('created_at', { ascending: false });

  if (error) {
    logError(error, { action: 'omnilink_fetch_approvals' });
    throw error;
  }

  return (data ?? []) as OmniLinkOrchestrationRequest[];
}

export async function decideOmniLinkApproval(
  userId: string,
  requestId: string,
  decision: 'approved' | 'denied'
): Promise<void> {
  const { error } = await supabase.rpc('omnilink_set_approval', {
    p_request_id: requestId,
    p_user_id: userId,
    p_decision: decision,
  });

  if (error) {
    logError(error, { action: 'omnilink_set_approval' });
    throw error;
  }
}

// =============================================================================
// OmniTrace API - Workflow Run Observability
// =============================================================================

/**
 * Fetch OmniTrace runs for the current user via Edge function.
 * Uses authenticated session token for RLS-enforced access.
 */
export async function fetchOmniTraceRuns(limit: number = 50): Promise<OmniTraceRunsListResponse> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new Error('No authenticated session found');
  }

  const url = `${requireSupabaseUrl()}/functions/v1/omni-runs?limit=${limit}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    logError(new Error(`Failed to fetch runs: ${text}`), { action: 'omnitrace_fetch_runs' });
    throw new Error(`Failed to fetch runs (${response.status}): ${text}`);
  }

  return (await response.json()) as OmniTraceRunsListResponse;
}

/**
 * Fetch OmniTrace run detail with events via Edge function.
 */
export async function fetchOmniTraceRunDetail(workflowId: string): Promise<OmniTraceRunDetailResponse> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new Error('No authenticated session found');
  }

  const url = `${requireSupabaseUrl()}/functions/v1/omni-runs/${encodeURIComponent(workflowId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    logError(new Error(`Failed to fetch run detail: ${text}`), { action: 'omnitrace_fetch_run_detail' });
    throw new Error(`Failed to fetch run detail (${response.status}): ${text}`);
  }

  return (await response.json()) as OmniTraceRunDetailResponse;
}
