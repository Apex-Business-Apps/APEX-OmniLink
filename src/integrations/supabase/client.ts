import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// User's own Supabase (highest priority)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Accept multiple key formats for user-provided keys
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const missingEnv = !SUPABASE_URL || !SUPABASE_KEY;

// When env vars are missing
// fall back to a safe stub so the app can render the setup screen
// instead of crashing on import.
function createUnavailableClient() {
  const err = new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
  );

  const reject = async () => {
    throw err;
  };

  const noopSubscription = { unsubscribe: () => {} };

  return {
    auth: {
      getSession: reject,
      signOut: reject,
      onAuthStateChange: () => ({ data: { subscription: noopSubscription } }),
    },
    functions: {
      invoke: reject,
    },
    from: () => ({
      select: reject,
      insert: reject,
      update: reject,
      delete: reject,
      eq: reject,
    }),
  } as unknown as ReturnType<typeof createClient<Database>>;
}

if (missingEnv) {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!SUPABASE_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY');

  if (import.meta.env.DEV) {
    console.warn(
      `⚠️ Supabase env vars missing (${missing.join(
        ', '
      )}). Rendering will degrade to setup screen until provided.`
    );
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = missingEnv
  ? createUnavailableClient()
  : createClient<Database>(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });

// Log which Supabase instance is being used (dev only)
if (import.meta.env.DEV && !missingEnv) {
  console.log('✅ Using Supabase instance:', SUPABASE_URL);
}
