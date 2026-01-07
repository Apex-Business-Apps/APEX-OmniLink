-- Migration: Create MAN Mode Tables
-- Description: Persistent storage for manual tasks and policies

-- 1. Enums
CREATE TYPE man_lane AS ENUM ('GREEN', 'YELLOW', 'RED', 'BLOCKED');
CREATE TYPE man_task_status AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'MODIFIED');

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS man_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    workflow_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    tool_input JSONB NOT NULL DEFAULT '{}'::jsonb,
    triage_result JSONB NOT NULL,
    status man_task_status NOT NULL DEFAULT 'PENDING',
    decision JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure we don't create duplicate tasks for the same step run
    CONSTRAINT uq_man_tasks_idempotency UNIQUE (idempotency_key, tenant_id)
);

-- 3. Indexes for performance
CREATE INDEX idx_man_tasks_status ON man_tasks(status);
CREATE INDEX idx_man_tasks_workflow ON man_tasks(workflow_id);

-- 4. Policies Table (for future dynamic configuration)
CREATE TABLE IF NOT EXISTS man_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    policy_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_man_tasks_modtime
    BEFORE UPDATE ON man_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
