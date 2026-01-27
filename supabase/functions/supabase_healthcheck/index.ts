import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

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

async function checkOrchestratorConnection(requestId: string, orchestratorUrl?: string): Promise<{ status: 'healthy' | 'degraded' | 'unconfigured'; warning?: string }> {
  if (!orchestratorUrl) {
    console.warn('⚠️ ORCHESTRATOR_URL not configured - skipping orchestrator health check');
    return { status: 'unconfigured', warning: 'ORCHESTRATOR_URL environment variable not set' };
  }

  try {
    const orchestratorResponse = await fetch(`${orchestratorUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!orchestratorResponse.ok) {
      throw new Error(`Orchestrator returned ${orchestratorResponse.status}`);
    }

    const orchestratorHealth = await orchestratorResponse.json();
    if (orchestratorHealth.status !== 'ok') {
      throw new Error('Orchestrator health check failed');
    }
    console.log(`[${requestId}] ✅ Orchestrator health check passed`);
    return { status: 'healthy' };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown orchestrator error';
    console.warn(`[${requestId}] ⚠️ Orchestrator health check failed (non-blocking): ${errorMsg}`);
    return { status: 'degraded', warning: errorMsg };
  }
}

Deno.serve(async (req: Request) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  console.log(`[${requestId}] Health check started`);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
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
    const rateCheck = checkRateLimit(userId ?? 'anonymous');
    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
      console.warn(`[${requestId}] Rate limit exceeded for user ${userId ?? 'anonymous'}`);

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

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Test 1: Database health - lightweight query to emergency_controls table
    const { error: dbError } = await supabase
      .from('emergency_controls')
      .select('id')
      .limit(1);

    if (dbError) {
      console.error('❌ Database health check failed:', dbError);
      return new Response(
        JSON.stringify({
          status: 'error',
          component: 'database',
          error: dbError.message
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test 2: Orchestrator health - check Python service endpoint (NON-BLOCKING)
    const { status: orchestratorStatus, warning: orchestratorWarning } = await checkOrchestratorConnection(requestId, Deno.env.get('ORCHESTRATOR_URL'));

    // Database test passed, orchestrator is non-blocking - Add security headers
    const duration = Date.now() - startTime;
    const overallStatus = orchestratorStatus === 'healthy' ? 'OK' : 'OK_WITH_WARNINGS';
    console.log(`[${requestId}] ✅ Health check passed (${duration}ms) - Status: ${overallStatus}`);

    const securityHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Request-ID': requestId
    };

    const responseBody: Record<string, unknown> = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      components: {
        database: 'healthy',
        orchestrator: orchestratorStatus,
        auth: 'passed'
      },
      requestId
    };

    if (orchestratorWarning) {
      responseBody.warnings = [`orchestrator: ${orchestratorWarning}`];
    }

    return new Response(
      JSON.stringify(responseBody),
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
