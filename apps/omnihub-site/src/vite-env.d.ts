/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_REQUEST_ACCESS: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MAESTRO_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
