-- Migration: Create man_notifications table
-- Description: Stores notification records for MAN Mode tasks (idempotent)

CREATE TABLE IF NOT EXISTS man_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,
    task_id UUID NOT NULL,
    workflow_id TEXT NOT NULL,
    step_id TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'realtime', 'webhook')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'retrying')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_man_notifications_task_id ON man_notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_man_notifications_workflow_id ON man_notifications(workflow_id);
CREATE INDEX IF NOT EXISTS idx_man_notifications_channel ON man_notifications(channel);
CREATE INDEX IF NOT EXISTS idx_man_notifications_sent_at ON man_notifications(sent_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_man_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER man_notifications_updated_at
BEFORE UPDATE ON man_notifications
FOR EACH ROW
EXECUTE FUNCTION update_man_notifications_updated_at();

-- RLS policies (if using Supabase RLS)
ALTER TABLE man_notifications ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY man_notifications_service_full_access ON man_notifications
FOR ALL USING (true);

-- Allow authenticated users to read their workflow notifications
CREATE POLICY man_notifications_user_read ON man_notifications
FOR SELECT USING (
    auth.role() = 'authenticated'
);

COMMENT ON TABLE man_notifications IS 'Idempotent notification records for MAN Mode tasks';
COMMENT ON COLUMN man_notifications.idempotency_key IS 'Format: man_notify:{task_id}:{channel}';
COMMENT ON COLUMN man_notifications.channel IS 'Notification delivery channel';
COMMENT ON COLUMN man_notifications.metadata IS 'Additional notification context (e.g., recipient, template)';
