-- Add TTL and notification fields to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notification_channels TEXT[] DEFAULT '{}';

-- Update existing alerts to have default TTL (e.g., 7 days from creation)
UPDATE alerts SET expires_at = created_at + INTERVAL '7 days' WHERE expires_at IS NULL;

-- Index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_alerts_expires_at ON alerts(expires_at) WHERE resolved = FALSE;