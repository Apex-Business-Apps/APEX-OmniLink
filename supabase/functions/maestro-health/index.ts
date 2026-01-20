/**
 * MAESTRO Health Check Edge Function
 *
 * Provides health status for MAESTRO backend services:
 * - Database connectivity (maestro_receipts, maestro_audit, maestro_encrypted_blobs)
 * - Configuration status
 * - System readiness
 *
 * Phase 4: Backend Sync Implementation
 */

import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabaseClient.ts';

/**
 * Health status response
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      message?: string;
      tables?: {
        receipts: boolean;
        audit: boolean;
        encrypted_blobs: boolean;
      };
    };
    configuration: {
      status: 'ok' | 'error';
      message?: string;
    };
  };
}

/**
 * Check database connectivity and table accessibility
 */
async function checkDatabase(): Promise<HealthStatus['checks']['database']> {
  try {
    const supabase = createServiceClient();

    // Check maestro_receipts table
    const { error: receiptsError } = await supabase
      .from('maestro_receipts')
      .select('id')
      .limit(1);

    // Check maestro_audit table
    const { error: auditError } = await supabase
      .from('maestro_audit')
      .select('id')
      .limit(1);

    // Check maestro_encrypted_blobs table
    const { error: blobsError } = await supabase
      .from('maestro_encrypted_blobs')
      .select('id')
      .limit(1);

    const tables = {
      receipts: !receiptsError,
      audit: !auditError,
      encrypted_blobs: !blobsError,
    };

    const allTablesOk = Object.values(tables).every((ok) => ok);

    if (!allTablesOk) {
      const errors = [];
      if (receiptsError) errors.push(`receipts: ${receiptsError.message}`);
      if (auditError) errors.push(`audit: ${auditError.message}`);
      if (blobsError) errors.push(`blobs: ${blobsError.message}`);

      return {
        status: 'error',
        message: `Table errors: ${errors.join(', ')}`,
        tables,
      };
    }

    return {
      status: 'ok',
      tables,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check configuration status
 */
function checkConfiguration(): HealthStatus['checks']['configuration'] {
  try {
    // Check required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return {
        status: 'error',
        message: 'Missing required environment variables',
      };
    }

    return {
      status: 'ok',
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown configuration error',
    };
  }
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Run health checks
    const [database, configuration] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkConfiguration()),
    ]);

    // Determine overall status
    let status: HealthStatus['status'] = 'healthy';
    if (database.status === 'error' || configuration.status === 'error') {
      status = 'unhealthy';
    }

    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        configuration,
      },
    };

    const httpStatus = status === 'healthy' ? 200 : 503;

    return new Response(JSON.stringify(health, null, 2), {
      status: httpStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('MAESTRO health check error:', error);

    const health: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        configuration: {
          status: 'error',
          message: 'Health check failed',
        },
      },
    };

    return new Response(JSON.stringify(health, null, 2), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
