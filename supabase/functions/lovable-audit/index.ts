import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { createAnonClient, createServiceClient } from "../_shared/supabaseClient.ts";

interface AuditEventPayload {
  id: string;
  timestamp: string;
  actorId?: string;
  actionType: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

interface AuditEventEnvelope {
  event: AuditEventPayload;
}

/**
 * Write audit event directly to Supabase audit_logs table
 * Replaces Lovable API dependency
 */
async function writeAuditEvent(payload: AuditEventPayload): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('audit_logs').insert({
    id: payload.id,
    actor_id: payload.actorId || null,
    action_type: payload.actionType,
    resource_type: payload.resourceType || null,
    resource_id: payload.resourceId || null,
    metadata: payload.metadata || null,
    created_at: payload.timestamp,
  });

  if (error) {
    throw new Error(`Failed to write audit log: ${error.message}`);
  }
}

function unauthorized(corsHeaders: HeadersInit): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
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
        const supabase = createAnonClient(authHeader);
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          userId = user.id;
        } else {
          return unauthorized(corsHeaders);
        }
      } else {
        return unauthorized(corsHeaders);
      }
    }

    const body = (await req.json()) as AuditEventEnvelope;
    if (!body?.event) {
      return new Response(
        JSON.stringify({ error: 'invalid_payload', message: 'Missing event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await writeAuditEvent(body.event);
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


