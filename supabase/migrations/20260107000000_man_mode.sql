-- Migration: Add MAN Mode tables for human-in-the-loop safety
-- Created: 2026-01-07
-- Description: Tables for Manual Assistance Needed (MAN) mode

-- Table for manual review tasks
CREATE TABLE IF NOT EXISTS man_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'DENIED')),
    intent JSONB NOT NULL,
    decision JSONB
);

-- Table for tenant-specific policy configurations
CREATE TABLE IF NOT EXISTS man_policies (
    tenant_id TEXT NOT NULL,
    workflow_key TEXT NOT NULL,
    policy_json JSONB NOT NULL,
    PRIMARY KEY (tenant_id, workflow_key)
);