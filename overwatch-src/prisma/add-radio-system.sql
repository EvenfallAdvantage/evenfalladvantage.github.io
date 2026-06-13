-- ============================================================
-- OVERWATCH — Radio / SDR Frequency Scanner System
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── RADIO FREQUENCIES ────────────────────────────────────

CREATE TABLE IF NOT EXISTS radio_frequencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  frequency       DOUBLE PRECISION NOT NULL,
  mode            TEXT DEFAULT 'FM',
  band            TEXT,
  ctcss_dcs       TEXT,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'custom',
  state           TEXT,
  city            TEXT,
  county          TEXT,
  priority        INT DEFAULT 5,
  is_reference    BOOLEAN DEFAULT false,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── RADIO NODES (mesh/LoRa devices — for future bridge) ──

CREATE TABLE IF NOT EXISTS radio_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  node_id         TEXT,
  node_id_hex     TEXT,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  name            TEXT,
  short_name      TEXT,
  hardware_model  TEXT,
  firmware_version TEXT,
  role            TEXT DEFAULT 'client',
  battery_level   INT,
  signal_rssi     DOUBLE PRECISION,
  signal_snr      DOUBLE PRECISION,
  last_latitude   DOUBLE PRECISION,
  last_longitude  DOUBLE PRECISION,
  last_altitude   DOUBLE PRECISION,
  is_online       BOOLEAN DEFAULT false,
  is_gateway      BOOLEAN DEFAULT false,
  last_seen       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── RADIO LOGS (transmission activity log) ───────────────

CREATE TABLE IF NOT EXISTS radio_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  node_id         UUID REFERENCES radio_nodes(id) ON DELETE SET NULL,
  frequency_id    UUID REFERENCES radio_frequencies(id) ON DELETE SET NULL,
  direction       TEXT NOT NULL DEFAULT 'rx',
  mode            TEXT,
  content         TEXT,
  signal_strength DOUBLE PRECISION,
  logged_at       TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── COMPANY / MEMBER SETTINGS ────────────────────────────

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS radio_state TEXT;

ALTER TABLE company_memberships
ADD COLUMN IF NOT EXISTS radio_states TEXT[] DEFAULT '{}';

-- ─── INDEXES ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_radio_freq_company ON radio_frequencies(company_id);
CREATE INDEX IF NOT EXISTS idx_radio_freq_category ON radio_frequencies(category);
CREATE INDEX IF NOT EXISTS idx_radio_freq_state ON radio_frequencies(state);
CREATE INDEX IF NOT EXISTS idx_radio_freq_frequency ON radio_frequencies(frequency);
CREATE INDEX IF NOT EXISTS idx_radio_nodes_company ON radio_nodes(company_id);
CREATE INDEX IF NOT EXISTS idx_radio_nodes_user ON radio_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_radio_nodes_online ON radio_nodes(is_online);
CREATE INDEX IF NOT EXISTS idx_radio_logs_company ON radio_logs(company_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_radio_logs_user ON radio_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_radio_logs_frequency ON radio_logs(frequency_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE radio_frequencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['radio_frequencies', 'radio_nodes', 'radio_logs']
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (is_company_member(company_id))', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id))', tbl || '_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (is_company_member(company_id))', tbl || '_update', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (is_company_admin(company_id))', tbl || '_delete', tbl);
  END LOOP;
END $$;

-- Reference frequencies are company-less — anyone can read
CREATE POLICY "radio_frequencies_reference_select" ON radio_frequencies
  FOR SELECT TO authenticated
  USING (is_reference = true OR is_company_member(company_id));

-- ============================================================
-- ✅ Done! radio_frequencies, radio_nodes, radio_logs created.
-- Company settings columns added. RLS enforced.
-- ============================================================
