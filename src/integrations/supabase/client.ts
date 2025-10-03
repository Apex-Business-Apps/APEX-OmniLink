import { createClient } from '@supabase/supabase-js';

// Multi-fallback environment variable resolution
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  import.meta.env.PUBLIC_SUPABASE_URL;

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Validate credentials with clear error messaging
if (!supabaseUrl || !supabaseAnonKey) {
  const checkedVars = [
    'VITE_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL', 
    'PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  console.error('❌ Missing Supabase credentials. Checked variables:', checkedVars);
  console.error('Missing:', [
    !supabaseUrl ? 'URL' : null,
    !supabaseAnonKey ? 'ANON_KEY' : null
  ].filter(Boolean).join(', '));
  console.info('📋 Setup: Project Settings → Integrations → Cloud → Add Client Variables');
}

// Create client with placeholders if missing (prevents crash, shows setup message)
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: !!supabaseUrl && !!supabaseAnonKey,
    autoRefreshToken: !!supabaseUrl && !!supabaseAnonKey,
  },
});