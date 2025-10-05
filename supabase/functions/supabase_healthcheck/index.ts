import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
};

// Enhanced rate limiting with cleanup
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = { maxRequests: 10, windowMs: 60000 }; // 10 requests per minute

function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let record = rateLimitStore.get(identifier);
  
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
  }
  
  if (record.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetTime };
  }
  
  record.count++;
  rateLimitStore.set(identifier, record);
  return { 
    allowed: true, 
    remaining: RATE_LIMIT.maxRequests - record.count,
    resetAt: record.resetTime 
  };
}

function generateRequestId(): string {
  return `hc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[${requestId}] Health check started`);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    // Get user for rate limiting
    const tempClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });
    const { data: authData } = await tempClient.auth.getUser();
    const userId = authData?.user?.id;

    // Rate limiting check
    if (userId) {
      const rateCheck = checkRateLimit(userId);
      if (!rateCheck.allowed) {
        const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
        console.warn(`[${requestId}] Rate limit exceeded for user ${userId}`);
        
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. Try again later.',
            retryAfter 
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(rateCheck.resetAt).toISOString(),
              'Retry-After': retryAfter.toString(),
              'X-Request-ID': requestId
            } 
          }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

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

    // Test 1: Read operation - simple select guarded by RLS
    const { error: readError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (readError) {
      console.error('❌ Read test failed:', readError);
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          test: 'read',
          error: readError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test 2: Write operation - insert health check record

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

    // Both tests passed - Add security headers
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✅ Health check passed (${duration}ms)`);
    
    const securityHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Request-ID': requestId
    };
    
    return new Response(
      JSON.stringify({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        tests: {
          read: 'passed',
          write: 'passed',
          auth: 'passed'
        },
        healthCheckId: writeData.id,
        requestId
      }),
      { status: 200, headers: securityHeaders }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Health check failed (${duration}ms):`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        error: errorMessage,
        requestId 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        } 
      }
    );
  }
});
