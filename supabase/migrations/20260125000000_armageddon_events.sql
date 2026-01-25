-- Armageddon Level 7 Test Harness - Telemetry Tables
-- Migration: 20260125_armageddon_events
-- Created: 2026-01-25
-- Author: APEX Business Systems

-- =====================================================
-- armageddon_events: Granular telemetry for battery runs
-- =====================================================
CREATE TABLE IF NOT EXISTS armageddon_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL,
    battery_id INTEGER NOT NULL CHECK (battery_id BETWEEN 10 AND 13),
    event_type TEXT NOT NULL CHECK (event_type IN ('ATTEMPT', 'ESCAPE', 'BLOCKED', 'HEARTBEAT', 'COMPLETE')),
    details TEXT NOT NULL DEFAULT '',
    iteration INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient querying by run
CREATE INDEX IF NOT EXISTS idx_armageddon_events_run_id ON armageddon_events(run_id);

-- Index for filtering by battery
CREATE INDEX IF NOT EXISTS idx_armageddon_events_battery_id ON armageddon_events(battery_id);

-- Index for event type analytics
CREATE INDEX IF NOT EXISTS idx_armageddon_events_event_type ON armageddon_events(event_type);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_armageddon_events_run_battery ON armageddon_events(run_id, battery_id);

-- =====================================================
-- armageddon_runs: Aggregated run results with verdicts
-- =====================================================
CREATE TABLE IF NOT EXISTS armageddon_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT UNIQUE NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    iterations INTEGER NOT NULL DEFAULT 10000,
    seed INTEGER NOT NULL,
    verdict TEXT CHECK (verdict IN ('CERTIFIED', 'FAILED', 'RUNNING', 'ERROR')),
    aggregate_escape_rate NUMERIC(10, 8),
    total_duration_ms INTEGER,
    battery_results JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for run lookups
CREATE INDEX IF NOT EXISTS idx_armageddon_runs_run_id ON armageddon_runs(run_id);

-- Index for verdict filtering
CREATE INDEX IF NOT EXISTS idx_armageddon_runs_verdict ON armageddon_runs(verdict);

-- =====================================================
-- RLS Policies (Optional - for multi-tenant scenarios)
-- =====================================================
-- ALTER TABLE armageddon_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE armageddon_runs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE armageddon_events IS 'Granular telemetry events from Armageddon Level 7 battery simulations';
COMMENT ON TABLE armageddon_runs IS 'Aggregated results and verdicts for Armageddon certification runs';

COMMENT ON COLUMN armageddon_events.battery_id IS 'Battery identifier: 10=Goal Hijack, 11=Tool Misuse, 12=Memory Poison, 13=Supply Chain';
COMMENT ON COLUMN armageddon_events.event_type IS 'Event classification: ATTEMPT, ESCAPE (defense failure), BLOCKED, HEARTBEAT, COMPLETE';
COMMENT ON COLUMN armageddon_runs.verdict IS 'Certification result: CERTIFIED (<0.01% escape), FAILED (>=0.01% escape), RUNNING, ERROR';
