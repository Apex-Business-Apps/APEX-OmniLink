-- Migration: Add MAN Mode tables for human-in-the-loop safety
-- Created: 2026-01-07
-- Description: Tables for Manual Assistance Needed (MAN) mode

-- Table for manual review tasks
CREATE TABLE IF NOT EXISTS man_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    intent JSONB NOT NULL,
    decision JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups by status and creation time
CREATE INDEX IF NOT EXISTS idx_man_tasks_status_created
ON man_tasks (status, created_at);

-- Index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_man_tasks_idempotency
ON man_tasks (idempotency_key);

-- Table for tenant-specific policy configurations
CREATE TABLE IF NOT EXISTS man_policies (
    tenant_id TEXT NOT NULL,
    workflow_key TEXT NOT NULL,
    policy_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, workflow_key)
);

-- Index for policy lookups
CREATE INDEX IF NOT EXISTS idx_man_policies_tenant_workflow
ON man_policies (tenant_id, workflow_key);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_man_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_man_tasks_updated_at
    BEFORE UPDATE ON man_tasks
    FOR EACH ROW EXECUTE FUNCTION update_man_updated_at();

CREATE TRIGGER update_man_policies_updated_at
    BEFORE UPDATE ON man_policies
    FOR EACH ROW EXECUTE FUNCTION update_man_updated_at();