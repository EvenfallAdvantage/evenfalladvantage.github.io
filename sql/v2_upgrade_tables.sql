-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  V2 UPGRADE — New Tables for Badge System, Site Assessments,  ║
-- ║  Client Intake Sharing, and Job Postings                       ║
-- ║  Run in Supabase SQL Editor                                    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ── 1. Site Assessments (persist to DB instead of localStorage) ──

CREATE TABLE IF NOT EXISTS site_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  client_name text,
  address text,
  lat double precision,
  lng double precision,
  data jsonb NOT NULL DEFAULT '{}',
  risk_score numeric(5,2),
  risk_level text CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  pdf_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_assessments_company ON site_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_site_assessments_event ON site_assessments(event_id);

ALTER TABLE site_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_assessments_company_access" ON site_assessments
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

-- ── 2. Client Intake Share Tokens ──

CREATE TABLE IF NOT EXISTS intake_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  client_name text,
  client_email text,
  submitted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_shares_token ON intake_shares(token);
CREATE INDEX IF NOT EXISTS idx_intake_shares_event ON intake_shares(event_id);

ALTER TABLE intake_shares ENABLE ROW LEVEL SECURITY;

-- Company members can manage shares
CREATE POLICY "intake_shares_company_access" ON intake_shares
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

-- Public read access via token (for the client filling it out)
CREATE POLICY "intake_shares_public_read" ON intake_shares
  FOR SELECT USING (true);

-- ── 3. Job Postings ──

CREATE TABLE IF NOT EXISTS job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  department text,
  location text,
  employment_type text CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'temporary', 'internship')),
  description_html text NOT NULL DEFAULT '',
  requirements text,
  compensation_range text,
  show_compensation boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  external_ids jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_company ON job_postings(company_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

-- Company members can manage postings
CREATE POLICY "job_postings_company_access" ON job_postings
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

-- Public read for active postings (careers page)
CREATE POLICY "job_postings_public_read" ON job_postings
  FOR SELECT USING (status = 'active');

-- ── 4. Link applicants to job postings ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'posting_id'
  ) THEN
    ALTER TABLE applicants ADD COLUMN posting_id uuid REFERENCES job_postings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 5. Add clock_method options for QR badge scanning ──
-- The timesheets table already has a clock_method column.
-- We just need to ensure 'qr_scan' and 'manager_scan' are valid values.
-- If it's a text column (not enum), no schema change needed — just use the new values.

-- ── 6. Badge generation tracking (optional — store generated badge metadata) ──

CREATE TABLE IF NOT EXISTS staff_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_number text,
  qr_data text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  UNIQUE(company_id, user_id)
);

ALTER TABLE staff_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_badges_company_access" ON staff_badges
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
