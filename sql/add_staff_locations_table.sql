-- Staff location tracking for the tactical map
-- Stores real-time GPS positions for on-shift staff (opt-in)
-- Positions are upserted during shift and deleted on clock-out

CREATE TABLE IF NOT EXISTS staff_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  accuracy      REAL,
  heading       REAL,
  speed         REAL,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE staff_locations ENABLE ROW LEVEL SECURITY;

-- Company members can read their own company's staff locations
CREATE POLICY "staff_locations_read" ON staff_locations FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_memberships cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- Users can insert/update/delete their own location
CREATE POLICY "staff_locations_write" ON staff_locations FOR ALL TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- Enable realtime for live tracking on the tactical map
ALTER PUBLICATION supabase_realtime ADD TABLE staff_locations;

-- Index for fast company-scoped queries
CREATE INDEX IF NOT EXISTS idx_staff_locations_company ON staff_locations(company_id);

-- Auto-cleanup: delete stale locations older than 8 hours (missed clock-outs)
-- This can be run as a cron job or Supabase scheduled function
-- DELETE FROM staff_locations WHERE updated_at < now() - interval '8 hours';
