-- ═══════════════════════════════════════════════════════════════
-- Tactical Map Enhancement Tables
-- Run this after add_staff_locations_table.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Staff Location History (breadcrumb trails) ────────────
-- Append-only log of GPS positions for patrol trail reconstruction.
-- Auto-pruned to 48 hours by a scheduled cleanup.

CREATE TABLE IF NOT EXISTS staff_location_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  accuracy      REAL,
  heading       REAL,
  speed         REAL,
  recorded_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staff_location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_history_read" ON staff_location_history FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
  ));

CREATE POLICY "location_history_write" ON staff_location_history FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

CREATE INDEX idx_location_history_user_time ON staff_location_history(user_id, recorded_at DESC);
CREATE INDEX idx_location_history_company ON staff_location_history(company_id, recorded_at DESC);

-- Auto-cleanup: delete records older than 48 hours (run as a cron/scheduled function)
-- DELETE FROM staff_location_history WHERE recorded_at < now() - interval '48 hours';


-- ─── 2. Map Annotations (tactical drawings) ──────────────────
-- Stores drawings, shapes, labels placed on the tactical map.
-- Company-wide, optionally scoped to an operation.

CREATE TABLE IF NOT EXISTS map_annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('line', 'polygon', 'circle', 'arrow', 'text', 'freehand')),
  geometry      JSONB NOT NULL, -- GeoJSON-like: { positions: [[lng,lat],...], radius?: number }
  label         TEXT,
  color         TEXT DEFAULT '#ef4444',
  style         TEXT DEFAULT 'solid', -- solid, dashed, dotted
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE map_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annotations_read" ON map_annotations FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
  ));

-- Only admin+ can create/edit/delete annotations
CREATE POLICY "annotations_write" ON map_annotations FOR ALL TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
      AND cm.role IN ('owner', 'admin', 'manager')
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE map_annotations;

CREATE INDEX idx_annotations_company ON map_annotations(company_id);
CREATE INDEX idx_annotations_event ON map_annotations(event_id);


-- ─── 3. Geofence Alerts ──────────────────────────────────────
-- Records when staff breach an operation's geofence boundary.

CREATE TABLE IF NOT EXISTS geofence_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type    TEXT NOT NULL DEFAULT 'breach', -- breach, return
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  distance_m    REAL NOT NULL, -- distance from geofence center in meters
  acknowledged  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE geofence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geofence_alerts_read" ON geofence_alerts FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM company_memberships cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
  ));

CREATE POLICY "geofence_alerts_write" ON geofence_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

ALTER PUBLICATION supabase_realtime ADD TABLE geofence_alerts;

CREATE INDEX idx_geofence_alerts_company ON geofence_alerts(company_id, created_at DESC);


-- ─── 4. Add lat/lng to checkpoints ───────────────────────────

ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- ─── 5. Add lat/lng capture to patrol_logs ───────────────────

ALTER TABLE patrol_logs ADD COLUMN IF NOT EXISTS scan_lat DOUBLE PRECISION;
ALTER TABLE patrol_logs ADD COLUMN IF NOT EXISTS scan_lng DOUBLE PRECISION;
ALTER TABLE patrol_logs ADD COLUMN IF NOT EXISTS gps_verified BOOLEAN DEFAULT false;
