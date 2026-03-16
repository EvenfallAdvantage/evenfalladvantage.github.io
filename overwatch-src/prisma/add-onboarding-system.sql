-- ============================================================
-- OVERWATCH — Onboarding & Intake System Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Adds: applicants pipeline, onboarding checklists, integrations config
-- ============================================================

-- ─── 1. Applicants Table (public-facing, no auth required) ──
CREATE TABLE IF NOT EXISTS applicants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  guard_card_number TEXT,
  guard_card_expiry DATE,
  work_preferences TEXT[] DEFAULT '{}',
  availability    TEXT,
  experience      TEXT,
  resume_url      TEXT,
  cover_letter    TEXT,
  source          TEXT DEFAULT 'overwatch',
  status          TEXT DEFAULT 'applied' CHECK (status IN (
    'applied', 'reviewing', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'
  )),
  notes           TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  hired_at        TIMESTAMPTZ,
  converted_user_id UUID REFERENCES users(id),
  custom_fields   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applicants_company ON applicants(company_id, status);
CREATE INDEX IF NOT EXISTS idx_applicants_email ON applicants(email);

ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;

-- Admins can manage applicants
CREATE POLICY applicants_select ON applicants
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));
CREATE POLICY applicants_insert ON applicants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY applicants_update ON applicants
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));
CREATE POLICY applicants_delete ON applicants
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

-- Also allow anonymous inserts for public application form
CREATE POLICY applicants_public_insert ON applicants
  FOR INSERT TO anon
  WITH CHECK (true);

-- ─── 2. Onboarding Task Templates (admin-configurable) ─────
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT DEFAULT 'general',
  is_required     BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  auto_link       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_company ON onboarding_tasks(company_id, sort_order);

ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_tasks_select ON onboarding_tasks
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY onboarding_tasks_insert ON onboarding_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY onboarding_tasks_update ON onboarding_tasks
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));
CREATE POLICY onboarding_tasks_delete ON onboarding_tasks
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

-- ─── 3. Onboarding Progress (per-user task completion) ──────
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id         UUID NOT NULL REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
  completed       BOOLEAN DEFAULT false,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  UNIQUE(user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON onboarding_progress(user_id);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_progress_select ON onboarding_progress
  FOR SELECT TO authenticated
  USING (user_id = public.get_my_user_id()
    OR EXISTS (
      SELECT 1 FROM onboarding_tasks t
      WHERE t.id = task_id AND public.is_company_admin(t.company_id)
    ));
CREATE POLICY onboarding_progress_insert ON onboarding_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_my_user_id());
CREATE POLICY onboarding_progress_update ON onboarding_progress
  FOR UPDATE TO authenticated
  USING (user_id = public.get_my_user_id()
    OR EXISTS (
      SELECT 1 FROM onboarding_tasks t
      WHERE t.id = task_id AND public.is_company_admin(t.company_id)
    ));

-- ─── 4. Integrations Config (per-company API keys/webhooks) ─
CREATE TABLE IF NOT EXISTS integrations_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  config          JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, provider)
);

ALTER TABLE integrations_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrations_config_select ON integrations_config
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));
CREATE POLICY integrations_config_insert ON integrations_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY integrations_config_update ON integrations_config
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id));

-- ─── 5. Add employee_status values to existing memberships ──
-- The company_memberships.status column already exists with default 'active'.
-- Add a comment documenting the full status lifecycle:
COMMENT ON COLUMN company_memberships.status IS
  'Employee lifecycle: applicant | onboarding | active | inactive | terminated';

-- ─── Done ───────────────────────────────────────────────────
