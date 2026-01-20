-- MAESTRO Schema Migration
-- Defines storage for encrypted client state and audit logs.

-- 1. Encrypted Store (Append-Only per Idempotency Key)
CREATE TABLE IF NOT EXISTS public.maestro_sync_store (
    idempotency_key TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    encrypted_data TEXT NOT NULL, -- Base64 encoded ciphertext
    signature TEXT NOT NULL,      -- Client-side signature
    operation TEXT NOT NULL,      -- 'sync', 'backup', etc.
    client_timestamp BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.maestro_sync_store ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert own maestro data"
ON public.maestro_sync_store
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own data
CREATE POLICY "Users can read own maestro data"
ON public.maestro_sync_store
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


-- 2. Audit Logs (Server-Side)
CREATE TABLE IF NOT EXISTS public.maestro_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    idempotency_key TEXT REFERENCES public.maestro_sync_store(idempotency_key),
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.maestro_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own logs (implicitly via idempotency key ownership if we joined, 
-- but simpler to just allow insert by service role and select by user logic?)
-- Actually, let's keep it simple: Audit logs are mostly for the system. 
-- Users might want to see them. Let's add user_id to logs to make RLS easier.
ALTER TABLE public.maestro_audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Policy: Service role has full access (default)
-- Policy: Users read own logs
CREATE POLICY "Users can read own audit logs"
ON public.maestro_audit_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_maestro_store_user ON public.maestro_sync_store(user_id);
CREATE INDEX IF NOT EXISTS idx_maestro_audit_user ON public.maestro_audit_logs(user_id);
