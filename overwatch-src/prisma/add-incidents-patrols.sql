-- ============================================================
-- OVERWATCH — Incidents + Guard Tour / Patrol System
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── INCIDENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reported_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to   UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL DEFAULT 'general',
  severity      TEXT NOT NULL DEFAULT 'low',
  priority      TEXT NOT NULL DEFAULT 'medium',
  status        TEXT NOT NULL DEFAULT 'open',
  location      TEXT,
  location_lat  DOUBLE PRECISION,
  location_lng  DOUBLE PRECISION,
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  type          TEXT DEFAULT 'note',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── GUARD TOUR / PATROL SYSTEM ───────────────────────────
CREATE TABLE IF NOT EXISTS checkpoints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  location      TEXT,
  location_lat  DOUBLE PRECISION,
  location_lng  DOUBLE PRECISION,
  qr_code       TEXT UNIQUE,
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patrol_routes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  checkpoint_ids UUID[] DEFAULT '{}',
  frequency_min INT DEFAULT 60,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patrol_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  route_id        UUID REFERENCES patrol_routes(id) ON DELETE SET NULL,
  checkpoint_id   UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scanned_at      TIMESTAMPTZ DEFAULT now(),
  notes           TEXT,
  photo_url       TEXT,
  status          TEXT DEFAULT 'ok',
  location_lat    DOUBLE PRECISION,
  location_lng    DOUBLE PRECISION,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_incidents_company ON incidents(company_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_reported ON incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates(incident_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_company ON checkpoints(company_id);
CREATE INDEX IF NOT EXISTS idx_patrol_routes_company ON patrol_routes(company_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_company ON patrol_logs(company_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_user ON patrol_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_checkpoint ON patrol_logs(checkpoint_id);

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrol_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrol_logs ENABLE ROW LEVEL SECURITY;

-- Incidents: company-scoped
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['incidents', 'checkpoints', 'patrol_routes', 'patrol_logs']
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (is_company_member(company_id))', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id))', tbl || '_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (is_company_member(company_id))', tbl || '_update', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (is_company_admin(company_id))', tbl || '_delete', tbl);
  END LOOP;
END $$;

-- Incident updates: anyone in company can read/add (via parent incident)
CREATE POLICY "incident_updates_select" ON incident_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "incident_updates_insert" ON incident_updates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "incident_updates_delete" ON incident_updates FOR DELETE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text));

-- ============================================================
-- ✅ Done! incidents, incident_updates, checkpoints, patrol_routes, patrol_logs created.
-- ============================================================
