import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
};

interface AuditEventPayload {
  id: string;
  timestamp: string;
  actorId?: string;
  actionType: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

interface AuditEventEnvelope {
  event: AuditEventPayload;
}

function getEnv(name: string): string | undefined {
  return Deno.env.get(name);
}

function getConfig() {
  const baseUrl = getEnv('LOVABLE_API_BASE') ?? '';
  const apiKey = getEnv('LOVABLE_API_KEY') ?? '';
  const serviceRoleKey = getEnv('LOVABLE_SERVICE_ROLE_KEY');

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl, apiKey, serviceRoleKey };
}

async function requestLovable<T>(
  path: string,
  method: 'GET' | 'POST' = 'POST',
  body?: any
): Promise<T | undefined> {
  const config = getConfig();
  if (!config) {
    return undefined;
  }

  const { baseUrl, apiKey, serviceRoleKey } = config;
  const maxAttempts = 5;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(serviceRoleKey ? { 'X-Service-Role': serviceRoleKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        lastError = new Error(`Lovable request failed (${response.status}): ${text}`);
        if (response.status >= 500 && attempt < maxAttempts) {
          const delay = Math.min(500 * 2 ** (attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }
      return undefined as T;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const delay = Math.min(500 * 2 ** (attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown Lovable client error');
}

async function postAuditEvent(payload: AuditEventPayload): Promise<void> {
  await requestLovable<void>('/audit-events', 'POST', payload);
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Get userId from header
    let userId = req.headers.get('x-user-id');

    // If no userId in header, try to get from Supabase auth
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          userId = user.id;
        } else {
          return unauthorized();
        }
      } else {
        return unauthorized();
      }
    }

    const body = (await req.json()) as AuditEventEnvelope;
    if (!body?.event) {
      return new Response(
        JSON.stringify({ error: 'invalid_payload', message: 'Missing event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = getConfig();
    if (!config) {
      return new Response(
        JSON.stringify({
          error: 'lovable_not_configured',
          message: 'Lovable API credentials not configured',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await postAuditEvent(body.event);
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Lovable audit function error:', error);
    return new Response(
      JSON.stringify({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});



