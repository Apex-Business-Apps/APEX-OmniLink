import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Test 1: Read operation - get current timestamp
    const { data: timeData, error: timeError } = await supabase
      .rpc('now');

    if (timeError) {
      console.error('❌ Read test failed:', timeError);
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          test: 'read',
          error: timeError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test 2: Write operation - insert health check record
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          test: 'auth',
          error: 'Not authenticated' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: writeData, error: writeError } = await supabase
      .from('health_checks')
      .insert({ user_id: userId, status: 'ok' })
      .select()
      .single();

    if (writeError) {
      console.error('❌ Write test failed:', writeError);
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          test: 'write',
          error: writeError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Both tests passed
    console.log('✅ Health check passed');
    return new Response(
      JSON.stringify({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        tests: {
          read: 'passed',
          write: 'passed',
          auth: 'passed'
        },
        healthCheckId: writeData.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Health check failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
