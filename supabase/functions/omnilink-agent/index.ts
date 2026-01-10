import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests with origin validation
  if (req.method === "OPTIONS") {
    return handlePreflight(req);
  }

  const origin = req.headers.get('origin');

  try {
    // Auth validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Auth');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data: { user }, error } = await supabase.auth.getUser(authHeader);

    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          ...buildCorsHeaders(origin),
          "Content-Type": "application/json",
        },
      });
    }

    // Parse request
    const { query, traceId } = await req.json();

    // Handoff to orchestrator
    const orchestratorUrl = Deno.env.get('ORCHESTRATOR_URL');
    if (!orchestratorUrl) {
      throw new Error('System Misconfiguration: ORCHESTRATOR_URL missing');
    }

    const response = await fetch(`${orchestratorUrl}/api/v1/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        user_intent: query,
        trace_id: traceId
      })
    });

    // Return orchestrator response directly
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: {
        ...buildCorsHeaders(origin),
        "Content-Type": "application/json",
      },
    });

  } catch (err) {
    console.error('Router error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        ...buildCorsHeaders(origin),
        "Content-Type": "application/json",
      },
    });
  }
});
