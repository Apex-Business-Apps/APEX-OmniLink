import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

/**
 * DEPRECATED: Apex Assistant has been moved to omnilink-agent for durable orchestration
 *
 * This function now returns 410 Gone with upgrade instructions.
 * All assistant traffic should flow through omnilink-agent → Orchestrator/Temporal.
 */

serve(async (req) => {
  // Handle CORS preflight with origin validation
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  const requestOrigin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;
  const corsHeaders = buildCorsHeaders(requestOrigin);

  // DEPRECATED: Return 410 Gone with upgrade instructions
  return new Response(
    JSON.stringify({
      error: 'Apex Assistant has been deprecated',
      message: 'Please use omnilink-agent for all assistant requests. The UI has been updated to use the new endpoint.',
      upgrade_instructions: 'No action required - the application has been automatically updated.',
      deprecated_endpoint: 'apex-assistant',
      replacement_endpoint: 'omnilink-agent'
    }),
    {
      status: 410, // Gone
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Deprecated-Endpoint': 'apex-assistant',
        'X-Upgrade-To': 'omnilink-agent'
      }
    }
  );
});
