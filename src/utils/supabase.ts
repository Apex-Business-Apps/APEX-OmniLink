// Convenience re-export for Supabase client with Lovable-friendly fallbacks.
// The underlying client handles VITE_SUPABASE_PUBLISHABLE_KEY or
// VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY plus the default URL fallback.
export { supabase } from '@/integrations/supabase/client';

