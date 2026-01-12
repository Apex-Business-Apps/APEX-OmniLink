-- Migration: Create access_requests table
-- Version: 20250111000000
-- Description: Table for storing early access requests with idempotency on email
--
-- IDEMPOTENCY: Uses ON CONFLICT to upsert - duplicate emails update existing record
-- SECURITY: RLS enabled, only anonymous inserts allowed, no reads/updates/deletes
-- ROLLBACK: See bottom of file for rollback SQL

-- Create the access_requests table
CREATE TABLE IF NOT EXISTS public.access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    use_case TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    request_count INTEGER DEFAULT 1 NOT NULL,

    -- Constraints
    CONSTRAINT access_requests_email_key UNIQUE (email),
    CONSTRAINT access_requests_email_check CHECK (
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),
    CONSTRAINT access_requests_name_length CHECK (
        char_length(name) >= 1 AND char_length(name) <= 100
    ),
    CONSTRAINT access_requests_email_length CHECK (
        char_length(email) >= 5 AND char_length(email) <= 254
    ),
    CONSTRAINT access_requests_company_length CHECK (
        company IS NULL OR char_length(company) <= 100
    ),
    CONSTRAINT access_requests_use_case_length CHECK (
        use_case IS NULL OR char_length(use_case) <= 500
    )
);

-- Create index for email lookups (used by upsert)
CREATE INDEX IF NOT EXISTS access_requests_email_idx
    ON public.access_requests (email);

-- Create index for created_at (for admin queries)
CREATE INDEX IF NOT EXISTS access_requests_created_at_idx
    ON public.access_requests (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous users to insert
-- Note: Uses ON CONFLICT for idempotency - see application code
CREATE POLICY "Allow anonymous inserts"
    ON public.access_requests
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Policy: No reads allowed (admin uses service role)
-- Explicitly deny to be clear about intent
CREATE POLICY "Deny anonymous reads"
    ON public.access_requests
    FOR SELECT
    TO anon
    USING (false);

-- Policy: No updates allowed via anon
CREATE POLICY "Deny anonymous updates"
    ON public.access_requests
    FOR UPDATE
    TO anon
    USING (false);

-- Policy: No deletes allowed via anon
CREATE POLICY "Deny anonymous deletes"
    ON public.access_requests
    FOR DELETE
    TO anon
    USING (false);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_access_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.request_count = OLD.request_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on upsert
CREATE TRIGGER access_requests_updated_at_trigger
    BEFORE UPDATE ON public.access_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_access_requests_updated_at();

-- Grant necessary permissions to anon role
GRANT INSERT ON public.access_requests TO anon;

-- Comments for documentation
COMMENT ON TABLE public.access_requests IS
    'Early access request submissions from marketing site. Idempotent on email.';
COMMENT ON COLUMN public.access_requests.email IS
    'Unique email address - used as idempotency key for upserts';
COMMENT ON COLUMN public.access_requests.request_count IS
    'Number of times this email has submitted a request';
COMMENT ON COLUMN public.access_requests.updated_at IS
    'Last request timestamp (auto-updated on upsert)';

-- ============================================================================
-- ROLLBACK SQL (run manually if needed)
-- ============================================================================
-- DROP TRIGGER IF EXISTS access_requests_updated_at_trigger ON public.access_requests;
-- DROP FUNCTION IF EXISTS public.update_access_requests_updated_at();
-- DROP POLICY IF EXISTS "Deny anonymous deletes" ON public.access_requests;
-- DROP POLICY IF EXISTS "Deny anonymous updates" ON public.access_requests;
-- DROP POLICY IF EXISTS "Deny anonymous reads" ON public.access_requests;
-- DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.access_requests;
-- DROP INDEX IF EXISTS access_requests_created_at_idx;
-- DROP INDEX IF EXISTS access_requests_email_idx;
-- DROP TABLE IF EXISTS public.access_requests;
