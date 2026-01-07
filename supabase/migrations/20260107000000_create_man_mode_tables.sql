-- Create MAN Mode tables for human override workflow approvals
-- Migration: 20260107000000_create_man_mode_tables

-- Enable RLS
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================================
-- MAN TASKS TABLE
-- ============================================================================

-- Table for pending manual approval tasks
CREATE TABLE IF NOT EXISTS man_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    run_id TEXT NULL,
    step_id TEXT NULL,
    tool_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,

    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DENIED', 'MODIFIED', 'EXPIRED', 'CANCELLED')),
    risk_score NUMERIC NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    risk_reasons JSONB NOT NULL DEFAULT '[]',

    intent JSONB NOT NULL, -- Redacted action intent

    reviewer_id TEXT NULL,
    decision JSONB NULL, -- Decision details with optional modified_params

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_man_tasks_tenant_status_created
    ON man_tasks (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_man_tasks_workflow_run
    ON man_tasks (workflow_id, run_id);

CREATE INDEX IF NOT EXISTS idx_man_tasks_idempotency
    ON man_tasks (idempotency_key);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_man_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_man_tasks_updated_at
    BEFORE UPDATE ON man_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_man_tasks_updated_at();

-- ============================================================================
-- MAN POLICIES TABLE
-- ============================================================================

-- Table for configurable MAN Mode policies
CREATE TABLE IF NOT EXISTS man_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NULL, -- NULL for global default
    workflow_key TEXT NULL, -- NULL for tenant-wide default
    policy_json JSONB NOT NULL,
    version TEXT NOT NULL DEFAULT '1',
    updated_by TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one effective policy per scope
    UNIQUE (tenant_id, workflow_key)
);

-- Index for policy lookups
CREATE INDEX IF NOT EXISTS idx_man_policies_lookup
    ON man_policies (tenant_id, workflow_key);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_man_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_man_policies_updated_at
    BEFORE UPDATE ON man_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_man_policies_updated_at();

-- ============================================================================
-- MAN DECISION EVENTS (Optional Append-Only Audit)
-- ============================================================================

-- Append-only table for decision events (immutable audit trail)
CREATE TABLE IF NOT EXISTS man_decision_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES man_tasks(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'DENY', 'MODIFY', 'CANCEL_WORKFLOW')),
    reviewer_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    modified_params JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_man_decision_events_task
    ON man_decision_events (task_id);

CREATE INDEX IF NOT EXISTS idx_man_decision_events_tenant_created
    ON man_decision_events (tenant_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE man_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE man_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE man_decision_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for man_tasks
-- Service role can do everything
CREATE POLICY "man_tasks_service_role_all" ON man_tasks
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can select their own tenant's tasks
CREATE POLICY "man_tasks_select_own_tenant" ON man_tasks
    FOR SELECT USING (
        auth.role() = 'authenticated' AND
        tenant_id = auth.jwt() ->> 'tenant_id'
    );

-- Operators can update decision on tasks in their tenant
CREATE POLICY "man_tasks_update_decision" ON man_tasks
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND
        tenant_id = auth.jwt() ->> 'tenant_id' AND
        auth.jwt() ->> 'role' = 'operator'
    )
    WITH CHECK (
        auth.role() = 'authenticated' AND
        tenant_id = auth.jwt() ->> 'tenant_id' AND
        auth.jwt() ->> 'role' = 'operator'
    );

-- RLS Policies for man_policies
-- Service role can do everything
CREATE POLICY "man_policies_service_role_all" ON man_policies
    FOR ALL USING (auth.role() = 'service_role');

-- Operators can manage policies for their tenant
CREATE POLICY "man_policies_operator_manage" ON man_policies
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        auth.jwt() ->> 'role' = 'operator' AND
        (tenant_id = auth.jwt() ->> 'tenant_id' OR tenant_id IS NULL)
    );

-- RLS Policies for man_decision_events
-- Service role can do everything
CREATE POLICY "man_decision_events_service_role_all" ON man_decision_events
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read events for their tenant
CREATE POLICY "man_decision_events_select_own_tenant" ON man_decision_events
    FOR SELECT USING (
        auth.role() = 'authenticated' AND
        tenant_id = auth.jwt() ->> 'tenant_id'
    );

-- ============================================================================
-- DEFAULT GLOBAL POLICY
-- ============================================================================

-- Insert default global policy if it doesn't exist
INSERT INTO man_policies (tenant_id, workflow_key, policy_json, version)
VALUES (
    NULL, -- Global default
    NULL, -- All workflows
    '{
        "global_thresholds": {"red": 0.8, "yellow": 0.5},
        "tool_minimum_lanes": {},
        "hard_triggers": {},
        "per_workflow_overrides": {},
        "max_pending_per_tenant": 50,
        "task_ttl_minutes": 1440,
        "degrade_behavior": "BLOCK_NEW"
    }'::jsonb,
    '1.0'
)
ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON man_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON man_policies TO authenticated;
GRANT SELECT, INSERT ON man_decision_events TO authenticated;

-- Service role has full access
GRANT ALL ON man_tasks TO service_role;
GRANT ALL ON man_policies TO service_role;
GRANT ALL ON man_decision_events TO service_role;

-- Grant sequence permissions if needed
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;