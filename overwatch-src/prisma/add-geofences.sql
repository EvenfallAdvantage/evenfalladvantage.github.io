-- ============================================================
-- OVERWATCH - Geofences (Phase 7 / Geofences)
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- Adds: geofences table for venue boundaries and zone overlays.
--
-- Storage: GeoJSON polygons as JSONB (no PostGIS dependency - we plot via
-- Cesium client-side and don't need server-side spatial queries yet).
--
-- Idempotent - safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS geofences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  -- GeoJSON Polygon geometry: { type: "Polygon", coordinates: [[[lng,lat], ...]] }.
  -- Validation happens client-side; we keep the column permissive so future
  -- shapes (MultiPolygon, Circle marker, etc.) can extend without migration.
  geometry      JSONB NOT NULL,
  color         TEXT DEFAULT '#6366f1',
  fill_opacity  NUMERIC(3,2) DEFAULT 0.20 CHECK (fill_opacity >= 0 AND fill_opacity <= 1),
  stroke_width  INT DEFAULT 2 CHECK (stroke_width BETWEEN 0 AND 20),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_company ON geofences(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_geofences_team ON geofences(team_id) WHERE team_id IS NOT NULL;

ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geofences_select ON geofences;
CREATE POLICY geofences_select ON geofences
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS geofences_insert ON geofences;
CREATE POLICY geofences_insert ON geofences
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS geofences_update ON geofences;
CREATE POLICY geofences_update ON geofences
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS geofences_delete ON geofences;
CREATE POLICY geofences_delete ON geofences
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

COMMENT ON TABLE geofences IS 'Venue geospatial boundaries (Phase 7). Stored as GeoJSON polygons; plotted via Cesium client-side. Members read; admins manage.';
COMMENT ON COLUMN geofences.geometry IS 'GeoJSON Polygon or MultiPolygon as JSONB. Coordinates are [lng, lat] pairs per RFC 7946.';
