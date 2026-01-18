import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

type ClientMode = 'service' | 'anon';

function getEnvOrThrow(name: string, mode: ClientMode): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} not configured for ${mode} client`);
  }
  return value;
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = getEnvOrThrow('SUPABASE_URL', 'service');
  const supabaseServiceKey = getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY', 'service');
  return createClient(supabaseUrl, supabaseServiceKey);
}

export function createAnonClient(authHeader?: string): SupabaseClient {
  const supabaseUrl = getEnvOrThrow('SUPABASE_URL', 'anon');
  const supabaseKey = getEnvOrThrow('SUPABASE_ANON_KEY', 'anon');
  return createClient(supabaseUrl, supabaseKey, authHeader
    ? { global: { headers: { Authorization: authHeader } } }
    : undefined);
}
