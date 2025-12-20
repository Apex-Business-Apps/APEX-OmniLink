import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config = getConfig();
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    const status = {
      lovable: {
        configured: !!config,
        baseUrl: config?.baseUrl ? '***' : null,
        hasApiKey: !!config?.apiKey,
        hasServiceRoleKey: !!config?.serviceRoleKey,
      },
      supabase: {
        configured: !!(supabaseUrl && supabaseKey),
        url: supabaseUrl ? '***' : null,
      },
      timestamp: new Date().toISOString(),
    };

    // Test Lovable connection if configured
    if (config) {
      try {
        const testResponse = await fetch(`${config.baseUrl}/health`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        status.lovable = {
          ...status.lovable,
          reachable: testResponse.ok,
          status: testResponse.status,
        };
      } catch (error) {
        status.lovable = {
          ...status.lovable,
          reachable: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return new Response(JSON.stringify(status, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'healthcheck_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});



