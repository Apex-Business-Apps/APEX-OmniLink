-- ============================================================================
-- MAN Mode: Manual Approval Node for High-Risk Agent Actions
-- ============================================================================
--
-- This migration creates the man_tasks table for storing approval tasks
-- when an agent action is classified as high-risk (RED lane).
--
-- Key design decisions:
-- 1. idempotency_key prevents duplicate tasks (format: {workflow_id}:{step_id})
-- 2. JSONB for intent/decision allows flexible schema evolution
-- 3. Indexes on hot query paths (pending tasks, workflow lookups)
-- 4. CHECK constraint ensures valid status values
--
-- Idempotency: All statements use IF NOT EXISTS for safe re-runs.
-- ============================================================================

-- UP Migration

-- Create man_tasks table
CREATE TABLE IF NOT EXISTS man_tasks (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Idempotency key prevents duplicate tasks for same workflow step
    -- Format: {workflow_id}:{step_id}
    idempotency_key TEXT UNIQUE NOT NULL,

    -- Workflow reference for lookups and signal routing
    workflow_id TEXT NOT NULL,

    -- Step ID within the workflow plan
    step_id TEXT NOT NULL DEFAULT '',

    -- Task status with CHECK constraint
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED')),

    -- The action requiring approval (ActionIntent as JSONB)
    -- Contains: tool_name, params, irreversible, context
    intent JSONB NOT NULL,

    -- Risk classification result (RiskTriageResult as JSONB)
    -- Contains: lane, reason, risk_factors, suggested_timeout_hours
    triage_result JSONB NOT NULL DEFAULT '{}',

    -- Human decision (ManTaskDecision as JSONB, null until decided)
    -- Contains: status, reason, decided_by, decided_at, metadata
    decision JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,

    -- Who made the decision (denormalized for quick lookups)
    decided_by TEXT
);

-- Add comment to table
COMMENT ON TABLE man_tasks IS
    'MAN Mode approval tasks for high-risk agent actions. '
    'Created when an action is classified as RED lane. '
    'Workflow pauses until human approves or denies.';

-- Index for fetching pending tasks (most common query)
-- Partial index only includes PENDING status for efficiency
CREATE INDEX IF NOT EXISTS idx_man_tasks_pending
    ON man_tasks(status, created_at DESC)
    WHERE status = 'PENDING';

-- Index for workflow lookups (resume workflow after decision)
CREATE INDEX IF NOT EXISTS idx_man_tasks_workflow
    ON man_tasks(workflow_id);

-- Index for audit queries by decision maker
CREATE INDEX IF NOT EXISTS idx_man_tasks_decided_by
    ON man_tasks(decided_by)
    WHERE decided_by IS NOT NULL;

-- Index for expiration checks (cron job to expire old tasks)
CREATE INDEX IF NOT EXISTS idx_man_tasks_expires
    ON man_tasks(expires_at)
    WHERE status = 'PENDING' AND expires_at IS NOT NULL;

-- ============================================================================
-- Row Level Security (RLS) - Optional, enable if using Supabase Auth
-- ============================================================================

-- Enable RLS (uncomment if using Supabase Auth)
-- ALTER TABLE man_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything
-- CREATE POLICY "Service role full access" ON man_tasks
--     FOR ALL
--     TO service_role
--     USING (true)
--     WITH CHECK (true);

-- Policy: Authenticated users can view pending tasks
-- CREATE POLICY "Users can view pending tasks" ON man_tasks
--     FOR SELECT
--     TO authenticated
--     USING (status = 'PENDING');

-- Policy: Only admins can approve/deny (check user role in decision)
-- CREATE POLICY "Admins can update tasks" ON man_tasks
--     FOR UPDATE
--     TO authenticated
--     USING (
--         EXISTS (
--             SELECT 1 FROM auth.users
--             WHERE auth.users.id = auth.uid()
--             AND auth.users.raw_user_meta_data->>'role' = 'admin'
--         )
--     );

-- ============================================================================
-- DOWN Migration (rollback)
-- ============================================================================
-- To rollback, uncomment and run:
--
-- DROP INDEX IF EXISTS idx_man_tasks_expires;
-- DROP INDEX IF EXISTS idx_man_tasks_decided_by;
-- DROP INDEX IF EXISTS idx_man_tasks_workflow;
-- DROP INDEX IF EXISTS idx_man_tasks_pending;
-- DROP TABLE IF EXISTS man_tasks CASCADE;
