import { supabase } from '@/integrations/supabase/client';
import { logError } from './monitoring';

export interface HealthCheckResult {
  status: 'OK' | 'error';
  timestamp?: string;
  tests?: {
    read: string;
    write: string;
    auth: string;
  };
  error?: string;
  healthCheckId?: string;
}

/**
 * Run a comprehensive health check of the Supabase connection
 * Tests: authentication, read access, and write access
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  try {
    // Call the edge function to run server-side health checks
    const { data, error } = await supabase.functions.invoke('supabase_healthcheck');

    if (error) {
      logError(error, { action: 'health_check_failed' });
      return {
        status: 'error',
        error: error.message,
      };
    }

    return data as HealthCheckResult;
  } catch (error) {
    logError(error as Error, { action: 'health_check_exception' });
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
