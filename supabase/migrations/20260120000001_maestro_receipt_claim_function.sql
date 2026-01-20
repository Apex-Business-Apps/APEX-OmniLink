-- MAESTRO Receipt Claim Function (Phase 5)
-- Implements atomic receipt claiming for idempotency enforcement

-- Create receipts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.maestro_execution_receipts (
    tenant_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, idempotency_key)
);

-- Enable RLS
ALTER TABLE public.maestro_execution_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own receipts
CREATE POLICY "Users can read own receipts"
ON public.maestro_execution_receipts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Function: Atomic Receipt Claim
-- Returns: { claimed: boolean } - true if claimed, false if already claimed
CREATE OR REPLACE FUNCTION public.maestro_claim_receipt(
    p_tenant_id TEXT,
    p_idempotency_key TEXT,
    p_trace_id TEXT,
    p_action TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Try to insert the receipt
    -- ON CONFLICT DO NOTHING ensures atomicity
    INSERT INTO public.maestro_execution_receipts (
        tenant_id,
        idempotency_key,
        trace_id,
        action,
        user_id
    ) VALUES (
        p_tenant_id,
        p_idempotency_key,
        p_trace_id,
        p_action,
        p_user_id
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

    -- Check if the insert was successful (row was actually inserted)
    -- If affected_rows = 1, we claimed it; if 0, it was already claimed
    IF FOUND THEN
        -- Successfully claimed
        result := json_build_object('claimed', true);
    ELSE
        -- Already claimed (conflict occurred)
        result := json_build_object('claimed', false);
    END IF;

    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.maestro_claim_receipt(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
