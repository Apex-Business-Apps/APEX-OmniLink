import { supabase } from '@/integrations/supabase/client';

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
      console.error('Health check failed:', error);
      return {
        status: 'error',
        error: error.message,
      };
    }

    return data as HealthCheckResult;
  } catch (error) {
    console.error('Health check exception:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
