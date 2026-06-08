-- Incident Enhancements (HaloControl parity)
-- Extend existing incidents system with teams, custom types/statuses, auto-numbering

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add columns to incidents table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS incident_number TEXT,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'internal' CHECK (source IN ('internal','public','api')),
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Incident type/status/field definitions (per-company)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incident_type_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, key)
);

CREATE TABLE IF NOT EXISTS incident_status_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_terminal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, key)
);

CREATE TABLE IF NOT EXISTS incident_field_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incident_type_key TEXT,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','number','select','multiselect','date','checkbox','textarea')),
  options JSONB DEFAULT '{}'::jsonb,
  required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  conditional_on JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, incident_type_key, field_key)
);

CREATE TABLE IF NOT EXISTS incident_counters (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_incidents_team ON incidents(team_id);
CREATE INDEX IF NOT EXISTS idx_incidents_number ON incidents(incident_number);
CREATE INDEX IF NOT EXISTS idx_incidents_due_at ON incidents(due_at);
CREATE INDEX IF NOT EXISTS idx_incidents_source ON incidents(source);
CREATE INDEX IF NOT EXISTS idx_incident_type_defs_company ON incident_type_defs(company_id);
CREATE INDEX IF NOT EXISTS idx_incident_status_defs_company ON incident_status_defs(company_id);
CREATE INDEX IF NOT EXISTS idx_incident_field_defs_company ON incident_field_defs(company_id);
CREATE INDEX IF NOT EXISTS idx_incident_counters_company ON incident_counters(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE incident_type_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_status_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_field_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incident_type_defs_member_read ON incident_type_defs;
CREATE POLICY incident_type_defs_member_read ON incident_type_defs
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS incident_type_defs_admin_write ON incident_type_defs;
CREATE POLICY incident_type_defs_admin_write ON incident_type_defs
  FOR ALL USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS incident_status_defs_member_read ON incident_status_defs;
CREATE POLICY incident_status_defs_member_read ON incident_status_defs
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS incident_status_defs_admin_write ON incident_status_defs;
CREATE POLICY incident_status_defs_admin_write ON incident_status_defs
  FOR ALL USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS incident_field_defs_member_read ON incident_field_defs;
CREATE POLICY incident_field_defs_member_read ON incident_field_defs
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS incident_field_defs_admin_write ON incident_field_defs;
CREATE POLICY incident_field_defs_admin_write ON incident_field_defs
  FOR ALL USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS incident_counters_member_read ON incident_counters;
CREATE POLICY incident_counters_member_read ON incident_counters
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS incident_counters_admin_write ON incident_counters;
CREATE POLICY incident_counters_admin_write ON incident_counters
  FOR ALL USING (public.is_company_admin(company_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Comments
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE incident_type_defs IS 'Per-company incident type definitions (e.g., "Security Breach", "Medical Emergency").';
COMMENT ON TABLE incident_status_defs IS 'Per-company incident status definitions (e.g., "Active", "Resolved").';
COMMENT ON TABLE incident_field_defs IS 'Per-company custom form fields for incident creation.';
COMMENT ON TABLE incident_counters IS 'Per-company, per-year counter for auto-generating incident numbers.';
