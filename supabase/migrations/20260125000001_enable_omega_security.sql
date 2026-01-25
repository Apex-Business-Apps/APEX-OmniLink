-- Migration: Enable Omega Security for Agent Events
-- Purpose: Create agent_events table with RLS and Realtime enabled
-- Author: APEX CTO
-- Date: 2026-01-25
-- Architecture: Event Sourcing for real-time agent streaming

-- ============================================================================
-- Table: agent_events
-- Stores discrete events from agent execution for real-time streaming
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN (
        'goal_received',
        'plan_generated',
        'tool_executed',
        'risk_assessment',
        'completion'
    )),
    payload JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id TEXT NOT NULL,
    sequence_id INTEGER NOT NULL DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure unique sequence per session for idempotent inserts
    CONSTRAINT agent_events_session_sequence_unique
        UNIQUE (session_id, sequence_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agent_events_session_id
    ON public.agent_events(session_id);

CREATE INDEX IF NOT EXISTS idx_agent_events_user_id
    ON public.agent_events(user_id);

CREATE INDEX IF NOT EXISTS idx_agent_events_timestamp
    ON public.agent_events(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_agent_events_session_sequence
    ON public.agent_events(session_id, sequence_id ASC);

-- ============================================================================
-- Row Level Security (RLS)
-- Authenticated users can only access their own events
-- ============================================================================
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT their own events
CREATE POLICY "Users can view own agent events"
    ON public.agent_events
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own events
CREATE POLICY "Users can create own agent events"
    ON public.agent_events
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Service role has full access (for edge functions)
CREATE POLICY "Service role full access to agent events"
    ON public.agent_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Enable Supabase Realtime
-- Critical: Without this, frontend subscribes to "silence"
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_events;

-- ============================================================================
-- Function: Insert agent event idempotently
-- Prevents duplicate events on retry
-- ============================================================================
CREATE OR REPLACE FUNCTION public.insert_agent_event_idempotent(
    p_session_id TEXT,
    p_sequence_id INTEGER,
    p_type TEXT,
    p_payload JSONB,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    -- Attempt insert, return existing ID on conflict
    INSERT INTO public.agent_events (
        session_id,
        sequence_id,
        type,
        payload,
        user_id
    )
    VALUES (
        p_session_id,
        p_sequence_id,
        p_type,
        p_payload,
        p_user_id
    )
    ON CONFLICT (session_id, sequence_id)
    DO UPDATE SET id = agent_events.id -- No-op update to return existing
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_agent_event_idempotent TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_agent_event_idempotent TO service_role;

-- ============================================================================
-- Comment for documentation
-- ============================================================================
COMMENT ON TABLE public.agent_events IS
    'Stores agent execution events for real-time streaming. '
    'RLS enforced: users see only their own events. '
    'Realtime enabled via supabase_realtime publication.';
