import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type SupabaseClientOptions = {
  url: string;
  apiKey: string;
  serviceRoleKey?: string;
  debug?: boolean;
};

export function createSupabaseClient(options: SupabaseClientOptions): SupabaseClient<Database> {
  const key = options.serviceRoleKey || options.apiKey;
  const client = createClient<Database>(options.url, key, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  if (options.debug) {
    console.warn('[SupabaseClient] Initialized with URL:', options.url);
  }

  return client;
}
