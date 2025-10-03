import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase credentials are available and log helpful message
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials are missing. Please complete the Lovable Cloud setup.');
  console.info('Go to Project Settings → Cloud to configure your backend.');
}

// Create client with placeholder values if credentials are missing
// This prevents crashes and allows the app to show a helpful error message
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: !!supabaseUrl && !!supabaseAnonKey,
    autoRefreshToken: !!supabaseUrl && !!supabaseAnonKey,
  },
});